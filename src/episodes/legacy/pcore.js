'use strict';
/* ============================================================
   計算モデル（コヒーレントなパルス列。レンジゲートごとにパルスごとの複素サンプル I/Q を作り、FFT でドップラ処理する）
   ============================================================ */
const C = 3e8;                      // 光速 [m/s]
const KT = 1.943844, NMI = 1852;    // m/s → ノット、海里 [m]
const MINUS = '−';
const LOOKS = [1, 9 / 10, 9 / 11];  // PRF A・B・C（パルス間隔の比が 9:10:11。ハンドブック 図4.18 の例と同じ比）
const LOOKN = ['A', 'B', 'C'];
const THB = 3 * Math.PI / 180;      // アンテナのビーム幅（片道 3 dB、方位・俯仰とも）
const GSL = Math.pow(10, -4.5);     // サイドローブの利得（メインビームのピーク比、片道 −45 dB。等方的で一定と近似：p.4.18）
const SPEC = 10, THS = 10 * Math.PI / 180;   // 真下付近（垂直入射）の反射の強まり（+10 dB、幅 10°）
const SVC = 0.3;                    // 地上設置のクラッタの速度の拡がり（標準偏差 [m/s]）
const GND_R0 = 1000, GND_R1 = 40000;         // 地上設置のクラッタがある距離範囲 [m]
const WT = {none: {name: 'なし（一様）', sl: 0}, c50: {name: 'チェビシェフ 50 dB', sl: 50}, c70: {name: 'チェビシェフ 70 dB', sl: 70}, c90: {name: 'チェビシェフ 90 dB', sl: 90}};

/* 共通設定（全ステップで共有） */
const DEFAULTS = {f: 10, prf: 10, look: 0, np: 64, wt: 'none', tau: 1, cn: 50, vr: 0, h: 3, az: 30, dep: 6, cpos: false, tsel: 0,
  t: [{on: true, r: 9, v: 45, s: 0}, {on: true, r: 5.1, v: -30, s: 0}, {on: false, r: 27.3, v: 110, s: 5}], pn: 0, rmax: 60, vmax: 300, seed: 1};
const cloneDef = () => JSON.parse(JSON.stringify(DEFAULTS));
const S = cloneDef();

const db10 = v => 10 * Math.log10(Math.max(v, 1e-30));
const foldF = (f, prf) => f - prf * Math.floor(f / prf + 0.5);        // [−prf/2, +prf/2) に折り返す

/* 設定から決まる量 */
function derive(o, look){
  o = o || S; look = look === undefined || look === null ? o.look : look;
  const lam = C / (o.f * 1e9), prf = o.prf * 1e3 * LOOKS[look], T = 1 / prf, tau0 = o.tau * 1e-6, tau = Math.min(tau0, T / 2), N = o.np;
  const ng = Math.max(2, Math.floor(T / tau + 1e-9)), air = o.vr > 0, F = 2 * o.vr / lam, dep = o.dep * Math.PI / 180, az = o.az * Math.PI / 180;
  const fmb = air ? F * Math.cos(dep) * Math.cos(az) : 0;             // メインビームクラッタのドップラ：(2VR/λ)cosψ0（p.4.4）
  return {lam, prf, T, tau, clamped: tau < tau0 - 1e-12, N, ng, gate: C * tau / 2, Ru: C / (2 * prf), vprf: prf * lam / 2, duty: tau / T, cpi: N * T,
          df: prf / N, dv: prf * lam / 2 / N, air, F, dep, az, fmb, foff: air && o.cpos ? fmb : 0, h: o.h * 1000, look};
}
/* レンジゲート g（遅延 [gτ, (g+1)τ)）での、エコー（到来位置 gpos = 遅延/τ）の整合フィルタ出力（電圧）。
   幅 τ の矩形どうしの重なり＝三角形（図4.20）。ゲート 0 は送信中で受信できない（エクリプシング） */
function gateAmp(gpos, g, ng){ return g <= 0 || g >= ng ? 0 : Math.max(0, 1 - Math.abs(gpos - g)); }
function bestGate(gpos, ng){ const g0 = Math.floor(gpos), a0 = gateAmp(gpos, g0, ng), a1 = gateAmp(gpos, g0 + 1, ng); return a0 >= a1 ? {g: g0, a: a0} : {g: g0 + 1, a: a1}; }
function tgtInfo(o, D, i){
  const t = o.t[i], R = t.r * 1000, fd = 2 * t.v / D.lam, td = 2 * R / C, k = Math.floor(td / D.T + 1e-9), tamb = td - k * D.T, gpos = tamb / D.tau;
  const fapp = foldF(fd - D.foff, D.prf), bg = bestGate(gpos, D.ng);
  return {i, on: t.on, R, v: t.v, A: Math.pow(10, t.s / 20), s: t.s, fd, k, Ramb: tamb * C / 2, gpos, g: bg.g, ga: bg.a, fapp, vapp: fapp * D.lam / 2,
          kv: Math.round((fd - D.foff - fapp) / D.prf), ph: 0.4 + 1.3 * i};
}
function eclipseAvg(D){          // 遅延がパルス間隔の中で一様に分布するとしたときの、平均の出力電力（図4.20 の下段の平均）
  const n = 4000, x = D.T / D.tau; let s = 0; for (let i = 0; i < n; i++){ const a = bestGate((i + 0.5) / n * x, D.ng).a; s += a * a; } return s / n;
}

/* ---------- FFT（基数2、インプレース） ---------- */
const _tw = new Map();
function _tables(n){
  let t = _tw.get(n);
  if (!t){
    const c = new Float64Array(n), s = new Float64Array(n), r = new Uint32Array(n);
    for (let i = 0; i < n; i++){ c[i] = Math.cos(2 * Math.PI * i / n); s[i] = Math.sin(2 * Math.PI * i / n); }
    const bits = Math.round(Math.log2(n));
    for (let i = 0; i < n; i++){ let x = i, y = 0; for (let b = 0; b < bits; b++){ y = (y << 1) | (x & 1); x >>= 1; } r[i] = y; }
    t = {c, s, r}; _tw.set(n, t);
  }
  return t;
}
function fft(re, im, inv){
  const n = re.length, t = _tables(n), r = t.r, c = t.c, s = t.s;
  for (let i = 0; i < n; i++){ const j = r[i]; if (j > i){ let a = re[i]; re[i] = re[j]; re[j] = a; a = im[i]; im[i] = im[j]; im[j] = a; } }
  for (let size = 2; size <= n; size <<= 1){
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size){
      for (let j = 0, k = 0; j < half; j++, k += step){
        const wr = c[k], wi = inv ? s[k] : -s[k], a = i + j, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
  }
  if (inv){ for (let i = 0; i < n; i++){ re[i] /= n; im[i] /= n; } }
}
/* ---------- 固定シードの乱数（ゲートごと・用途ごとに独立な系列。毎回同じ結果を再現できる） ---------- */
function mulberry32(a){
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rndFor = (seed, g, stream) => mulberry32((seed * 7919 + g * 104729 + stream * 1299709 + 12345) | 0);
function erf(x){ const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }

/* ---------- 重み付け（ドルフ・チェビシェフ） ---------- */
const _win = new Map();
function getWin(N, wt){
  const key = N + '/' + wt; let w = _win.get(key); if (w) return w;
  w = new Float64Array(N);
  const sl = WT[wt] ? WT[wt].sl : 0;
  if (!sl) w.fill(1);
  else {
    const R = Math.pow(10, sl / 20), M = N - 1, x0 = Math.cosh(Math.acosh(R) / M);
    const Tm = x => Math.abs(x) <= 1 ? Math.cos(M * Math.acos(x)) : (x > 0 || M % 2 === 0 ? 1 : -1) * Math.cosh(M * Math.acosh(Math.abs(x)));
    const tk = new Float64Array(N); for (let k = 0; k < N; k++) tk[k] = Tm(x0 * Math.cos(Math.PI * k / N));
    let mx = 0;
    for (let n = 0; n <= M / 2; n++){ let s = 0; const a = 2 * Math.PI * (n - M / 2) / N; for (let k = 0; k < N; k++) s += tk[k] * Math.cos(a * k); w[n] = w[M - n] = s; mx = Math.max(mx, Math.abs(s)); }
    for (let n = 0; n < N; n++) w[n] /= mx;
  }
  _win.set(key, w); return w;
}
/* 重み付けの特性：重み付け損失（雑音帯域の増加：p.4.43）、ピークサイドローブ、3 dB 幅、ストラドル損失（フィルタ中心から半フィルタずれたとき） */
const _ws = new Map();
function winStats(N, wt){
  const key = N + '/' + wt; let r = _ws.get(key); if (r) return r;
  const w = getWin(N, wt), os = N >= 1024 ? 16 : 32, M = N * os, re = new Float64Array(M), im = new Float64Array(M);
  let s1 = 0, s2 = 0; for (let n = 0; n < N; n++){ re[n] = w[n]; s1 += w[n]; s2 += w[n] * w[n]; }
  fft(re, im);
  const p = new Float64Array(M / 2); for (let k = 0; k < M / 2; k++) p[k] = (re[k] * re[k] + im[k] * im[k]) / (s1 * s1);
  let k = 1; while (k < M / 2 - 1 && p[k] < p[k - 1]) k++;                  // 主ローブの端（最初の極小）
  let psl = 0; for (let i = k; i < M / 2; i++) if (p[i] > psl) psl = p[i];
  let j = 0; while (j < M / 2 - 1 && p[j + 1] >= 0.5) j++;
  const w3 = 2 * (j + (p[j] - 0.5) / (p[j] - p[j + 1])) / os;
  r = {lossDb: 10 * Math.log10(N * s2 / (s1 * s1)), pslDb: 10 * Math.log10(psl), w3, straddleDb: -10 * Math.log10(p[os / 2]), nullBins: k / os, s1, s2};
  _ws.set(key, r); return r;
}
/* 1本のフィルタの応答（電力、ピーク = 1）。x はフィルタ中心からのずれ（フィルタ間隔を単位） */
function winResp(w, x){ let re = 0, im = 0, s = 0; const N = w.length; for (let n = 0; n < N; n++){ const p = 2 * Math.PI * x * n / N; re += w[n] * Math.cos(p); im += w[n] * Math.sin(p); s += w[n]; } return (re * re + im * im) / (s * s); }

/* ---------- クラッタのモデル ----------
   各ゲートについて、ドップラ方向の電力分布 P（PRF で折り返した細かい格子、M = N×OS 点）を作る。
   地上設置（VR = 0）：1〜40 km に R⁻³ で分布、速度 0 付近（拡がり 0.3 m/s）。PRF に応じて距離方向に折り返す（p.4.15）。
   航空機搭載（VR > 0）：平らな地面、水平飛行。地面の各点（斜距離 R、方位 θ、俯角 φ）のドップラは (2VR/λ)cosφcosθ（p.4.4）。
     電力 ∝ G²σ⁰dA/R⁴（式4.2）。G はガウス形のメインビーム＋一定のサイドローブ。σ⁰ = sinφ（一定ガンマ）＋真下付近の強い反射。
   最後に、最も強いゲートの C/N（1パルス、距離の折り返し後）が設定値になるよう全体を規格化する */
/* 1つのリング（斜距離 ra〜rb）の地面を方位方向に分け、各パッチの電力をドップラの格子に足し込む。
   パッチのドップラは、リングの内外の端と方位の両端の4隅で決まる範囲に一様に広げる */
function ringAdd(df, M, uniRef, fb, foff, F, ra, rb, h, B, G, fold){
  const Rm = (ra + rb) / 2, sinp = Math.min(1, h / Rm), cosp = Math.sqrt(Math.max(0, 1 - sinp * sinp)), inc = Math.PI / 2 - Math.asin(sinp);
  const ca = F * Math.sqrt(Math.max(0, 1 - h * h / (ra * ra))), cb = F * Math.sqrt(Math.max(0, 1 - h * h / (rb * rb)));
  const grid = Math.abs(Math.asin(sinp) - B.dep) < 3.2 * THB ? G.fine : G.coarse, NA = grid.ct.length, ct = grid.ct, st = grid.st, cte = grid.cte, dth = grid.dth;
  const base = (sinp + SPEC * Math.exp(-(inc / THS) * (inc / THS))) * (rb - ra) / (Rm * Rm * Rm);
  for (let i = 0; i < NA; i++){
    const cd = cosp * (B.bx * ct[i] + B.by * st[i]) + B.bz * sinp;
    let g = GSL; if (cd > B.cosLim){ const d = Math.acos(Math.min(1, cd)); g += Math.exp(-B.KG * d * d); }
    const p = base * g * g * dth[i], e1 = cte[i], e2 = cte[i + 1], lo = Math.min(ca * e1, ca * e2, cb * e1, cb * e2) - foff, hi = Math.max(ca * e1, ca * e2, cb * e1, cb * e2) - foff;
    const i0 = Math.round(lo / fb), n = Math.max(1, Math.round((hi - lo) / fb)), d = p / n;
    if (!fold){ const a = Math.max(0, Math.min(M - 1, i0 + (M >> 1))), b = Math.max(a + 1, Math.min(M, i0 + (M >> 1) + n)); df[a] += d; df[b] -= d; continue; }
    const q = Math.floor(n / M), rem = n - q * M; if (q) uniRef[0] += d * q;
    if (rem){ const s = ((i0 % M) + M) % M, e = s + rem; df[s] += d; if (e <= M) df[e] -= d; else { df[0] += d; df[e - M] -= d; } }
  }
}
/* 方位の分割：全周を 1° 刻み。メインビームの方位の近く（±4ビーム幅）だけ 0.125° 刻みにした格子も用意する */
function azGrid(edges){ const n = edges.length - 1, ct = new Float64Array(n), st = new Float64Array(n), cte = new Float64Array(n + 1), dth = new Float64Array(n);
  for (let i = 0; i <= n; i++){ cte[i] = Math.cos(edges[i]); if (i < n){ const m = (edges[i] + edges[i + 1]) / 2; ct[i] = Math.cos(m); st[i] = Math.sin(m); dth[i] = edges[i + 1] - edges[i]; } } return {ct, st, cte, dth}; }
const _azc = new Map();
function azGrids(az){
  const key = Math.round(az * 1e4); let g = _azc.get(key); if (g) return g;
  const d1 = Math.PI / 180, ec = [], ef = [], w = 4 * THB; for (let i = 0; i <= 360; i++) ec.push(i * d1);
  const a0 = Math.floor((az - w) / d1) * d1, a1 = Math.ceil((az + w) / d1) * d1;
  for (let t = a0; t < a1 - 1e-9; t += d1 / 8) ef.push(t); for (let t = a1; t <= a0 + 2 * Math.PI + 1e-9; t += d1) ef.push(t);
  g = {coarse: azGrid(ec), fine: azGrid(ef)}; if (_azc.size > 40) _azc.clear(); _azc.set(key, g); return g;
}
const beamOf = D => ({bx: Math.cos(D.dep) * Math.cos(D.az), by: Math.cos(D.dep) * Math.sin(D.az), bz: Math.sin(D.dep), cosLim: Math.cos(3 * THB), KG: 4 * Math.LN2 / (THB * THB), dep: D.dep});
const horizon = h => Math.min(300e3, Math.sqrt(2 * (4 / 3) * 6371e3 * Math.max(h, 1)));       // 見通し距離（4/3 地球半径）。クラッタはここまで
function clutterModel(o, D){
  const N = D.N, OSF = N >= 256 ? 4 : 8, M = N * OSF, ng = D.ng, P = new Float64Array(ng * M), pg = new Float64Array(ng), fb = D.prf / M;
  if (!D.air){
    const sf = 2 * SVC / D.lam, w = new Float64Array(M), cdf = x => 0.5 * (1 + erf(x / Math.SQRT2)), half = Math.min(M / 2 - 1, Math.ceil(5 * sf / fb) + 1);
    let ws = 0; for (let m = -half; m <= half; m++){ const p = cdf((m + 0.5) * fb / sf) - cdf((m - 0.5) * fb / sf); w[(m + M) % M] += p; ws += p; }
    for (let g = 1; g < ng; g++){
      let s = 0; for (let k = 0; ; k++){ const R = g * D.gate + k * D.Ru; if (R > GND_R1) break; if (R >= GND_R0) s += Math.pow(GND_R0 / R, 3); }
      if (s > 0) for (let m = 0; m < M; m++) if (w[m] > 0) P[g * M + m] = s * w[m] / ws;
      pg[g] = s;
    }
  } else {
    const Rh = horizon(D.h), B = beamOf(D), G = azGrids(D.az), df = new Float64Array(M + 1), uni = [0];
    for (let g = 1; g < ng; g++){
      df.fill(0); uni[0] = 0;
      for (let k = 0; ; k++){
        const Rc = g * D.gate + k * D.Ru, lo = Math.max(Rc - D.gate / 2, D.h), hi = Rc + D.gate / 2;
        if (Rc - D.gate / 2 >= Rh) break; if (hi <= D.h) continue;
        /* 真下に近いリングは俯角が急に変わるので、cosφ がほぼ等間隔になるよう細かく分ける */
        const c0 = Math.sqrt(Math.max(0, 1 - D.h * D.h / (lo * lo))), c1 = Math.sqrt(1 - D.h * D.h / (hi * hi)), ns = Math.min(12, Math.max(1, Math.ceil((c1 - c0) / 0.03)));
        for (let j = 0; j < ns; j++){
          const ra = D.h / Math.sqrt(1 - Math.pow(c0 + (c1 - c0) * j / ns, 2)), rb = D.h / Math.sqrt(1 - Math.pow(c0 + (c1 - c0) * (j + 1) / ns, 2));
          ringAdd(df, M, uni, fb, D.foff, D.F, ra, rb, D.h, B, G, true);
        }
      }
      let acc = 0, s = 0; for (let m = 0; m < M; m++){ acc += df[m]; const v = Math.max(0, acc + uni[0]); P[g * M + m] = v; s += v; }
      pg[g] = s;
    }
  }
  let mx = 0; for (let g = 0; g < ng; g++) if (pg[g] > mx) mx = pg[g];
  const sc = mx > 0 ? Math.pow(10, o.cn / 10) / mx : 0;
  for (let i = 0; i < P.length; i++) P[i] *= sc; for (let g = 0; g < ng; g++) pg[g] *= sc;
  return {P, M, pg, fb};
}
/* 折り返しのないクラッタのスペクトル（全距離の和。図4.2 に対応する見方）。−1.25F〜+1.25F を U 点で */
function clutterUnfolded(o, D, U){
  U = U || 500; const df = new Float64Array(U + 1), span = 2.5 * Math.max(D.F, 1), fb = span / U, Rh = horizon(D.h), B = beamOf(D), G = azGrids(D.az);
  const edges = []; for (let c = 0; c < 0.9001; c += 0.01) edges.push(D.h / Math.sqrt(1 - c * c));
  { let R = edges[edges.length - 1]; const q = Math.pow(Math.max(Rh, R * 1.01) / R, 1 / 400); for (let i = 0; i < 400; i++){ R *= q; edges.push(R); } }
  for (let i = 0; i + 1 < edges.length; i++) ringAdd(df, U, null, fb, 0, D.F, edges[i], edges[i + 1], D.h, B, G, false);
  const p = new Float64Array(U); let acc = 0, mx = 0; for (let m = 0; m < U; m++){ acc += df[m]; p[m] = Math.max(0, acc); if (p[m] > mx) mx = p[m]; }
  for (let m = 0; m < U; m++) p[m] /= mx;
  return {p, f0: -span / 2 + fb / 2, df: fb, U};
}
/* 電力分布 P から、ランダムな位相・振幅の成分の和として N 個の時間サンプルを作る */
function synth(P, off, M, N, rnd, re, im, q){
  let nz = 0; for (let m = 0; m < M; m++) if (P[off + m] > 0) nz++;
  if (!nz) return;
  const t = _tables(M);
  if (nz * N < 12 * M){
    for (let m = 0; m < M; m++){
      const p = P[off + m]; if (!(p > 0)) continue;
      const a = Math.sqrt(-Math.log(Math.max(rnd(), 1e-12)) * p), u = 2 * Math.PI * rnd(), gr = a * Math.cos(u), gi = a * Math.sin(u);
      for (let n = 0, idx = 0; n < N; n++, idx = (idx + m) % M){ re[q + n] += gr * t.c[idx] - gi * t.s[idx]; im[q + n] += gr * t.s[idx] + gi * t.c[idx]; }
    }
  } else {
    const xr = new Float64Array(M), xi = new Float64Array(M);
    for (let m = 0; m < M; m++){ const p = P[off + m]; if (!(p > 0)) continue; const a = Math.sqrt(-Math.log(Math.max(rnd(), 1e-12)) * p) * M, u = 2 * Math.PI * rnd(); xr[m] = a * Math.cos(u); xi[m] = a * Math.sin(u); }
    fft(xr, xi, true);
    for (let n = 0; n < N; n++){ re[q + n] += xr[n]; im[q + n] += xi[n]; }
  }
}
/* ---------- パルス列の生成（雑音電力 = 1） ---------- */
function simulate(o, opt){
  o = o || S; opt = opt || {};
  const D = derive(o, opt.look), ng = D.ng, N = D.N, re = new Float64Array(ng * N), im = new Float64Array(ng * N);
  const cl = opt.noClutter ? null : clutterModel(o, D), sphi = o.pn < 0 ? Math.pow(10, o.pn / 20) : 0;
  const tg = [0, 1, 2].map(i => tgtInfo(o, D, i)).filter(t => t.on && !opt.noTargets);
  for (let g = 1; g < ng; g++){
    const q = g * N;
    if (cl && cl.pg[g] > 0) synth(cl.P, g * cl.M, cl.M, N, rndFor(o.seed, g, 1), re, im, q);
    for (const t of tg){
      const a = t.A * gateAmp(t.gpos, g, ng); if (!(a > 0)) continue;
      const w = 2 * Math.PI * (t.fd - D.foff) * D.T;
      for (let n = 0; n < N; n++){ re[q + n] += a * Math.cos(w * n + t.ph); im[q + n] += a * Math.sin(w * n + t.ph); }
    }
    if (sphi > 0){                 // 位相雑音：強い信号（クラッタ・目標）に掛かる乗算性の雑音。パルスごと・ゲートごとに独立（白色）とした
      const rnd = rndFor(o.seed, g, 2);
      for (let n = 0; n < N; n += 2){
        const m = sphi * Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))), u = 2 * Math.PI * rnd();
        for (let j = 0; j < 2 && n + j < N; j++){ const ph = m * (j ? Math.sin(u) : Math.cos(u)), c = Math.cos(ph), s = Math.sin(ph), a = re[q + n + j], b = im[q + n + j]; re[q + n + j] = a * c - b * s; im[q + n + j] = a * s + b * c; }
      }
    }
    if (!opt.noNoise){
      const rnd = rndFor(o.seed, g, 0);
      for (let n = 0; n < N; n++){ const m = Math.sqrt(-Math.log(Math.max(rnd(), 1e-12))), u = 2 * Math.PI * rnd(); re[q + n] += m * Math.cos(u); im[q + n] += m * Math.sin(u); }
    }
  }
  return {o, D, ng, N, re, im, cl, tg};
}
/* ---------- ドップラ処理：ゲートごとに重みを掛けて FFT。出力は雑音レベルを 0 dB に規格化（(C+N)/N、図4.5 と同じ見方） ----------
   列は速度の昇順（−PRF/2 … +PRF/2）に並べ替える。ゲート 0（送信中）は NaN */
function rdMap(sim, wt){
  const N = sim.N, ng = sim.ng, w = getWin(N, wt), db = new Float32Array(ng * N), ar = new Float64Array(N), ai = new Float64Array(N);
  let s2 = 0; for (let n = 0; n < N; n++) s2 += w[n] * w[n];
  for (let k = 0; k < N; k++) db[k] = NaN;
  for (let g = 1; g < ng; g++){
    const q = g * N; for (let n = 0; n < N; n++){ ar[n] = sim.re[q + n] * w[n]; ai[n] = sim.im[q + n] * w[n]; }
    fft(ar, ai);
    for (let k = 0; k < N; k++) db[q + ((k + N / 2) % N)] = 10 * Math.log10(Math.max((ar[k] * ar[k] + ai[k] * ai[k]) / s2, 1e-6));
  }
  return {db, ng, N};
}
/* 1つのゲートのスペクトル。os 倍にゼロ詰めして細かく求める（n1 を与えると最初の n1 パルスだけを使う） */
function gateSpectrum(sim, g, wt, os, n1){
  const N = sim.N, n = n1 || N, w = n1 && n1 < N ? null : getWin(N, wt), M = N * (os || 8), ar = new Float64Array(M), ai = new Float64Array(M), q = g * N;
  let s2 = 0; for (let i = 0; i < n; i++){ const wi = w ? w[i] : 1; ar[i] = sim.re[q + i] * wi; ai[i] = sim.im[q + i] * wi; s2 += wi * wi; }
  fft(ar, ai);
  const db = new Float64Array(M); for (let k = 0; k < M; k++) db[(k + M / 2) % M] = 10 * Math.log10(Math.max((ar[k] * ar[k] + ai[k] * ai[k]) / s2, 1e-6));
  return {db, f0: -sim.D.prf / 2, df: sim.D.prf / M, M};
}
/* ---------- あいまいさの解消：折り返しを展開して、複数のPRFで一致するところを探す（式4.9、4.10） ----------
   dets[p] = {ru: あいまいなし間隔, amb: [測定値…]}。lo〜hi の範囲に展開し、幅 2·win の窓の中に M 本以上のPRFの候補が入れば相関成立 */
function unfoldAll(dets, lo, hi){
  const c = [];
  dets.forEach((d, p) => d.amb.forEach((a, di) => { for (let k = Math.ceil((lo - a) / d.ru - 1e-9); a + k * d.ru <= hi + 1e-9; k++) c.push({r: a + k * d.ru, p, di, k}); }));
  return c.sort((x, y) => x.r - y.r);
}
function correlate(dets, lo, hi, win, M){
  const c = unfoldAll(dets, lo, hi), out = []; let lastEnd = -1;
  for (let i = 0; i < c.length; i++){
    let j = i; const seen = new Map(); while (j < c.length && c[j].r <= c[i].r + 2 * win + 1e-9){ if (!seen.has(c[j].p)) seen.set(c[j].p, c[j]); j++; }
    if (seen.size >= M && j - 1 > lastEnd){ const mem = Array.from(seen.values()); out.push({r: mem.reduce((s, m) => s + m.r, 0) / mem.length, mem, count: seen.size}); lastEnd = j - 1; }
  }
  return {cands: c, hits: out};
}
/* 線形FM測距（式4.11）：R = |c·Δf / (2·傾き)| */
const fmRange = (dfHz, slope) => Math.abs(C * dfHz / (2 * slope));
/* M-of-N 検出（式4.26） */
function mOfN(pd, m, n){ let s = 0; const cmb = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }; for (let k = m; k <= n; k++) s += cmb(n, k) * Math.pow(pd, k) * Math.pow(1 - pd, n - k); return s; }
