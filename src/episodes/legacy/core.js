'use strict';
/* ============================================================
   計算モデル（複素ベースバンド、サンプリング周波数は固定）
   ============================================================ */
const FS = 10e6;          // サンプリング周波数 [Hz]（固定）
const C = 3e8;            // 光速 [m/s]（150 m/µs）
const L = 4096;           // 受信系列の長さ [サンプル]（409.6 µs ≒ 61 km）
const NF = 8192;          // パルス圧縮に使うFFT長
const MINUS = '−';
/* テイラー重み付け（−40 dB, n̄=6）の係数 F1〜F5：ハンドブック p.8.8 */
const TAYLOR = [0.389116, -0.00945245, 0.00488172, -0.00161019, 0.000347037];
/* 既知の2値バーカー符号：ハンドブック 表8.4（p.8.17） */
const BARKER = {2:'10', 3:'110', 4:'1101', 5:'11101', 7:'1110010', 11:'11100010010', 13:'1111100110101'};

/* 共通設定（全ステップで共有） */
const DEFAULTS = {wave:'lfm', T:40, B:2, wt:'none', r1:20, a1:0, t2:true, dr:600, a2:0, noise:false, snr:-10, fd:0, seed:1};
const S = Object.assign({}, DEFAULTS);

const db = v => 20 * Math.log10(Math.max(v, 1e-12));
const db2a = d => Math.pow(10, d / 20);

/* ---------- FFT（基数2、インプレース） ---------- */
const _tw = new Map();
function _tables(n){
  let t = _tw.get(n);
  if (!t){
    const c = new Float64Array(n/2), s = new Float64Array(n/2), r = new Uint32Array(n);
    for (let i = 0; i < n/2; i++){ c[i] = Math.cos(2*Math.PI*i/n); s[i] = Math.sin(2*Math.PI*i/n); }
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
        const wr = c[k], wi = inv ? s[k] : -s[k];
        const a = i + j, b = a + half;
        const xr = re[b]*wr - im[b]*wi, xi = re[b]*wi + im[b]*wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
  }
  if (inv){ for (let i = 0; i < n; i++){ re[i] /= n; im[i] /= n; } }
}

/* ---------- 固定シードの乱数（毎回同じ雑音を再現） ---------- */
function mulberry32(a){
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const _nz = new Map();
function noiseSeq(seed){            // 分散1の複素ガウス雑音（I, Q それぞれ分散 1/2）
  let z = _nz.get(seed);
  if (!z){
    const rnd = mulberry32(20081 + 7919 * seed), re = new Float64Array(L), im = new Float64Array(L);
    for (let n = 0; n < L; n++){
      const u1 = Math.max(rnd(), 1e-12), u2 = rnd(), m = Math.sqrt(-Math.log(u1));
      re[n] = m * Math.cos(2*Math.PI*u2); im[n] = m * Math.sin(2*Math.PI*u2);
    }
    z = {re, im}; _nz.set(seed, z);
  }
  return z;
}

/* ---------- 送信波形（複素包絡） ---------- */
function makeWave(kind, Tus, Bmhz, codeLen){
  let N = Math.max(2, Math.round(Tus * 1e-6 * FS));
  const w = {kind};
  if (kind === 'barker'){
    const code = BARKER[codeLen || 13], nc = code.length, chip = Math.max(1, Math.round(N / nc));
    N = chip * nc; w.chip = chip; w.code = code; w.nc = nc; w.Beq = FS / chip; w.TB = nc;
    w.at = t => [code.charAt(Math.min(nc - 1, Math.max(0, Math.floor(t * FS / chip + 1e-7)))) === '1' ? 1 : -1, 0];
  } else if (kind === 'lfm'){
    const T = N / FS, al = Bmhz * 1e6 / T;       // アップチャープ：傾き α = +B/T
    w.alpha = al; w.Beq = Bmhz * 1e6; w.TB = T * w.Beq;
    w.at = t => { const d = t - T/2, p = Math.PI * al * d * d; return [Math.cos(p), Math.sin(p)]; };
  } else {
    w.Beq = FS / N; w.TB = 1;
    w.at = t => [1, 0];
  }
  w.N = N; w.T = N / FS; w.re = new Float64Array(N); w.im = new Float64Array(N);
  for (let n = 0; n < N; n++){ const v = w.at(n / FS); w.re[n] = v[0]; w.im[n] = v[1]; }
  return w;
}

/* ---------- テイラー重み付け W(f)（式8.10、帯域外は0） ---------- */
function taylorAt(f, B){
  if (Math.abs(f) > B/2 * (1 + 1e-9)) return 0;
  let g = 1; for (let m = 0; m < TAYLOR.length; m++) g += 2 * TAYLOR[m] * Math.cos(2*Math.PI*(m+1)*f/B);
  return g;
}
const binFreq = (k, n) => (k < n/2 ? k : k - n) * FS / n;

/* ---------- 目標 ---------- */
function getTargets(){
  const t = [{R: S.r1 * 1000, A: db2a(S.a1), ph: 0, name: '目標1'}];
  if (S.t2) t.push({R: S.r1 * 1000 + S.dr, A: db2a(S.a2), ph: Math.PI/2, name: '目標2'});
  return t;
}

/* ---------- 受信信号の生成 ----------
   エコー = A·u(t−td)·exp(j2πfd(t−td))（式8.41の形。搬送波位相は目標ごとの定数 ph とした） */
function makeScene(w, o){
  o = o || {};
  const re = new Float64Array(L), im = new Float64Array(L);
  const fd = (o.fd !== undefined ? o.fd : S.fd * 1e3);
  for (const tg of (o.targets || getTargets())){
    const td = 2 * tg.R / C, n0 = Math.max(0, Math.ceil(td * FS - 1e-7));
    const cp = Math.cos(tg.ph), sp = Math.sin(tg.ph);
    for (let n = n0; n < L; n++){
      const t = Math.max(0, n / FS - td);
      if (t >= w.T - 1e-12) break;
      const u = w.at(t), d = 2*Math.PI*fd*t, cr = Math.cos(d), ci = Math.sin(d);
      const xr = u[0]*cr - u[1]*ci, xi = u[0]*ci + u[1]*cr;
      re[n] += tg.A * (xr*cp - xi*sp); im[n] += tg.A * (xr*sp + xi*cp);
    }
  }
  if (o.noise){
    const sg = Math.pow(10, -S.snr / 20), z = noiseSeq(S.seed);
    for (let n = 0; n < L; n++){ re[n] += sg * z.re[n]; im[n] += sg * z.im[n]; }
  }
  if (o.eclipse){ for (let n = 0; n < w.N && n < L; n++){ re[n] = 0; im[n] = 0; } }   // 送信中は受信機オフ
  return {re, im};
}

/* ---------- パルス圧縮（周波数領域で実行） ----------
   y[m] = (1/N) Σ r[n+m]·u*[n]。wt='taylor' なら整合フィルタの後に W(f) を掛ける。
   up>1 のときはスペクトルにゼロを詰めて up 倍に補間する（表示・計測用） */
function compress(sc, w, wt, up){
  up = up || 1;
  const ar = new Float64Array(NF), ai = new Float64Array(NF), ur = new Float64Array(NF), ui = new Float64Array(NF);
  ar.set(sc.re); ai.set(sc.im); ur.set(w.re); ui.set(w.im);
  fft(ar, ai); fft(ur, ui);
  const M = NF * up, yr = new Float64Array(M), yi = new Float64Array(M), E = w.N;
  for (let k = 0; k < NF; k++){
    let pr = (ar[k]*ur[k] + ai[k]*ui[k]) / E, pi = (ai[k]*ur[k] - ar[k]*ui[k]) / E;
    if (wt === 'taylor'){ const g = taylorAt(binFreq(k, NF), w.Beq); pr *= g; pi *= g; }
    const kk = k < NF/2 ? k : k + M - NF; yr[kk] = pr; yi[kk] = pi;
  }
  fft(yr, yi, true);
  const n = L * up, mag = new Float64Array(n);
  for (let i = 0; i < n; i++){ yr[i] *= up; yi[i] *= up; mag[i] = Math.hypot(yr[i], yi[i]); }
  return {re: yr, im: yi, mag, n, dt: 1 / (FS * up), up};
}

/* 時間領域の相関（ステップ10の比較用）：定義どおりに掛けて足す */
function correlateDirect(sc, w){
  const N = w.N, yr = new Float64Array(L), yi = new Float64Array(L), mag = new Float64Array(L);
  for (let m = 0; m < L; m++){
    let sr = 0, si = 0; const nmax = Math.min(N, L - m);
    for (let n = 0; n < nmax; n++){ const a = sc.re[m+n], b = sc.im[m+n], c = w.re[n], d = w.im[n]; sr += a*c + b*d; si += b*c - a*d; }
    yr[m] = sr / N; yi[m] = si / N; mag[m] = Math.hypot(yr[m], yi[m]);
  }
  return {re: yr, im: yi, mag, n: L, dt: 1 / FS, up: 1};
}

/* ---------- 単一目標の応答（雑音なしの解析用） ----------
   ずれ量 τ=0 を中心に ±T の範囲。LFM は8倍補間、矩形チップの波形は補間なし。
   lost：先頭の lost サンプルが受信できなかった場合（エクリプシング） */
const NA0 = 4096;
function response(w, fdHz, wt, lost){
  fdHz = fdHz || 0; lost = lost || 0;
  const up = w.kind === 'lfm' ? 8 : 1, N = w.N;
  let NA = NA0; while (NA < 2*N + 2) NA *= 2;
  const ar = new Float64Array(NA), ai = new Float64Array(NA), ur = new Float64Array(NA), ui = new Float64Array(NA);
  for (let n = 0; n < N; n++){
    ur[n] = w.re[n]; ui[n] = w.im[n];
    if (n < lost) continue;
    const d = 2*Math.PI*fdHz*n/FS, c = Math.cos(d), s = Math.sin(d);
    ar[n] = w.re[n]*c - w.im[n]*s; ai[n] = w.re[n]*s + w.im[n]*c;
  }
  fft(ar, ai); fft(ur, ui);
  const M = NA * up, yr = new Float64Array(M), yi = new Float64Array(M);
  let eAll = 0, eW = 0, eW2 = 0;
  for (let k = 0; k < NA; k++){
    const p = ur[k]*ur[k] + ui[k]*ui[k]; eAll += p;
    let pr = (ar[k]*ur[k] + ai[k]*ui[k]) / N, pi = (ai[k]*ur[k] - ar[k]*ui[k]) / N;
    if (wt === 'taylor'){ const g = taylorAt(binFreq(k, NA), w.Beq); pr *= g; pi *= g; eW += p*g; eW2 += p*g*g; }
    const kk = k < NA/2 ? k : k + M - NA; yr[kk] = pr; yi[kk] = pi;
  }
  fft(yr, yi, true);
  const half = N * up, n = 2*half + 1, mag = new Float64Array(n);
  for (let j = -half; j <= half; j++){ const i = (j + M) % M; mag[j + half] = Math.hypot(yr[i], yi[i]) * up; }
  /* ミスマッチ損失（式8.46）：整合フィルタのS/N ÷ 重み付け後のS/N */
  const lossDb = wt === 'taylor' ? 10 * Math.log10(eAll * eW2 / (eW * eW)) : 0;
  return {x0: -N / FS, dx: 1 / (FS * up), mag, n, up, lossDb};
}

/* 式(8.11)：テイラー重み付け後の圧縮パルス（TB≫1の理論形）。x = B·t */
const sinc = x => Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI*x) / (Math.PI*x);
function taylorTheory(x){
  let y = sinc(x); for (let m = 0; m < TAYLOR.length; m++) y += TAYLOR[m] * (sinc(x + m + 1) + sinc(x - m - 1));
  return Math.abs(y);
}
function theoryResp(fn, xmax, dx){   // 一様グリッド上の理論曲線を response() と同じ形で返す
  const half = Math.round(xmax / dx), n = 2*half + 1, mag = new Float64Array(n);
  for (let i = 0; i < n; i++) mag[i] = fn((i - half) * dx);
  return {x0: -half * dx, dx, mag, n};
}

/* ---------- 応答の計測：ピーク位置、3 dB幅・6 dB幅、ピークサイドローブ ---------- */
function metrics(r){
  const m = r.mag, n = r.n; let ip = 0;
  for (let i = 1; i < n; i++) if (m[i] > m[ip]) ip = i;
  const pk = m[ip];
  let a = ip, b = ip;
  while (a > 0 && m[a-1] < m[a]) a--;
  while (b < n-1 && m[b+1] < m[b]) b++;
  let sl = 0, isl = -1;
  for (let i = 0; i < n; i++){ if (i >= a && i <= b) continue; if (m[i] > sl){ sl = m[i]; isl = i; } }
  const cross = lv => {
    const th = pk * lv; let i = ip, j = ip;
    while (i > 0 && m[i] >= th) i--;
    while (j < n-1 && m[j] >= th) j++;
    const xl = (m[i] >= th) ? i : i + (th - m[i]) / (m[i+1] - m[i]);
    const xr = (m[j] >= th) ? j : j - (th - m[j]) / (m[j-1] - m[j]);
    return (xr - xl) * r.dx;
  };
  let off = 0;
  if (ip > 0 && ip < n-1){ const y0 = m[ip-1], y1 = m[ip], y2 = m[ip+1], den = y0 - 2*y1 + y2; if (Math.abs(den) > 1e-15) off = 0.5 * (y0 - y2) / den; }
  return {pk, tpk: r.x0 + (ip + off) * r.dx, w3: cross(Math.SQRT1_2), w6: cross(0.5),
          psl: sl > 0 ? db(sl / pk) : -Infinity, tsl: isl >= 0 ? r.x0 + isl * r.dx : NaN};
}

/* ---------- ストレッチ処理（LFM、送受の傾きが等しい場合） ----------
   受信信号に参照LFM（遅延 tauR、長さ 2T）の複素共役を掛け、FFTでスペクトル解析する */
function stretch(sc, w, tauR){
  const T = w.T, al = w.alpha, n0 = Math.max(0, Math.round((tauR - T/2) * FS)), len = Math.min(2 * w.N, L - n0);
  const NS = 8192, zr = new Float64Array(NS), zi = new Float64Array(NS), dr = new Float64Array(len);
  for (let i = 0; i < len; i++){
    const n = n0 + i, d = n / FS - tauR - T/2, p = Math.PI * al * d * d, c = Math.cos(p), s = Math.sin(p);
    zr[i] = sc.re[n]*c + sc.im[n]*s; zi[i] = sc.im[n]*c - sc.re[n]*s; dr[i] = zr[i];
  }
  fft(zr, zi);
  const mag = new Float64Array(NS);                  // 周波数の昇順（−fs/2 〜 +fs/2）に並べ替え
  for (let k = 0; k < NS; k++){ const kk = (k + NS/2) % NS; mag[k] = Math.hypot(zr[kk], zi[kk]) / w.N; }
  return {mag, f0: -FS/2, df: FS / NS, n: NS, dechirpRe: dr, t0: n0 / FS, len};
}

/* ============================================================
   ハンドブック記載値との照合（設定スライダーとは独立した固定条件で計算）
   ============================================================ */
function runChecks(){
  const out = [];
  const add = (item, cond, meas, ref, unit, tol, src, note) => out.push({item, cond, meas, ref, unit, tol, src, note: note || '',
    ok: tol === null ? null : Math.abs(meas - ref) <= tol});
  /* 1) LFM 重みなし（TB=400） */
  const w1 = makeWave('lfm', 100, 4), B1 = 4e6;
  const m1 = metrics(response(w1, 0, 'none'));
  add('LFM 重み付けなし：ピークサイドローブ', 'T=100 µs, B=4 MHz（TB=400）', m1.psl, -13.2, 'dB', 0.2, '表8.2, p.8.3');
  add('LFM 重み付けなし：3 dB幅 × B', '同上', m1.w3 * B1, 0.886, '', 0.01, '表8.1・表8.2');
  add('LFM 重み付けなし：6 dB幅 × B', '同上', m1.w6 * B1, 1.21, '', 0.01, '表8.2');
  /* 2) テイラー重み付け（TB=400） */
  const r2 = response(w1, 0, 'taylor'), m2 = metrics(r2);
  add('テイラー：ピークサイドローブ', 'T=100 µs, B=4 MHz（TB=400）', m2.psl, -40, 'dB', 1.0, '表8.2, p.8.8', 'TB が有限であるため約 2 dB 高い（下の TB=3200 の行と式8.11 の行を参照）');
  add('テイラー：3 dB幅 × B', '同上', m2.w3 * B1, 1.25, '', 0.02, '表8.2');
  add('テイラー：6 dB幅 × B', '同上', m2.w6 * B1, 1.73, '', 0.02, '表8.2');
  add('テイラー：ミスマッチ損失', '同上', r2.lossDb, 1.15, 'dB', 0.03, '表8.2, p.8.3');
  const m2b = metrics(response(makeWave('lfm', 800, 4), 0, 'taylor'));
  add('テイラー：ピークサイドローブ', 'T=800 µs, B=4 MHz（TB=3200、スライダーの範囲外の確認用）', m2b.psl, -40, 'dB', 1.0, '表8.2, p.8.8', 'TBを大きくすると −40 dB に近づく');
  /* 2b) 式(8.11)・式(8.12) を直接評価（TB→∞ の理論値） */
  const mt = metrics(theoryResp(taylorTheory, 40, 0.002));
  add('式(8.11) の理論曲線：ピークサイドローブ', 'TB≫1 の理論式', mt.psl, -40, 'dB', 0.3, '式8.11, 表8.2');
  add('式(8.11) の理論曲線：3 dB幅 × B', '同上', mt.w3, 1.25, '', 0.01, '式8.11, 表8.2');
  add('式(8.11) の理論曲線：6 dB幅 × B', '同上', mt.w6, 1.73, '', 0.01, '式8.11, 表8.2');
  let s2 = 0; for (const F of TAYLOR) s2 += F*F;
  add('式(8.12) のミスマッチ損失', '係数 F1〜F5 から計算', 10*Math.log10(1 + 2*s2), 1.15, 'dB', 0.01, '式8.12, 表8.2');
  /* 3) バーカー13 */
  const mb = metrics(response(makeWave('barker', 13, 0, 13), 0, 'none'));
  add('バーカー13：ピークサイドローブ', 'T=13 µs（1 チップ = 10 サンプル）', mb.psl, -20*Math.log10(13), 'dB', 0.05, '−20 log N, p.8.17');
  const mb2 = metrics(response(makeWave('barker', 40, 0, 13), 0, 'none'));
  add('バーカー13：ピークサイドローブ', 'T=40 µs 設定（実効 40.3 µs）', mb2.psl, -20*Math.log10(13), 'dB', 0.05, '−20 log N, p.8.17');
  /* 4) 距離ドップラ結合：ピーク位置のずれ t = −fd·T/B */
  const dop = (T, B, fdk, tol, note) => {
    const w = makeWave('lfm', T, B), m = metrics(response(w, fdk * 1e3, 'none'));
    add('LFM：ドップラ偏移によるピーク位置の変化', 'T=' + T + ' µs, B=' + B + ' MHz, fd=' + fdk + ' kHz', m.tpk * 1e6, -fdk * 1e3 * (T * 1e-6) / (B * 1e6) * 1e6, 'µs', tol, '−fd·T/B, p.8.4', note);
  };
  dop(40, 2, 100, 0.02);
  dop(100, 4, 200, 0.02);
  dop(100, 1, 500, 0.6, 'ハンドブックの例（50 µs, p.8.6）');
  dop(10, 1, 500, 0.3, 'ハンドブックの例（5 µs, p.8.5）。TB=10');
  /* 4b) ドップラがあるときのピーク低下（式8.9）：1 − |fd|/B */
  const m4 = metrics(response(makeWave('lfm', 40, 2), 2e5, 'none'));
  add('LFM：fd=B/10 の場合のピークの低下', 'T=40 µs, B=2 MHz, fd=200 kHz', db(m4.pk), db(0.9), 'dB', 0.1, '式8.9 から 1−|fd|/B');
  /* 5) ストレッチ処理：周波数オフセット δf = −(B/T)·td（式8.24）と 6 dB幅 1.21/T（式8.32） */
  {
    const w = makeWave('lfm', 40, 2), R0 = 20000, dR = 300, tauR = 2*R0/C;
    const st = stretch(makeScene(w, {fd: 0, targets: [{R: R0 + dR, A: 1, ph: 0}]}), w, tauR);
    const m = metrics({x0: st.f0, dx: st.df, mag: st.mag, n: st.n});
    add('ストレッチ：周波数オフセット', 'T=40 µs, B=2 MHz, 参照波形より 300 m（2 µs）遠い目標', m.tpk / 1e3, -(2e6/40e-6) * (2*dR/C) / 1e3, 'kHz', 1.0, '式8.24, p.8.31');
    add('ストレッチ：6 dB幅 × T', '同上（矩形窓）', m.w6 * 40e-6, 1.21, '', 0.02, '式8.32, p.8.34');
  }
  /* 参考：TBが小さいと表の値からずれる */
  const ms = metrics(response(makeWave('lfm', 10, 1), 0, 'none'));
  add('（参考）LFM 重み付けなし：ピークサイドローブ', 'T=10 µs, B=1 MHz（TB=10）', ms.psl, -13.2, 'dB', null, '表8.2 は TB≫1 が前提', 'TB が小さいために一致しない例');
  const mst = metrics(response(makeWave('lfm', 10, 1), 0, 'taylor'));
  add('（参考）テイラー：ピークサイドローブ', 'T=10 µs, B=1 MHz（TB=10）', mst.psl, -40, 'dB', null, 'p.8.8（フレネルリップル）', 'TB が小さいために一致しない例');
  const md = metrics(response(makeWave('lfm', 40, 2), 0, 'taylor'));
  add('（参考）テイラー：ピークサイドローブ', '初期設定 T=40 µs, B=2 MHz（TB=80）', md.psl, -40, 'dB', null, 'p.8.8（フレネルリップル）', 'TB=80 での値');
  return out;
}
if (typeof module !== 'undefined') module.exports = {FS, C, L, S, makeWave, makeScene, compress, correlateDirect, response, metrics, runChecks, stretch, taylorTheory, theoryResp, noiseSeq, db, fft};
