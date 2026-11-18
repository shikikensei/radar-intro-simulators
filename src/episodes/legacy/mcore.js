'use strict';
/* ============================================================
   計算モデル（コヒーレントなパルス列。距離セルごとにパルスごとの複素サンプル I/Q を作る）
   ============================================================ */
const C = 3e8;                 // 光速 [m/s]
const KT = 1.943844;           // m/s → ノット
const NP = 64;                 // 1ドウェルのパルス数
const NR = 200;                // 距離セル数
const CELL = 150;              // 距離セルの幅 [m]
const KC = 24;                 // クラッタ1セルを作る周波数成分の数
const MINUS = '−';
/* スタガ比（パルス間隔の比）。6:7:8、11:16:13:17、25:30:27:31 はハンドブックの図の例 */
const STAG = {'none': [1], '2:3': [2, 3], '4:5': [4, 5], '9:10': [9, 10], '6:7:8': [6, 7, 8], '11:16:13:17': [11, 16, 13, 17], '25:30:27:31': [25, 30, 27, 31]};
/* 二項係数の重み（p.2.34）。古いパルス → 新しいパルスの順 */
const BINOM = {2: [1, -1], 3: [1, -2, 1], 4: [1, -3, 3, -1]};

/* 共通設定（全ステップで共有） */
const DEFAULTS = {f: 3.0, prf: 1000, order: 2, stag: 'none', cn: 40, sv: 0.12, hits: 0, tr: 12, tv: 30, ts: 15, pj: 0, seed: 1};
const S = Object.assign({}, DEFAULTS);

const db10 = v => 10 * Math.log10(Math.max(v, 1e-30));
const db20 = v => 20 * Math.log10(Math.max(v, 1e-15));

/* 設定から決まる量 */
function derive(o){
  o = o || S;
  const lam = C / (o.f * 1e9), T = 1 / o.prf, vb = lam * o.prf / 2;           // 式(2.1)：VB = λ·fr/2
  const sfInt = 2 * o.sv / lam;                                               // 式(2.14)：σf = 2σv/λ
  const sfScan = o.hits > 0 ? Math.sqrt(Math.LN2) / Math.PI * o.prf / o.hits : 0;   // 式(2.15)：σf = 0.265·fr/n
  const sf = Math.hypot(sfInt, sfScan);                                       // ガウス形どうしは二乗和の平方根（p.2.16）
  return {lam, T, vb, sfInt, sfScan, sf, sfT: sf / o.prf, svEff: sf * lam / 2, fd: 2 * o.tv / lam, x: o.tv / vb, sphi: o.pj * 1e-3,
          ratios: STAG[o.stag] || [1], rt: Math.max(0, Math.min(NR - 1, Math.round(o.tr * 1000 / CELL)))};
}
const gammaOf = r => Math.max.apply(null, r) / Math.min.apply(null, r);
const meanOf = r => r.reduce((a, b) => a + b, 0) / r.length;

/* ---------- キャンセラ（FIR）のタップ ----------
   出力1個は直近 order 個のパルスから作る。スタガのときはパルス間隔の並びごとに組が変わるので、
   周期内の位置ごとに {重み w, パルス時刻 tau（平均周期を1とした単位）} を返す。
   tvw=true のときは時変重み（式2.40、2.41） */
function tapSets(order, ratios, tvw){
  const P = ratios.length, mean = meanOf(ratios), sets = [];
  for (let k = 0; k < P; k++){
    const d = []; for (let i = 0; i < order - 1; i++) d.push(ratios[(k + i) % P] / mean);
    const tau = [0]; for (let i = 0; i < order - 1; i++) tau.push(tau[i] + d[i]);
    let w = BINOM[order].slice();
    if (tvw && order === 3){ const c = d[0] / d[1]; w = [1, -1 - c, c]; }                 // 式(2.40)：A=1, C=T(N-2)/T(N-1), B=-1-C
    if (tvw && order === 4){ const c = 1 + (d[0] + d[2]) / d[1]; w = [1, -c, c, -1]; }    // 式(2.41)：A=1, C=1+(T(N-3)+T(N-1))/T(N-2), B=-C, D=-1
    sets.push({w, tau});
  }
  return sets;
}
function noiseGain(sets){ let g = 0; for (const s of sets) for (const w of s.w) g += w * w; return g / sets.length; }
/* 速度応答（電力）。x = fd·T = V/VB。出力パルスについての平均電力を、雑音の電力利得で正規化（p.2.36, p.2.41 脚注） */
function respPow(sets, x){
  let acc = 0;
  for (const s of sets){ let re = 0, im = 0; for (let i = 0; i < s.w.length; i++){ const p = 2 * Math.PI * x * s.tau[i]; re += s.w[i] * Math.cos(p); im += s.w[i] * Math.sin(p); } acc += re * re + im * im; }
  return acc / sets.length / noiseGain(sets);
}
/* 改善度（クラッタ減衰量）を共分散から直接計算する。
   ガウス形スペクトル（標準偏差 σf）の相関係数は ρ(τ)=exp(−2π²σf²τ²)。パルスごとに独立な位相ふらつき（rms σφ）は相関に exp(−σφ²) を掛ける。
   I = 雑音の電力利得 ÷ 出力クラッタ電力（入力クラッタ電力=1）。式(2.19) */
function clutterOut(sets, sfT, sphi){
  const a = 2 * Math.PI * Math.PI * sfT * sfT, e2 = (sphi || 0) * (sphi || 0); let acc = 0;
  for (const s of sets){
    const n = s.w.length; let sw = 0; for (let i = 0; i < n; i++) sw += s.w[i];
    let p = sw * sw;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++){ const dt = s.tau[j] - s.tau[i]; p += 2 * s.w[i] * s.w[j] * Math.expm1(-a * dt * dt - e2); }
    acc += p;
  }
  return acc / sets.length;
}
function impFactor(sets, sfT, sphi){ const c = clutterOut(sets, sfT, sphi); return c > 0 ? noiseGain(sets) / c : Infinity; }
/* 式(2.23)〜(2.25)：二項係数キャンセラの改善度（ガウス形スペクトル） */
function eqI(order, sfT){ const q = 1 / (2 * Math.PI * sfT); return order === 2 ? 2 * q * q : order === 3 ? 2 * Math.pow(q, 4) : 4 / 3 * Math.pow(q, 6); }
/* 式(2.37)・(2.39)：スタガによる改善度の上限（近似）。n = 0.265/(σf·T) を代入した形 */
function eqStagLimit(gam, sfT){ return 20 * Math.log10(2.5 * (Math.sqrt(Math.LN2) / Math.PI) / ((gam - 1) * sfT)); }
/* 独立な要因の残留電力は足し合わせる（p.2.72） */
function combineI(){ let s = 0; for (const v of arguments) s += 1 / v; return 1 / s; }

/* ---------- 固定シードの乱数 ---------- */
function mulberry32(a){
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function gaussFill(rnd, a, b){       // a（と b）を標準正規乱数で埋める
  for (let i = 0; i < a.length; i++){ const m = Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))), p = 2 * Math.PI * rnd(); a[i] = m * Math.cos(p); if (b) b[i] = m * Math.sin(p); }
}
/* クラッタの距離プロファイル（電力の相対値。設定の C/N を 0 dB とする）。乱数によらず固定 */
function clutterProfile(nr){
  const a = new Float64Array(nr);
  for (let r = 0; r < nr; r++){
    const km = r * CELL / 1000; let d = -Infinity;
    if (km >= 3 && km <= 16.5) d = Math.min(0, (km - 3) * 12 - 18, (16.5 - km) * 12 - 18);      // 主なクラッタ域（4.5〜15 km が平坦部）
    else if (km >= 20.5 && km <= 25) d = Math.min(-15, (km - 20.5) * 20 - 30, (25 - km) * 20 - 30);   // 弱いクラッタ域
    a[r] = isFinite(d) ? Math.pow(10, d / 10) : 0;
  }
  return a;
}
const _base = new Map();
function baseRand(seed, nr, np){
  const key = seed + '/' + nr + '/' + np; let b = _base.get(key);
  if (!b){
    const rnd = mulberry32(48271 + 7919 * seed);
    b = {z: new Float64Array(nr * KC), gr: new Float64Array(nr * KC), gi: new Float64Array(nr * KC), nr_: new Float64Array(nr * np), ni: new Float64Array(nr * np), u: new Float64Array(np), ph0: 2 * Math.PI * rnd()};
    gaussFill(rnd, b.z); gaussFill(rnd, b.gr, b.gi); gaussFill(rnd, b.nr_, b.ni); gaussFill(rnd, b.u);
    const k1 = Math.sqrt(0.5 / KC), k2 = Math.SQRT1_2;
    for (let i = 0; i < b.gr.length; i++){ b.gr[i] *= k1; b.gi[i] *= k1; }
    for (let i = 0; i < b.nr_.length; i++){ b.nr_[i] *= k2; b.ni[i] *= k2; }
    if (_base.size > 12) _base.clear();
    _base.set(key, b);
  }
  return b;
}
/* ---------- パルス列の生成 ----------
   雑音電力を 1（0 dB）とする。クラッタ：各セルで KC 本の正弦波（周波数は標準偏差 σf のガウス分布、複素振幅はガウス）の和。
   目標：振幅一定、位相が 2π·fd·t で回転。送信位相のふらつき：パルスごとに独立（rms σφ）で、そのパルスの全エコーに共通 */
function simulate(o, opt){
  o = o || S; opt = opt || {};
  const nr = opt.nr || NR, np = opt.np || NP, D = derive(o), ratios = opt.uniform ? [1] : D.ratios, P = ratios.length, mean = meanOf(ratios);
  const b = baseRand(o.seed, nr, np), t = new Float64Array(np), phi = new Float64Array(np);
  for (let n = 1; n < np; n++) t[n] = t[n - 1] + ratios[(n - 1) % P] / mean * D.T;
  for (let n = 0; n < np; n++) phi[n] = D.sphi * b.u[n];
  const prof = opt.flat ? new Float64Array(nr).fill(1) : clutterProfile(nr), Ac = Math.pow(10, o.cn / 20), At = Math.pow(10, o.ts / 20);
  const cr = new Float64Array(nr * np), ci = new Float64Array(nr * np), w2 = 2 * Math.PI * D.sf;
  for (let r = 0; r < nr; r++){
    if (!(prof[r] > 0)) continue;
    const amp = Ac * Math.sqrt(prof[r]), o0 = r * KC, q0 = r * np;
    for (let n = 0; n < np; n++){
      let sr = 0, si = 0; const tn = t[n];
      for (let k = 0; k < KC; k++){ const p = w2 * b.z[o0 + k] * tn, c = Math.cos(p), s = Math.sin(p); sr += b.gr[o0 + k] * c - b.gi[o0 + k] * s; si += b.gr[o0 + k] * s + b.gi[o0 + k] * c; }
      const c = Math.cos(phi[n]), s = Math.sin(phi[n]);
      cr[q0 + n] = amp * (sr * c - si * s); ci[q0 + n] = amp * (sr * s + si * c);
    }
  }
  const sr = new Float64Array(np), si = new Float64Array(np), rt = Math.min(nr - 1, D.rt);
  for (let n = 0; n < np; n++){ const p = 2 * Math.PI * D.fd * t[n] + b.ph0 + phi[n]; sr[n] = At * Math.cos(p); si[n] = At * Math.sin(p); }
  return {o, D, nr, np, t, phi, prof, Ac, At, rt, ratios, cr, ci, sr, si, nre: b.nr_, nim: b.ni};
}
/* 合成信号（クラッタ＋目標＋雑音） */
function totalOf(sim, parts){
  parts = parts || 'cns'; const n = sim.nr * sim.np, re = new Float64Array(n), im = new Float64Array(n);
  if (parts.indexOf('c') >= 0) for (let i = 0; i < n; i++){ re[i] += sim.cr[i]; im[i] += sim.ci[i]; }
  if (parts.indexOf('n') >= 0) for (let i = 0; i < n; i++){ re[i] += sim.nre[i]; im[i] += sim.nim[i]; }
  if (parts.indexOf('s') >= 0){ const q = sim.rt * sim.np; for (let k = 0; k < sim.np; k++){ re[q + k] += sim.sr[k]; im[q + k] += sim.si[k]; } }
  return {re, im};
}
/* MTI（キャンセラ）を全セルに適用。雑音レベルが変わらないよう、雑音の電力利得の平方根で割る。先頭の order−1 パルスは出力なし（0） */
function mtiApply(x, nr, np, order, ratios, tvw){
  const sets = tapSets(order, ratios, tvw), P = sets.length, g = 1 / Math.sqrt(noiseGain(sets)), re = new Float64Array(nr * np), im = new Float64Array(nr * np);
  for (let r = 0; r < nr; r++){
    const q = r * np;
    for (let n = order - 1; n < np; n++){
      const m = n - order + 1, w = sets[m % P].w; let a = 0, c = 0;
      for (let i = 0; i < order; i++){ a += w[i] * x.re[q + m + i]; c += w[i] * x.im[q + m + i]; }
      re[q + n] = a * g; im[q + n] = c * g;
    }
  }
  return {re, im, first: order - 1};
}
/* セルごとの平均電力（ドウェル内のパルスについて平均）[線形] */
function cellPower(x, nr, np, first, single){
  const p = new Float64Array(nr); first = first || 0;
  for (let r = 0; r < nr; r++){
    const q = r * np;
    if (single){ const i = q + np - 1; p[r] = x.re[i] * x.re[i] + x.im[i] * x.im[i]; continue; }
    let s = 0; for (let n = first; n < np; n++) s += x.re[q + n] * x.re[q + n] + x.im[q + n] * x.im[q + n];
    p[r] = s / (np - first);
  }
  return p;
}
/* 実測の改善度：クラッタ成分だけを取り出し、キャンセラ前後の電力比を全クラッタセルで平均（出力は雑音利得で正規化済み） */
function measureI(sim, order, ratios, tvw){
  const c = {re: sim.cr, im: sim.ci}, y = mtiApply(c, sim.nr, sim.np, order, ratios, tvw);
  const pin = cellPower(c, sim.nr, sim.np, 0), pout = cellPower(y, sim.nr, sim.np, y.first);
  let a = 0, b = 0; for (let r = 0; r < sim.nr; r++){ if (sim.prof[r] > 0){ a += pin[r]; b += pout[r]; } }
  return b > 0 ? a / b : Infinity;
}

/* ---------- ドップラフィルタバンク（ステップ10） ---------- */
/* ドルフ・チェビシェフ重み（N は奇数、サイドローブ slDb [dB]） */
function chebWin(N, slDb){
  const R = Math.pow(10, slDb / 20), M = N - 1, x0 = Math.cosh(Math.acosh(R) / M), w = new Float64Array(N);
  const Tm = x => Math.abs(x) <= 1 ? Math.cos(M * Math.acos(x)) : (x > 0 || M % 2 === 0 ? 1 : -1) * Math.cosh(M * Math.acosh(Math.abs(x)));
  let mx = 0;
  for (let n = 0; n < N; n++){ let s = 0; for (let k = 0; k < N; k++) s += Tm(x0 * Math.cos(Math.PI * k / N)) * Math.cos(2 * Math.PI * k * (n - M / 2) / N); w[n] = s; mx = Math.max(mx, Math.abs(s)); }
  for (let n = 0; n < N; n++) w[n] /= mx;
  return w;
}
/* 1本のフィルタの応答（電力、雑音利得で正規化）。x = fd/PRF、中心 xc */
function bankResp(win, xc, x){
  let re = 0, im = 0, g = 0; for (let n = 0; n < win.length; n++){ const p = 2 * Math.PI * (x - xc) * n; re += win[n] * Math.cos(p); im += win[n] * Math.sin(p); g += win[n] * win[n]; }
  return (re * re + im * im) / g;
}
function winMismatchDb(win){ let s = 0, g = 0; for (const v of win){ s += v; g += v * v; } return 10 * Math.log10(win.length * g / (s * s)); }
function winPeakSidelobeDb(win){
  const pk = bankResp(win, 0, 0); let prev = pk, x = 0, down = true, sl = 0;
  for (x = 0.0005; x <= 0.5; x += 0.0005){ const v = bankResp(win, 0, x); if (down && v > prev) down = false; if (!down) sl = Math.max(sl, v); prev = v; }
  return 10 * Math.log10(sl / pk);
}

/* ---------- クラッタマップ（ステップ10）：式(2.61)、(2.62) ---------- */
function clutterMapDemo(alpha, ktDb, seed){
  const n = 60, rnd = mulberry32(977 + 31 * seed), x = new Float64Array(n), y = new Float64Array(n), th = new Float64Array(n), det = [];
  const kt = Math.pow(10, ktDb / 20), ray = m => m * Math.sqrt(-Math.log(Math.max(rnd(), 1e-12)));     // レイリー分布（2乗平均 m²）
  let map = 1;
  for (let i = 0; i < n; i++){
    let v = ray(1);                                       // 雑音（振幅の rms = 1）
    if (i >= 9) v = Math.hypot(v, ray(10));               // 10スキャン目から、雑音より 20 dB 強い消え残りが現れる
    if (i === 39) v = Math.hypot(v, 56);                  // 40スキャン目に、消え残りより 15 dB 強い目標が1回だけ通過
    x[i] = v; th[i] = kt * map;
    if (v >= th[i]) det.push(i);                          // 式(2.62)：x(i) ≥ kT·y(i−1)
    map = (1 - alpha) * map + alpha * v; y[i] = map;      // 式(2.61)：y(i) = (1−α)·y(i−1) + α·x(i)
  }
  return {n, x, y, th, det};
}

/* ============================================================
   ハンドブックの式・記載値との照合（共通設定とは独立した固定条件）
   ============================================================ */
function runChecks(){
  const out = [];
  const add = (item, cond, meas, ref, unit, tol, src, note) => out.push({item, cond, meas, ref, unit, tol, src, note: note || '', ok: tol === null ? null : Math.abs(meas - ref) <= tol});
  const U = o => tapSets(o, [1], false);
  /* 1) キャンセラの速度応答：電圧応答 2^n·sin^n(π·fd·T)（p.2.34） */
  for (const o of [2, 3]){
    const n = o - 1, g = noiseGain(U(o)); let e = 0;
    for (let x = 0; x <= 2; x += 0.01) e = Math.max(e, Math.abs(respPow(U(o), x) - Math.pow(2 * Math.abs(Math.sin(Math.PI * x)), 2 * n) / g));
    add(o + 'パルスキャンセラ：速度応答の式との最大差', 'V/VB = 0〜2 を 0.01 刻み（電力、雑音利得で正規化）', e, 0, '', 1e-9, '2ⁿ·sinⁿ(π·fd·T), p.2.34');
  }
  add('2パルスキャンセラ：応答のピーク', 'V = VB/2', db10(respPow(U(2), 0.5)), 3.01, 'dB', 0.02, '図2.10（+3 dB）, p.2.10');
  add('3パルスキャンセラ：応答のピーク', 'V = VB/2', db10(respPow(U(3), 0.5)), 4.26, 'dB', 0.01, '4/√6 = 4.26 dB, p.2.68');
  /* 2) ブラインド速度：式(2.1)、(2.2)、図2.10 */
  {
    const o = Object.assign({}, DEFAULTS, {f: 1.3, prf: 400}), D = derive(o);
    let xb = 0; for (let x = 0.5; x <= 1.5; x += 0.0005){ if (respPow(U(2), x) < 1e-9){ xb = x; break; } }
    add('ブラインド速度（応答が0になる最初の速度）', '1300 MHz, PRF 400 Hz, 2パルス', xb * D.vb * KT, 89, 'ノット', 1.0, '式2.1, 図2.10（89ノット）', 'λ = c/f で計算。式2.2（0.29·fr/fGHz）では ' + (0.29 * 400 / 1.3).toFixed(1) + ' ノット');
    add('同：ブラインドになるドップラ周波数', '同上', xb * 400, 400, 'Hz', 0.5, '図2.10（PRF の整数倍）, p.2.10');
    const sim = simulate(Object.assign({}, DEFAULTS, {tv: derive(DEFAULTS).vb, cn: -200, ts: 20}), {uniform: true});
    const s = {re: new Float64Array(sim.nr * sim.np), im: new Float64Array(sim.nr * sim.np)}; s.re.set(sim.sr, sim.rt * sim.np); s.im.set(sim.si, sim.rt * sim.np);
    const y = mtiApply(s, sim.nr, sim.np, 2, [1]), po = cellPower(y, sim.nr, sim.np, 1)[sim.rt];
    add('シミュレーション：V = VB の目標のキャンセラ出力', '3 GHz, PRF 1 kHz, 目標 50 m/s（入力比）', Math.max(-200, db10(po / (sim.At * sim.At))), -200, 'dB', 60, '式2.1', '理論上は −∞。数値誤差の範囲で 0');
    const sim2 = simulate(Object.assign({}, DEFAULTS, {tv: derive(DEFAULTS).vb / 2, cn: -200, ts: 20}), {uniform: true});
    const s2 = {re: new Float64Array(sim2.nr * sim2.np), im: new Float64Array(sim2.nr * sim2.np)}; s2.re.set(sim2.sr, sim2.rt * sim2.np); s2.im.set(sim2.si, sim2.rt * sim2.np);
    add('シミュレーション：V = VB/2 の目標のキャンセラ出力', '同上、目標 25 m/s（入力比）', db10(cellPower(mtiApply(s2, sim2.nr, sim2.np, 2, [1]), sim2.nr, sim2.np, 1)[sim2.rt] / (sim2.At * sim2.At)), 3.01, 'dB', 0.02, '図2.10');
  }
  /* 3) ノッチの幅とミスマッチ損失（p.2.38, p.2.23） */
  {
    const hb = {2: 24, 3: 36, 4: 45};
    for (const o of [2, 3, 4]){ let c = 0, n = 0; for (let x = 0.00025; x < 1; x += 0.0005){ n++; if (respPow(U(o), x) < 0.2512) c++; }
      add(o + 'パルスキャンセラ：ノッチの幅', '平均応答より 6 dB 以上低い範囲の割合', 100 * c / n, hb[o], '%', 1.5, 'p.2.38'); }
    const ml = o => { const w = BINOM[o]; let s = 0, g = 0; for (const v of w){ s += Math.abs(v); g += v * v; } return 10 * Math.log10(o * g / (s * s)); };
    add('3パルス（二項係数）：フィルタのミスマッチ損失', 'N·Σw²/(Σ|w|)²', ml(3), 0.51, 'dB', 0.01, 'p.2.23');
    add('4パルス（二項係数）：フィルタのミスマッチ損失', '同上', ml(4), 0.97, 'dB', 0.01, 'p.2.23');
  }
  /* 4) クラッタのスペクトル拡がりと改善度：式(2.23)〜(2.28) */
  for (const o of [2, 3, 4]) add(o + 'パルス：改善度（共分散から計算）と式の比較', 'σf·T = 0.01（ガウス形）', db10(impFactor(U(o), 0.01)), db10(eqI(o, 0.01)), 'dB', 0.05, '式2.' + (21 + o) + ', p.2.23');
  {
    const n = 14.4, sfT = Math.sqrt(Math.LN2) / Math.PI / n, ref = {2: n * n / 1.39, 3: Math.pow(n, 4) / 3.84, 4: Math.pow(n, 6) / 16.0}, fig = {2: 21.3, 3: 39.9, 4: 56.6};
    for (const o of [2, 3, 4]) add(o + 'パルス：走査変調による改善度の上限', 'ビーム内ヒット数 n = 14.4（σf·T = 0.265/n）', db10(impFactor(U(o), sfT)), db10(ref[o]), 'dB', 0.3, '式2.' + (24 + o) + ', p.2.23', '図2.' + (32 + o) + ' の表示値は ' + fig[o] + ' dB（sin U/U 形のビームで計算した値）');
  }
  {
    const o = Object.assign({}, DEFAULTS, {f: 3, prf: 1000, sv: 0.5, cn: 40}), D = derive(o), sim = simulate(o, {uniform: true, flat: true, np: 256});
    for (const od of [2, 3]) add('シミュレーション実測：' + od + 'パルスの改善度', '3 GHz, PRF 1 kHz, σv = 0.5 m/s（200セル×256パルス）', db10(measureI(sim, od, [1])), db10(impFactor(U(od), D.sfT)), 'dB', 1.5, '式2.19・式2.' + (21 + od), '乱数で作ったクラッタなので統計的なばらつきがある');
  }
  /* 5) スタガPRF：最初の真のブラインド速度（式2.36）と応答 */
  for (const r of [[6, 7, 8], [11, 16, 13, 17], [25, 30, 27, 31], [53, 58, 55, 59], [51, 62, 53, 61, 58]]){
    const sets = tapSets(3, r, false); let xb = 0;
    for (let i = 100; i <= 26000; i++){ const x = i * 0.0025; if (respPow(sets, x) < 1e-7){ xb = x; break; } }
    add('スタガ ' + r.join(':') + '：最初の真のブラインド速度 V/VB', '3パルスキャンセラ、応答が0になる最初の点', xb, meanOf(r), '', 0.003, '式2.36, p.2.41–2.43');
  }
  add('スタガ 6:7:8：V = VB での応答', '3パルス（2重）キャンセラ、帰還なし', db10(respPow(tapSets(3, [6, 7, 8], false), 1)), -6, 'dB', 0.3, 'p.2.43');
  {
    let p = 0; for (const k of [6, 7, 8]) p += respPow(U(3), k / 7); 
    add('（参考）スキャンごとに周期を変える場合の V = VB での応答', '周期 6:7:8 の3スキャンの平均電力、3パルス', db10(p / 3), -12.5, 'dB', null, 'p.2.43', 'ハンドブックはビーム内 14.4 ヒットの走査を含む計算');
    const fig = {1.1: 13, 1.2: 9, 1.3: 7, 1.5: 5};
    for (const g of [1.1, 1.2, 1.3, 1.5]){ const sets = tapSets(2, [10, 10 * g], false); let mn = 1e9; for (let x = 0.7; x <= 1.3; x += 0.001) mn = Math.min(mn, respPow(sets, x));
      add('（参考）2周期スタガ γ=' + g + '：最初の谷の深さ', '2パルスキャンセラ、V≈VB 付近の最小値', -db10(mn), fig[g], 'dB', null, '図2.45（図からの読み取り、近似曲線）', g >= 1.3 ? '図は複数の周期比についての近似。γが大きいと差が出る' : ''); }
  }
  /* 6) スタガによる改善度の上限：式(2.37) と p.2.44 の例 */
  {
    const sfT = Math.sqrt(Math.LN2) / Math.PI / 14.4;
    add('式(2.37)：スタガ＋走査による改善度の上限', 'n = 14.4, γ = 1.5', eqStagLimit(1.5, sfT), 37.2, 'dB', 0.1, '式2.37, p.2.44');
    add('4パルス・スタガ 6:9:7:8：改善度（共分散から計算）', 'n = 14.4（ガウス形スペクトルで計算）', db10(impFactor(tapSets(4, [6, 9, 7, 8], false), sfT)), 36.5, 'dB', 1.5, 'p.2.44（実際の上限 36.5 dB）');
    add('4パルス・スタガ 6:8:9:7：改善度（共分散から計算）', '同上', db10(impFactor(tapSets(4, [6, 8, 9, 7], false), sfT)), 41.1, 'dB', 1.5, 'p.2.44（41.1 dB）');
    add('同 6:9:7:8 に時変重みを使った場合', '式(2.41) の重み', db10(impFactor(tapSets(4, [6, 9, 7, 8], true), sfT)), db10(impFactor(U(4), sfT)), 'dB', null, '式2.41, p.2.44–2.45', '比較値はスタガなしの4パルス。スタガによる上限が取り除かれる');
  }
  /* 7) 位相のふらつきによる改善度の上限：I = 20 log(1/Δφ)（表2.5） */
  add('位相のふらつき 0.01 rad：改善度の上限', '2パルス、クラッタの拡がりなし（共分散から計算）', db10(impFactor(U(2), 0, 0.01)), 40, 'dB', 0.01, 'p.2.66, 表2.5');
  add('位相のふらつき 1/316 rad（0.18°）：改善度の上限', '3パルス、同上', db10(impFactor(U(3), 0, 1 / 316)), 50, 'dB', 0.01, '式2.51, p.2.73');
  {
    const o = Object.assign({}, DEFAULTS, {sv: 0, hits: 0, pj: 10, cn: 40}), sim = simulate(o, {uniform: true, flat: true, nr: 8, np: 4096});
    add('シミュレーション実測：位相のふらつき 0.01 rad', '2パルス、クラッタは完全に静止（4096パルス）', db10(measureI(sim, 2, [1])), 40, 'dB', 0.5, 'p.2.66, 表2.5');
    const sim3 = simulate(Object.assign({}, o, {seed: 2}), {uniform: true, flat: true, nr: 8, np: 4096});
    add('同：4パルスキャンセラ', '同上（上限はキャンセラの段数によらない）', db10(measureI(sim3, 4, [1])), 40, 'dB', 0.5, '表2.5');
  }
  add('A/D変換の量子化による上限（10ビット）', '20 log[(2ᴺ−1)·√0.75]', 20 * Math.log10(1023 * Math.sqrt(0.75)), 59.0, 'dB', 0.06, '表2.6, p.2.74');
  add('同（16ビット）', '同上', 20 * Math.log10(65535 * Math.sqrt(0.75)), 95.1, 'dB', 0.06, '表2.6, p.2.74');
  /* 8) その他 */
  add('指数形モデルの形状パラメータ β = √2/σv', 'σv = 0.25 m/s（強い風）', Math.SQRT2 / 0.25, 5.7, '(m/s)⁻¹', 0.06, '式2.13, 表2.1');
  add('チェビシェフ重み（9パルス）：ドップラサイドローブ', '設計値 68 dB のフィルタの最大サイドローブ', winPeakSidelobeDb(chebWin(9, 68)), -68, 'dB', 0.1, '図2.54, p.2.54');
  add('クラッタマップの実効的な平均回数 Leff = (2−α)/α', 'α = 0.125', (2 - 0.125) / 0.125, 15, '', 0.001, '式2.63, p.2.85');
  /* 参考：式が成り立たなくなる例 */
  for (const o of [2, 4]) add('（参考）' + o + 'パルス：拡がりが大きい場合の式との差', 'σf·T = 0.1', db10(impFactor(U(o), 0.1)), db10(eqI(o, 0.1)), 'dB', null, '式2.' + (21 + o), '式は σf·T ≪ 1 の近似。拡がりが大きいと合わない');
  return out;
}
if (typeof module !== 'undefined') module.exports = {S, DEFAULTS, derive, tapSets, respPow, impFactor, eqI, simulate, totalOf, mtiApply, cellPower, measureI, runChecks, chebWin, winMismatchDb, winPeakSidelobeDb, clutterMapDemo, db10, noiseGain, eqStagLimit, STAG};
