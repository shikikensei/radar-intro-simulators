'use strict';
/* ============================================================
   計算モデル
   検波は2乗検波（電力）。雑音だけのとき、1パルスの電力は平均 1 の指数分布（振幅ではレイリー分布：p.7.1）。
   n パルスの積分は、電力をそのまま足す非コヒーレント積分（移動窓：式7.5 の和）。
   ============================================================ */
const MINUS = '−';
const NC = 200;             // 表示する距離セルの数
const MARG = 40;            // 両端の外側に作っておく余分なセル（CFAR の参照窓が端で欠けないようにする）
const NT = NC + 2 * MARG;
const T1CELL = 60;          // 目標1の距離セル
const SWN = ['非変動', 'Swerling 1', 'Swerling 2', 'Swerling 3', 'Swerling 4'];
const CFARN = {ca: 'セル平均', cens: '大きい2個を除外', min: '平均が小さい側だけを使用', log: '対数ビデオ', edge: '境界の同じ側だけを使用'};
const NCENS = 2;            // 「大きい K 個を除く」検出器で除く個数（p.7.16 の D2 にあたる）

/* 共通設定（全ステップで共有） */
const DEFAULTS = {pfa: 3, snr: 10, sw: 0, n: 1, M: 1, m: 16, g: 1, cfar: 'ca', cnr: 15, edge: 120, t2: false, t2off: 4, s2: 20, t3: true, s3: 30, seed: 1};
const cloneDef = () => JSON.parse(JSON.stringify(DEFAULTS));
const S = cloneDef();
const db10 = v => 10 * Math.log10(Math.max(v, 1e-300));
const lin = d => Math.pow(10, d / 10);

/* ---------- 特殊関数 ---------- */
function lgamma(x){
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (let j = 0; j < 6; j++) s += c[j] / ++y;
  return -t + Math.log(2.5066282746310005 * s / x);
}
/* 整数 a の正則化上側不完全ガンマ関数 Q(a, x) = e^{−x} Σ_{k<a} x^k/k!：平均1の指数分布 a 個の和が x を超える確率 */
function gQ(a, x){ if (x <= 0) return 1; let t = Math.exp(-x), s = 0; for (let k = 0; k < a; k++){ s += t; t *= x / (k + 1); } return Math.min(1, s); }
const _thr = new Map();
/* 固定しきい値：雑音だけの n パルスの和が T を超える確率が pfa になる T */
function thresholdFor(n, pfa){
  const key = n + '/' + pfa; let T = _thr.get(key); if (T !== undefined) return T;
  let lo = 0, hi = n + 10; while (gQ(n, hi) > pfa) hi *= 1.5;
  for (let i = 0; i < 80; i++){ const mid = (lo + hi) / 2; if (gQ(n, mid) > pfa) lo = mid; else hi = mid; }
  T = (lo + hi) / 2; _thr.set(key, T); return T;
}
/* ゆらぎなしの目標：1パルスの S/N が s のとき、n パルスの和が T を超える確率（一般化マーカム Q 関数を級数で計算） */
function pdNF(n, s, T){
  const lam = n * s; if (!(lam > 0)) return gQ(n, T);
  if (n + lam - T > 10 * Math.sqrt(n + 2 * lam)) return 1;
  const k0 = Math.floor(lam), kmax = k0 + Math.ceil(12 * Math.sqrt(lam + 1)) + 30, q = new Float64Array(kmax + 1);
  let t = Math.exp(-T), acc = 0; for (let j = 0; j < n; j++){ acc += t; t *= T / (j + 1); }
  for (let k = 0; k <= kmax; k++){ q[k] = acc; acc += t; t *= T / (n + k + 1); }
  const p0 = Math.exp(-lam + k0 * Math.log(lam) - lgamma(k0 + 1)); let sum = 0, p = p0;
  for (let k = k0; k <= kmax; k++){ sum += p * q[k]; p *= lam / (k + 1); if (p < 1e-18 && k > k0 + 5) break; }
  p = p0; for (let k = k0 - 1; k >= 0; k--){ p *= (k + 1) / lam; sum += p * q[k]; if (p < 1e-18) break; }
  return Math.min(1, sum);
}
/* ゆらぎのある目標は、目標の強さの分布で平均する（Swerling 1・3：スキャンごとのゆらぎ）。分位点を使った中点則 */
const NQ = 256, QS1 = new Float64Array(NQ), QS3 = new Float64Array(NQ);
for (let j = 0; j < NQ; j++){ const u = (j + 0.5) / NQ; QS1[j] = -Math.log(1 - u); let q = QS1[j] * 0.8 + 0.2;
  for (let it = 0; it < 60; it++){ const f = 1 - Math.exp(-2 * q) * (1 + 2 * q) - u, d = 4 * q * Math.exp(-2 * q); q = Math.max(1e-9, q - f / Math.max(d, 1e-12)); } QS3[j] = q; }
function mixSW(sw, s, fn, st){ if (sw === 0) return fn(s); const q = sw === 1 ? QS1 : QS3; let a = 0; if (st){ for (let j = 0; j < NQ; j += st) a += 0.5 * (fn(s * q[j + (st >> 1) - 1]) + fn(s * q[j + (st >> 1)])); return a * st / NQ; } for (let j = 0; j < NQ; j++) a += fn(s * q[j]); return a / NQ; }
const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
/* 固定しきい値 T のときの探知確率。sw：0 ゆらぎなし、1〜4 Swerling モデル。s は1パルスあたりの平均 S/N（線形） */
function pdFixed(sw, n, s, T){
  if (!(s > 0)) return gQ(n, T);
  if (sw === 2) return gQ(n, T / (1 + s));
  if (sw === 4){ const th = 1 + s / 2, w2 = (th - 1) / th, w1 = 1 / th; let a = 0; for (let k = 0; k <= n; k++) a += binom(n, k) * Math.pow(w2, k) * Math.pow(w1, n - k) * gQ(n + k, T / th); return a; }
  return mixSW(sw, s, x => pdNF(n, x, T));
}
/* Swerling 1 の閉じた式（数値積分の確認用）：n=1 では Pfa^(1/(1+S)) */
function pdSW1closed(n, s, T){
  if (n === 1) return Math.exp(-T / (1 + s));
  const a = 1 + 1 / (n * s); return gQ(n - 1, T) + Math.pow(a, n - 1) * (1 - gQ(n - 1, T / a)) * Math.exp(-T / (1 + n * s));
}
function solveSnr(fn, target){            // fn(s) が target になる s [dB]（fn は s について単調増加）
  let lo = -30, hi = 60; if (fn(lin(hi)) < target) return NaN;
  for (let i = 0; i < 24; i++){ const mid = (lo + hi) / 2; if (fn(lin(mid)) < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/* ---------- 2値積分（M-out-of-N）：式7.9、7.10 のまわり ---------- */
function binTail(N, M, p){ if (M <= 0) return 1; if (p <= 0) return 0; if (p >= 1) return 1; const r = p / (1 - p); let t = binom(N, M) * Math.pow(p, M) * Math.pow(1 - p, N - M), s = 0; for (let k = M; k <= N; k++){ s += t; t *= (N - k) / (k + 1) * r; } return Math.min(1, s); }
function binP0(N, M, pfa){               // 全体の誤警報確率が pfa になる、1パルスの誤警報確率 P_N
  let lo = -700, hi = 0; for (let i = 0; i < 80; i++){ const mid = (lo + hi) / 2; if (binTail(N, M, Math.exp(mid)) > pfa) hi = mid; else lo = mid; }
  return Math.exp((lo + hi) / 2);
}
function pd1(sw, s, T1){                 // 1パルスの探知確率（スキャン内で強さが一定のとき、その強さ s に対して）
  if (sw === 2) return Math.exp(-T1 / (1 + s));
  if (sw === 4){ const th = 1 + s / 2; return (1 / th) * Math.exp(-T1 / th) + ((th - 1) / th) * gQ(2, T1 / th); }
  return pdNF(1, s, T1);
}
function pdBinary(sw, N, M, s, p0, st){
  const T1 = -Math.log(p0);
  if (sw === 2 || sw === 4) return binTail(N, M, pd1(sw, s, T1));
  return mixSW(sw, s, x => binTail(N, M, pdNF(1, x, T1)), st);
}
const _rb = new Map();
function reqBin(sw, N, pfa, pdT){        // M = 1..N それぞれの所要 S/N [dB]（結果は覚えておく）
  const key = sw + '/' + N + '/' + pfa + '/' + pdT; let r = _rb.get(key); if (r) return r;
  r = new Float64Array(N + 1); r[0] = NaN; for (let M = 1; M <= N; M++){ const p0 = binP0(N, M, pfa); r[M] = solveSnr(s => pdBinary(sw, N, M, s, p0, 8), pdT); }
  if (_rb.size > 40) _rb.clear(); _rb.set(key, r); return r;
}
function bestM0(sw, N, pfa, pdT){ const r = reqBin(sw, N, pfa, pdT); let b = 1; for (let M = 2; M <= N; M++) if (r[M] < r[b]) b = M; return {M: b, snr: r[b]}; }
function bestM(sw, N, pfa, pdT){         // 所要 S/N が最小になる M
  let b = {M: 1, snr: Infinity}; for (let M = 1; M <= N; M++){ const p0 = binP0(N, M, pfa), v = solveSnr(s => pdBinary(sw, N, M, s, p0), pdT); if (v < b.snr) b = {M, snr: v}; } return b;
}
/* ---------- セル平均 CFAR（2乗検波）の厳密な式 ----------
   注目セル：n パルスの和 Y。参照セル：m 個、それぞれ n パルスの和。判定は Y/n > α × (参照セルの1パルスあたりの平均)。
   c[a] = P(Gamma(a) > K·Gamma(L))、K = α/m、L = m·n */
function caTail(K, L, amax){
  const c = new Float64Array(amax + 1); let t = Math.exp(-L * Math.log1p(K)), acc = 0; const r = K / (1 + K);
  for (let j = 0; j < amax; j++){ acc += t; c[j + 1] = Math.min(1, acc); t *= (L + j) / (j + 1) * r; if (acc > 1 - 1e-13 && t < 1e-15){ c.fill(1, j + 1); break; } }
  return c;
}
function pfaCA(n, m, alpha){ return caTail(alpha / m, m * n, n)[n]; }
const _al = new Map();
function alphaCA(n, m, pfa){
  const key = n + '/' + m + '/' + pfa; let a = _al.get(key); if (a !== undefined) return a;
  let lo = 0, hi = 10; while (pfaCA(n, m, hi) > pfa) hi *= 2;
  for (let i = 0; i < 90; i++){ const mid = (lo + hi) / 2; if (pfaCA(n, m, mid) > pfa) lo = mid; else hi = mid; }
  a = (lo + hi) / 2; _al.set(key, a); return a;
}
/* セル平均 CFAR の探知確率（周囲は一様な雑音）。s は1パルスあたりの平均 S/N（周囲の雑音に対して） */
function pdCA(sw, n, m, s, alpha){
  const K = alpha / m, L = m * n;
  if (!(s > 0)) return caTail(K, L, n)[n];
  if (sw === 2) return caTail(K / (1 + s), L, n)[n];
  if (sw === 4){ const th = 1 + s / 2, w2 = (th - 1) / th, w1 = 1 / th, c = caTail(K / th, L, 2 * n); let a = 0; for (let k = 0; k <= n; k++) a += binom(n, k) * Math.pow(w2, k) * Math.pow(w1, n - k) * c[n + k]; return a; }
  const smax = sw === 0 ? s : s * (sw === 1 ? QS1[NQ - 1] : QS3[NQ - 1]), lamMax = n * smax, kcap = Math.floor(lamMax) + Math.ceil(12 * Math.sqrt(lamMax + 1)) + 30;
  /* c[a] は a とともに 1 に近づく。1 に達した先は計算しない */
  let cap = n + 64; const need = n + kcap + 1; let c = caTail(K, L, Math.min(cap, need));
  while (c.length - 1 < need && c[c.length - 1] < 1 - 1e-12){ cap *= 2; c = caTail(K, L, Math.min(cap, need)); }
  const last = c.length - 1, cv = a => (a >= last ? c[last] : c[a]);
  const nf = x => { const lam = n * x; if (!(lam > 0)) return cv(n); const k0 = Math.floor(lam), sd = Math.sqrt(lam + 1);
    if (cv(n + Math.max(0, Math.floor(lam - 9 * sd))) > 1 - 1e-10) return 1;
    const kmax = k0 + Math.ceil(12 * sd) + 30, p0 = Math.exp(-lam + k0 * Math.log(lam) - lgamma(k0 + 1)); let sum = 0, p = p0;
    for (let k = k0; k <= kmax; k++){ sum += p * cv(n + k); p *= lam / (k + 1); if (p < 1e-18 && k > k0 + 5) break; }
    p = p0; for (let k = k0 - 1; k >= 0; k--){ p *= (k + 1) / lam; sum += p * cv(n + k); if (p < 1e-18) break; }
    return Math.min(1, sum); };
  return mixSW(sw, s, nf);
}
/* CFAR 損失：同じ Pfa・Pd を得るのに必要な S/N の増加 [dB] */
function cfarLoss(sw, n, m, pfa, pdT){
  const T = thresholdFor(n, pfa), a = alphaCA(n, m, pfa);
  return solveSnr(s => pdCA(sw, n, m, s, a), pdT) - solveSnr(s => pdFixed(sw, n, s, T), pdT);
}

/* ============================================================
   CFAR の種類ごとの雑音レベルの推定
   v：参照セルの値（各セルの n パルスの和 ÷ n）を、手前側 h 個・奥側 h 個の順に並べたもの。戻り値は1パルスあたりの雑音電力の推定値
   ============================================================ */
function cfarEst(kind, v, h, tmp){
  const m = 2 * h; let a = 0, b = 0;
  if (kind === 'log'){ for (let i = 0; i < m; i++) a += Math.log(v[i]); return Math.exp(a / m); }          // 対数をとってから平均（図7.19）
  for (let i = 0; i < h; i++){ a += v[i]; b += v[h + i]; }
  if (kind === 'min') return Math.min(a, b) / h;                                                           // 平均が小さい側の半分だけを使う（p.7.19–7.20）
  if (kind === 'cens'){ const k = Math.min(NCENS, m - 2); let s = a + b; for (let i = 0; i < m; i++) tmp[i] = v[i];
    for (let j = 0; j < k; j++){ let ib = 0; for (let i = 1; i < m; i++) if (tmp[i] > tmp[ib]) ib = i; s -= tmp[ib]; tmp[ib] = -1; } return s / (m - k); }   // 大きい K 個を除いて平均（p.7.16）
  return (a + b) / m;                                                                                      // セル平均（図7.12）
}
/* n=1 のときの厳密な式（しきい値の係数 α に対する Pfa） */
function pfaExact1(kind, m, alpha){
  if (kind === 'ca') return Math.pow(1 + alpha / m, -m);
  if (kind === 'min'){ const h = m / 2, T = alpha / h; let s = 0; for (let k = 0; k < h; k++) s += binom(h + k - 1, k) * Math.pow(2 + T, -(h + k)); return 2 * s; }
  if (kind === 'cens'){ const r = m - Math.min(NCENS, m - 2); let p = 1; for (let j = 1; j <= r; j++) p /= 1 + (alpha / r) * (r - j + 1) / (m - j + 1); return p; }
  return NaN;
}
/* 「平均が小さい側だけ」の厳密な式（一般の n）：Pfa = 2∫ f_A(a)·Q(n, α·a/h)·P(B > a) da。A・B は片側 h 個の参照セルの和（Gamma(h·n)） */
function pfaMin(n, m, alpha){
  const h = m / 2, sh = h * n, K = alpha / h, lg = lgamma(sh), NI = 1200, hi = sh + 14 * Math.sqrt(sh) + 20, t0 = Math.log(hi * 1e-9), t1 = Math.log(hi), dt = (t1 - t0) / NI; let acc = 0;
  for (let i = 0; i <= NI; i++){ const t = t0 + i * dt, a = Math.exp(t), w = i === 0 || i === NI ? 1 : i % 2 ? 4 : 2;
    acc += w * Math.exp((sh - 1) * t - a - lg) * a * gQ(n, K * a) * gQ(sh, a); }
  return 2 * acc * dt / 3;
}
/* 「大きい2個を除く」の一般の n：重点サンプリング。除かれる 2 個は縮めず、残りだけを μ 倍に縮めて作る（どの 2 個を残すかは対称に混ぜた提案分布として重みを計算） */
const _cb = new Map();
function censBase(n, m){
  const key = n + '/' + m; let b = _cb.get(key); if (b) return b;
  const NS = 4000, rnd = mulberry32(24680 + 131 * n + 7 * m), e = new Float64Array(NS * m);
  for (let i = 0; i < NS * m; i++){ let pr = 1; for (let k = 0; k < n; k++) pr *= 1 - rnd(); e[i] = -Math.log(pr); }
  b = {NS, e}; if (_cb.size > 12) _cb.clear(); _cb.set(key, b); return b;
}
function pfaCens(n, m, alpha, force){
  if (m < 4) return pfaCA(n, m, alpha);
  if (n === 1 && !force) return pfaExact1('cens', m, alpha);
  const b = censBase(n, m), r = m - 2, mu = 1 / (1 + alpha / r), nl = n * Math.log(mu), lc = Math.log(m * (m - 1) / 2), sv = new Float64Array(m); let acc = 0;
  for (let i = 0; i < b.NS; i++){ const o = i * m; let tot = 0, x1 = 0, x2 = 0, ss = 0, s1 = -Infinity, s2 = -Infinity, i1 = -1;
    for (let j = 0; j < m; j++){ const e = b.e[o + j], x = j < 2 ? e : mu * e, sj = nl + (j < 2 ? e * (1 / mu - 1) : e * (1 - mu));
      tot += x; if (x > x1){ x2 = x1; x1 = x; } else if (x > x2) x2 = x;
      sv[j] = sj; ss += sj; if (sj > s1){ s2 = s1; s1 = sj; i1 = j; } else if (sj > s2) s2 = sj; }
    let A = 0, A2 = 0; for (let j = 0; j < m; j++) if (j !== i1){ const u = Math.exp(sv[j] - s2); A += u; A2 += u * u; }
    const lw = lc + ss - s1 - s2 - Math.log(A + 0.5 * (A * A - A2) * Math.exp(s2 - s1));
    acc += Math.exp(lw) * gQ(n, alpha * (tot - x1 - x2) / r); }
  return acc / b.NS;
}
/* 対数ビデオ：W = ln(注目セル) − 平均 ln(参照セル) が ln α を超える確率を、鞍点近似（Lugannani–Rice の式）で求める */
function digamma(x){ let r = 0; while (x < 8){ r -= 1 / x; x += 1; } const f = 1 / (x * x); return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f / 252)); }
function trigamma(x){ let r = 0; while (x < 8){ r += 1 / (x * x); x += 1; } const f = 1 / (x * x); return r + 1 / x + f / 2 + f / x * (1 / 6 - f * (1 / 30 - f / 42)); }
function erfc(x){ const z = Math.abs(x), t = 2 / (2 + z), ty = 4 * t - 2, c = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2, -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4, 4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6, 1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8, 6.529054439e-9, 5.059343495e-9, -9.91364156e-10, -2.27365122e-10, 9.6467911e-11, 2.394038e-12, -6.886027e-12, 8.94487e-13, 3.13092e-13, -1.12708e-13, 3.81e-16, 7.106e-15, -1.523e-15, -9.4e-17, 1.21e-16, -2.8e-17];
  let d = 0, dd = 0; for (let j = c.length - 1; j > 0; j--){ const tmp = d; d = ty * d - dd + c[j]; dd = tmp; } const v = t * Math.exp(-z * z + 0.5 * (c[0] + ty * d) - dd); return x >= 0 ? v : 2 - v; }
function pfaLog(n, m, alpha){
  const c = Math.log(alpha), K1 = t => digamma(n + t) - digamma(n - t / m), mean = K1(0), sd = Math.sqrt(trigamma(n) * (1 + 1 / m));
  if (Math.abs(c - mean) < 0.05 * sd) return 0.5 * (pfaLog(n, m, Math.exp(mean - 0.08 * sd)) + pfaLog(n, m, Math.exp(mean + 0.08 * sd)));   // 平均のすぐ近くは式が 0/0 になるので両側の平均で代用
  let lo = c > mean ? 0 : -n * (1 - 1e-12), hi = c > mean ? n * m * (1 - 1e-12) : 0; for (let i = 0; i < 70; i++){ const mid = (lo + hi) / 2; if (K1(mid) < c) lo = mid; else hi = mid; }
  const t = (lo + hi) / 2, K = lgamma(n + t) - lgamma(n) + m * (lgamma(n - t / m) - lgamma(n)), K2 = trigamma(n + t) + trigamma(n - t / m) / m;
  const r = Math.sign(t) * Math.sqrt(Math.max(0, 2 * (t * c - K))), u = t * Math.sqrt(K2);
  return Math.max(0, Math.min(1, 0.5 * erfc(r / Math.SQRT2) + Math.exp(-r * r / 2) / Math.sqrt(2 * Math.PI) * (1 / u - 1 / r)));
}
const _alk = new Map();
/* しきい値の係数 α：一様な雑音の中で Pfa が設計値になる値。厳密な式があればそれを使う */
function alphaFor(kind, n, m, pfa){
  if (kind === 'ca' || kind === 'edge') return alphaCA(n, m, pfa);
  const key = kind + '/' + n + '/' + m + '/' + pfa; let a = _alk.get(key); if (a !== undefined) return a;
  const f = kind === 'min' ? x => pfaMin(n, m, x) : kind === 'cens' ? x => pfaCens(n, m, x) : x => pfaLog(n, m, x);
  let lo = 0, hi = 10; while (f(hi) > pfa && hi < 1e7) hi *= 2;
  for (let i = 0; i < 60; i++){ const mid = (lo + hi) / 2; if (f(mid) > pfa) lo = mid; else hi = mid; }
  a = (lo + hi) / 2; if (_alk.size > 200) _alk.clear(); _alk.set(key, a); return a;
}

/* ============================================================
   シミュレーション：距離方向に並んだセルの、検波後の電力（パルスごと）
   ============================================================ */
function mulberry32(a){
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/* 設定から、シミュレーションの条件をまとめる */
function scenario(o){
  o = o || S; const n = o.n, tg = [{id: 1, cell: T1CELL, s: lin(o.snr)}];
  if (o.t2) tg.push({id: 2, cell: T1CELL + o.t2off, s: lin(o.s2)});
  const c3 = Math.min(o.edge + 25, NC - 8); if (o.t3 && o.cnr > 0) tg.push({id: 3, cell: c3, s: lin(o.s3)});
  const C = o.cnr > 0 ? lin(o.cnr) : 0, lev = new Float64Array(NT); for (let i = 0; i < NT; i++) lev[i] = 1 + (C > 0 && i - MARG >= o.edge ? C : 0);
  return {n, sw: o.sw, tg, C, edge: o.edge, lev, m: o.m, g: o.g, M: Math.min(o.M, n), pfa: Math.pow(10, -o.pfa), up: lin(o.up || 0)};   // up：固定しきい値を何倍に上げるか（ステップ6）
}
/* 1スキャン分のデータ。P[i*n + k]：セル i の k 番目のパルスの電力。Y[i]：n パルスの和。
   目標の強さ：sw=0 一定、1・3 スキャンごとに変わる（スキャン内では一定）、2・4 パルスごとに変わる */
function genScan(sc, seed, out){
  const n = sc.n, rnd = mulberry32((seed * 2654435761 + 1013904223) | 0), P = out ? out.P : new Float64Array(NT * n), Y = out ? out.Y : new Float64Array(NT);
  for (let i = 0; i < NT; i++){ let s = 0; const l = sc.lev[i], q = i * n; for (let k = 0; k < n; k++){ const p = -l * Math.log(1 - rnd()); P[q + k] = p; s += p; } Y[i] = s; }
  const gam2 = () => -0.5 * Math.log((1 - rnd()) * (1 - rnd()));        // 平均1、自由度4のカイ2乗（Swerling 3・4）
  for (const t of sc.tg){
    const i = t.cell + MARG, l = sc.lev[i], q = i * n; let s = 0, a = t.s;
    if (sc.sw === 1) a = -t.s * Math.log(1 - rnd()); else if (sc.sw === 3) a = t.s * gam2();
    for (let k = 0; k < n; k++){
      const ak = sc.sw === 2 ? -t.s * Math.log(1 - rnd()) : sc.sw === 4 ? t.s * gam2() : a;
      const r = Math.sqrt(-l * Math.log(1 - rnd())), u = 2 * Math.PI * rnd(), x = Math.sqrt(ak) + r * Math.cos(u), y = r * Math.sin(u), p = x * x + y * y;   // 目標（一定の振幅）＋複素ガウス雑音
      P[q + k] = p; s += p;
    }
    Y[i] = s;
  }
  return {P, Y};
}
/* CFAR のしきい値（Y に対する値）を全表示セルについて求める。thr[c]、c は表示セルの番号 */
function cfarThreshold(sc, Y, kind, thr, est){
  const n = sc.n, h = sc.m / 2, g = sc.g, m = sc.m, v = new Float64Array(m), tmp = new Float64Array(m);
  const aFull = alphaFor(kind, n, m, sc.pfa), aHalf = kind === 'edge' && m >= 4 ? alphaCA(n, h, sc.pfa) : aFull, e = sc.edge + MARG, hasEdge = sc.C > 0;
  thr = thr || new Float64Array(NC);
  for (let c = 0; c < NC; c++){
    const i = c + MARG; let z, a = aFull;
    if (kind === 'edge' && hasEdge && m >= 4 && e > i - g - h && e <= i + g + h){        // 境目が参照窓（ガードを含む）の中にある：注目セルと同じ側の半分だけを使う
      let s = 0; if (i >= e){ for (let j = 0; j < h; j++) s += Y[i + g + 1 + j]; } else { for (let j = 0; j < h; j++) s += Y[i - g - h + j]; }
      z = s / (h * n); a = aHalf;
    } else { for (let j = 0; j < h; j++){ v[j] = Y[i - g - h + j] / n; v[h + j] = Y[i + g + 1 + j] / n; } z = cfarEst(kind === 'edge' ? 'ca' : kind, v, h, tmp); }
    thr[c] = a * n * z; if (est) est[c] = z;
  }
  return thr;
}
/* 2値積分：各パルスを第1しきい値 T1 と比べ、超えた回数を数える */
function binCount(sc, P, T1, cnt){ const n = sc.n; cnt = cnt || new Uint8Array(NC); for (let c = 0; c < NC; c++){ let k = 0; const q = (c + MARG) * n; for (let j = 0; j < n; j++) if (P[q + j] > T1) k++; cnt[c] = k; } return cnt; }

/* ---------- モンテカルロ試行 ----------
   セルの分類：0 一様な雑音域、1 クラッタ域の内側、2 境目の付近（参照窓に境目がかかる）、3 目標の付近（参照窓に目標がかかる）、4 目標のセル */
const DETS = ['fixed', 'bin', 'ca', 'cens', 'min', 'log', 'edge'];
function cellClass(sc){
  const cls = new Uint8Array(NC), w = sc.m / 2 + sc.g;
  for (let c = 0; c < NC; c++){ cls[c] = sc.C > 0 && c >= sc.edge ? 1 : 0; if (sc.C > 0 && c >= sc.edge - w && c < sc.edge + w) cls[c] = 2; }
  for (const t of sc.tg) for (let c = Math.max(0, t.cell - w); c <= Math.min(NC - 1, t.cell + w); c++) cls[c] = 3;
  for (const t of sc.tg) cls[t.cell] = 4;
  return cls;
}
function mcNew(sc, dets){
  const acc = {sc, dets: dets || DETS, trials: 0, cls: cellClass(sc), ncls: [0, 0, 0, 0, 0], det: {}, fa: {}, T: thresholdFor(sc.n, sc.pfa) * (sc.up || 1), p0: binP0(sc.n, sc.M, sc.pfa), buf: {P: new Float64Array(NT * sc.n), Y: new Float64Array(NT)}, thr: new Float64Array(NC), cnt: new Uint8Array(NC)};
  for (let c = 0; c < NC; c++) acc.ncls[acc.cls[c]]++;
  for (const d of acc.dets){ acc.det[d] = sc.tg.map(() => 0); acc.fa[d] = [0, 0, 0, 0]; }
  acc.T1 = -Math.log(acc.p0); return acc;
}
function mcRun(acc, nTrials, seedBase){
  const sc = acc.sc;
  for (let t = 0; t < nTrials; t++){
    const d = genScan(sc, (seedBase || 100000) + acc.trials, acc.buf), Y = d.Y;
    for (const k of acc.dets){
      let hit;
      if (k === 'fixed'){ const T = acc.T; hit = c => Y[c + MARG] > T; }
      else if (k === 'bin'){ const cnt = binCount(sc, d.P, acc.T1, acc.cnt), M = sc.M; hit = c => cnt[c] >= M; }
      else { const thr = cfarThreshold(sc, Y, k, acc.thr); hit = c => Y[c + MARG] > thr[c]; }
      const fa = acc.fa[k]; for (let c = 0; c < NC; c++){ const cl = acc.cls[c]; if (cl < 4 && hit(c)) fa[cl]++; }
      sc.tg.forEach((tg, i) => { if (hit(tg.cell)) acc.det[k][i]++; });
    }
    acc.trials++;
  }
  return acc;
}
/* 二項分布の割合の 95% 信頼区間（ウィルソンの方法） */
function wilson(k, n){ if (!(n > 0)) return [NaN, NaN]; const z = 1.959964, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), e = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [k <= 0 ? 0 : Math.max(0, (c - e) / d), k >= n ? 1 : Math.min(1, (c + e) / d)]; }

/* ---------- 理論値（モンテカルロと比べるための値） ---------- */
const DETN = {fixed: '固定しきい値', bin: '2値積分（固定しきい値）', ca: 'セル平均 CFAR', cens: 'CFAR：大きい2個を除外', min: 'CFAR：平均が小さい側だけを使用', log: 'CFAR：対数ビデオ', edge: 'CFAR：境界の同じ側だけを使用'};
function pfaKind(kind, n, m, alpha){ return kind === 'min' ? pfaMin(n, m, alpha) : kind === 'cens' ? pfaCens(n, m, alpha) : kind === 'log' ? pfaLog(n, m, alpha) : pfaCA(n, m, alpha); }
/* 目標 t の参照窓（ガードの外側 m 個）が一様か：ほかの目標も、クラッタの境目も入っていない */
function tgClean(sc, t){
  const w = sc.m / 2 + sc.g, i = t.cell + MARG, l = sc.lev[i];
  for (let j = i - w; j <= i + w; j++) if (sc.lev[j] !== l) return false;
  for (const u of sc.tg) if (u !== t && Math.abs(u.cell - t.cell) <= w && Math.abs(u.cell - t.cell) > sc.g) return false;
  return true;
}
function theory(sc, det){
  const n = sc.n, T = thresholdFor(n, sc.pfa) * (det === 'fixed' ? (sc.up || 1) : 1), C = sc.C, r = {pfa: [sc.pfa, NaN], pd: []};
  if (det === 'fixed'){ r.pfa[0] = gQ(n, T);
    if (C > 0) r.pfa[1] = gQ(n, T / (1 + C));
    for (const t of sc.tg){ const l = sc.lev[t.cell + MARG]; r.pd.push(pdFixed(sc.sw, n, t.s / l, T / l)); }
  } else if (det === 'bin'){
    const p0 = binP0(n, sc.M, sc.pfa), T1 = -Math.log(p0);
    if (C > 0) r.pfa[1] = binTail(n, sc.M, Math.exp(-T1 / (1 + C)));
    for (const t of sc.tg){ const l = sc.lev[t.cell + MARG]; r.pd.push(pdBinary(sc.sw, n, sc.M, t.s / l, Math.exp(-T1 / l))); }
  } else {
    const a = alphaFor(det, n, sc.m, sc.pfa); if (C > 0) r.pfa[1] = sc.pfa;
    for (const t of sc.tg){
      const l = sc.lev[t.cell + MARG], s = t.s / l;
      if (!tgClean(sc, t)) r.pd.push(NaN);
      else if (det === 'ca' || det === 'edge') r.pd.push(pdCA(sc.sw, n, sc.m, s, a));
      else if (n === 1 && (sc.sw === 1 || sc.sw === 2)) r.pd.push(pfaKind(det, 1, sc.m, a / (1 + s)));   // n=1 で目標の電力が指数分布のとき：Pd は Pfa の式で α を α/(1+S/N) に置き換えたもの
      else r.pd.push(NaN);
    }
  }
  return r;
}

/* ---------- クラッタマップ（式7.17、7.18）----------
   マップ S_i = K·S_{i−1} + X_i（セルごと、スキャンごと）。しきい値 T = A·S_{i−1}。X は n パルスの和。
   雑音だけのとき S = Σ_j K^j X_j なので、E[exp(−u·S)] = Π_j (1 + u·K^j)^{−n}。
   q_i = E[e^{−A·S}(A·S)^i / i!] を漸化式で求め、Qc[i] = Σ_{l≤i} q_l とすると、Pfa = Qc[n−1]、ゆらぎなしの Pd = Σ_k Poisson(k; n·S/N)·Qc[n−1+k] */
function cmTable(K, A, n, imax){
  const J = Math.ceil(Math.log(1e-14 / Math.max(A, 1e-9)) / Math.log(K)) + 2, p = new Float64Array(imax + 1), c = []; let lnL = 0;
  for (let j = 0; j < Math.max(J, 8); j++){ const a = A * Math.pow(K, j); lnL -= n * Math.log1p(a); c.push(a / (1 + a)); }
  for (const cj of c){ let pw = 1; for (let r = 1; r <= imax; r++){ pw *= cj; if (pw < 1e-300) break; p[r] += n * pw; } }
  const d = new Float64Array(imax + 1), Qc = new Float64Array(imax + 1); d[0] = 1; const L = Math.exp(lnL); Qc[0] = L;
  for (let i = 1; i <= imax; i++){ let s = 0; for (let r = 1; r <= i; r++) s += p[r] * d[i - r]; d[i] = s / i; Qc[i] = Math.min(1, Qc[i - 1] + L * d[i]); if (!isFinite(d[i])){ for (let k = i; k <= imax; k++) Qc[k] = 1; break; } }
  return Qc;
}
function cmPfa(K, A, n){ return cmTable(K, A, n, n)[n - 1]; }
const _cma = new Map();
function cmA(K, n, pfa){
  const key = K + '/' + n + '/' + pfa; let a = _cma.get(key); if (a !== undefined) return a;
  let lo = 0, hi = 1; while (cmPfa(K, hi, n) > pfa && hi < 1e6) hi *= 2;
  for (let i = 0; i < 60; i++){ const mid = (lo + hi) / 2; if (cmPfa(K, mid, n) > pfa) lo = mid; else hi = mid; }
  a = (lo + hi) / 2; if (_cma.size > 100) _cma.clear(); _cma.set(key, a); return a;
}
function cmPd(sw, K, A, n, s){
  if (sw === 2){ return cmPfa(K, A / (1 + s), n); }                                                  // パルスごとに指数分布：雑音の式で A を A/(1+S/N) に
  const smax = sw === 0 ? s : sw === 1 ? s * 14 : s * 9, imax = Math.ceil(n * smax + 12 * Math.sqrt(n * smax) + 40) + n, mAS = n * A / (1 - K), cap = Math.ceil(mAS + 12 * (Math.sqrt(mAS) + A * Math.sqrt(n / (1 - K * K))) + 30) + n, Qc = cmTable(K, A, n, Math.min(imax, cap));   // i が大きいところでは Qc は 1 になるので、表はそこまでで打ち切る
  const f = x => { const mu = n * x; if (mu <= 0) return Qc[n - 1]; if (n - 1 + mu - 10 * Math.sqrt(mu) >= Qc.length - 1) return Qc[Qc.length - 1]; let k0 = Math.floor(mu), pk = Math.exp(-mu + k0 * Math.log(mu) - lgamma(k0 + 1)), acc = 0, q = pk;
    for (let k = k0; k >= 0 && q > 1e-17; k--){ acc += q * Qc[Math.min(n - 1 + k, Qc.length - 1)]; q *= k / mu; }
    q = pk * mu / (k0 + 1); for (let k = k0 + 1; q > 1e-17 && k < k0 + 40000; k++){ acc += q * Qc[Math.min(n - 1 + k, Qc.length - 1)]; q *= mu / (k + 1); } return Math.min(1, acc); };
  if (sw === 4){                                                                                       // パルスごとに自由度4のカイ2乗：目標＋雑音の和は Gamma(n+k)·θ（θ = 1+S/2）の二項混合になる
    const th = 1 + s / 2, pb = (s / 2) / th, Q2 = cmTable(K, A / th, n, 2 * n); let a = 0;
    for (let k = 0; k <= n; k++) a += binom(n, k) * Math.pow(pb, k) * Math.pow(1 - pb, n - k) * Q2[n + k - 1];
    return a; }
  return mixSW(sw, s, f);
}

/* ---------- プロット抽出（隣り合う検出のまとめと重心）の小さなモデル（ステップ11）----------
   距離方向に、パルス幅あたり SPC 個のサンプル。受信パルスの形はガウス形（電力の半値幅＝パルス幅）。2つの目標の位相差は毎回ランダム */
const SPC = 2, NM = 64;
function mergeScan(o, seed, out){
  const rnd = mulberry32((seed * 2246822519 + 374761393) | 0), P = out || new Float64Array(NM), re = new Float64Array(NM), im = new Float64Array(NM);
  for (let i = 0; i < NM; i++){ const r = Math.sqrt(-Math.log(1 - rnd())), u = 2 * Math.PI * rnd(); re[i] = r * Math.cos(u); im[i] = r * Math.sin(u); }
  for (const t of o.tg){ const a = Math.sqrt(t.s), ph = 2 * Math.PI * rnd(), c = Math.cos(ph), s = Math.sin(ph);
    for (let i = 0; i < NM; i++){ const x = (i - t.pos) / SPC, g = Math.exp(-2 * Math.LN2 * x * x); if (g > 1e-6){ re[i] += a * g * c; im[i] += a * g * s; } } }
  for (let i = 0; i < NM; i++) P[i] = re[i] * re[i] + im[i] * im[i];
  return P;
}
/* しきい値を超えたセルの連なりを 1 つのプロットにまとめ、電力で重みを付けた重心を求める */
function extractPlots(P, T){
  const out = []; let i = 0;
  while (i < NM){ if (P[i] > T){ let j = i, sw = 0, sx = 0; while (j < NM && P[j] > T){ sw += P[j]; sx += P[j] * j; j++; } out.push({i0: i, i1: j - 1, c: sx / sw}); i = j; } else i++; }
  return out;
}
function mergeTargets(sepPw, s1, s2){ const p1 = NM / 2 - sepPw * SPC / 2; return [{pos: p1, s: s1}, {pos: p1 + sepPw * SPC, s: s2}]; }
/* 2 目標が 2 つのプロットとして分かれて出る割合 */
function mergeProb(sepPw, s1, s2, T, trials, seed0){
  const o = {tg: mergeTargets(sepPw, s1, s2)}, P = new Float64Array(NM), lo = o.tg[0].pos - 1.5 * SPC, hi = o.tg[1].pos + 1.5 * SPC; let two = 0, one = 0;
  for (let t = 0; t < trials; t++){ mergeScan(o, (seed0 || 5000) + t, P); const pl = extractPlots(P, T).filter(q => q.c >= lo && q.c <= hi); if (pl.length >= 2) two++; else if (pl.length === 1) one++; }
  return {two: two / trials, one: one / trials};
}

/* ---------- 1スキャン分のデータに検出器をあてる ---------- */
function evalDet(sc, d, det, upDb){
  const hits = new Uint8Array(NC), r = {hits, thr: null, est: null, cnt: null};
  if (det === 'fixed'){ const T = thresholdFor(sc.n, sc.pfa) * (sc.up || 1); r.thr = new Float64Array(NC).fill(T); for (let c = 0; c < NC; c++) hits[c] = d.Y[c + MARG] > T ? 1 : 0; }
  else if (det === 'bin'){ const p0 = binP0(sc.n, sc.M, sc.pfa), T1 = -Math.log(p0); r.cnt = binCount(sc, d.P, T1); r.T1 = T1; r.p0 = p0; for (let c = 0; c < NC; c++) hits[c] = r.cnt[c] >= sc.M ? 1 : 0; }
  else { r.est = new Float64Array(NC); r.thr = cfarThreshold(sc, d.Y, det, null, r.est); for (let c = 0; c < NC; c++) hits[c] = d.Y[c + MARG] > r.thr[c] ? 1 : 0; }
  let det_ = 0, miss = 0, fa = 0; const isT = new Uint8Array(NC); for (const t of sc.tg) isT[t.cell] = 1;
  for (let c = 0; c < NC; c++){ if (isT[c]){ if (hits[c]) det_++; else miss++; } else if (hits[c]) fa++; }
  r.nDet = det_; r.nMiss = miss; r.nFa = fa; r.isT = isT; return r;
}
/* ---------- パルスの並び（ステップ4・5）：1つの距離セルを、アンテナが目標を横切る間のパルスごとに見たもの ----------
   目標はパルス p0 から n 個のパルスの間だけ見える（ビームの形は平らとする＝補足）。spike：干渉パルス（1発だけ非常に大きい） */
const NPS = 96;
function pulseSeq(o, seed){
  const rnd = mulberry32((seed * 40503 + 12345) | 0), x = new Float64Array(NPS), n = o.n, p0 = Math.round(NPS / 2 - n / 2), s = lin(o.snr);
  for (let i = 0; i < NPS; i++) x[i] = -Math.log(1 - rnd());
  const gam2 = () => -0.5 * Math.log((1 - rnd()) * (1 - rnd())); let a = s; if (o.sw === 1) a = -s * Math.log(1 - rnd()); else if (o.sw === 3) a = s * gam2();
  for (let k = 0; k < n; k++){ const ak = o.sw === 2 ? -s * Math.log(1 - rnd()) : o.sw === 4 ? s * gam2() : a, r = Math.sqrt(-Math.log(1 - rnd())), u = 2 * Math.PI * rnd(), re = Math.sqrt(ak) + r * Math.cos(u), im = r * Math.sin(u); x[p0 + k] = re * re + im * im; }
  if (o.spike) x[Math.round(NPS * 0.2)] = lin(o.spikeDb || 30);
  return {x, p0, spikeAt: o.spike ? Math.round(NPS * 0.2) : -1};
}
function movingSum(x, n){ const y = new Float64Array(x.length); let s = 0; for (let i = 0; i < x.length; i++){ s += x[i]; if (i >= n) s -= x[i - n]; y[i] = s; } return y; }   // 式7.5：S_i = S_{i−1} + x_i − x_{i−n}
function movingCount(x, n, T1){ const y = new Float64Array(x.length); let s = 0; for (let i = 0; i < x.length; i++){ if (x[i] > T1) s++; if (i >= n && x[i - n] > T1) s--; y[i] = s; } return y; }

/* クラッタマップのモンテカルロ：1 つのセルを何スキャンも追う。雑音だけのスキャンの誤警報と、「そのスキャンだけ目標がいた場合」の検出を数える。
   続けたスキャンはマップを通じて互いに相関があるので、数えるスキャンの間に L スキャンをはさむ（L はマップの記憶が 2% まで薄れるスキャン数）*/
function cmMcNew(K, n, pfa, sw, s){ const A = cmA(K, n, pfa), st = {trials: 0, K, n, A, sw, s, pfa, rnd: mulberry32(424242), S: 0, fa: 0, det: 0, L: Math.ceil(Math.log(0.02) / Math.log(K))}; for (let i = 0; i < 300; i++) st.S = K * st.S + cmNoise(st); return st; }
function cmNoise(st){ let pr = 1; for (let k = 0; k < st.n; k++) pr *= 1 - st.rnd(); return -Math.log(pr); }
function cmMcRun(st, N){
  const rnd = st.rnd, n = st.n, s = st.s, sw = st.sw, gam2 = () => -0.5 * Math.log((1 - rnd()) * (1 - rnd()));
  for (let i = 0; i < N; i++){
    for (let j = 0; j < st.L; j++) st.S = st.K * st.S + cmNoise(st);
    const x = cmNoise(st); let y = 0, a = s; if (sw === 1) a = -s * Math.log(1 - rnd()); else if (sw === 3) a = s * gam2();
    for (let k = 0; k < n; k++){ const ak = sw === 2 ? -s * Math.log(1 - rnd()) : sw === 4 ? s * gam2() : a, r = Math.sqrt(-Math.log(1 - rnd())), u = 2 * Math.PI * rnd(), re = Math.sqrt(ak) + r * Math.cos(u), im = r * Math.sin(u); y += re * re + im * im; }
    const T = st.A * st.S; if (x > T) st.fa++; if (y > T) st.det++; st.S = st.K * st.S + x; st.trials++;
  }
  return st;
}
