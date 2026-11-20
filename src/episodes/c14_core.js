/* ============================================================
   第14回 クラッタマップ：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第2章 MTI Radar §2.2（p.2.7–2.9：MTD とクラッタマップ）、§2.15 の Clutter Map の項（p.2.84–2.87、式2.61〜2.63、図2.89〜2.92）、p.2.78
                   第7章 §7.2（p.7.11、p.7.18–7.19：Clutter Mapping、式7.17・7.18）
   方針：一般的な原理だけを扱う。数値はハンドブックの例（α = 0.125、Pf = 10^-5 など）と、説明用の値。
   モデル：受信の強さ（電力）は、セルごと・スキャンごとに独立な指数分布（2 乗検波、スキャンごとにゆらぐ）。n パルスの積分は、n 個の平均。
           地図は、式2.61 の再帰フィルタ y(i) = (1−α)·y(i−1) + α·x(i)。判定は、式2.62 の x(i) ≥ kT·y(i−1)。
           誤警報確率・検出確率は、地図が「指数分布の重み付きの和」であることを使って、式で計算する（乱数による試行ではない）。
   ステップ 6（速度の応答）は、マップセルの中の 5 つ＋前後 1 つずつの分解能セルのうち、いちばん強い受信で地図を更新するとした（ハンドブックに細部がないので、こちらで決めた）。
   ステップ 7（MTD での使い方）は、平均の強さだけで 2 つのチャネルを比べる簡略モデル。
   ============================================================ */
const DEFAULTS = {thr: 12, p: 3, kdb: 9, v: 100, cdb: 30, x: 5, n: 1, seed: 1};
const S = Object.assign({}, DEFAULTS);
const alphaOf = p => Math.pow(2, -p);
const leff = a => (2 - a) / a;                                   // 式2.63：実効的な平均の回数
/* P(x > k·y)。x：形 n・尺度 thx のガンマ分布。y：独立なガンマ分布の和（terms = [{a: 尺度, c: 形}]）。y の積率母関数と、その微分から求める */
function pExceed(k, terms, thx, n){ const s = k / thx, M = [], L = [];
  let l0 = 0; for (const t of terms) l0 -= t.c * Math.log(1 + s * t.a); M[0] = Math.exp(l0);
  let fact = 1; for (let r = 1; r < n; r++){ if (r > 1) fact *= (r - 1); let v = 0; for (const t of terms) v += t.c * Math.pow(t.a / (1 + s * t.a), r); L[r] = (r % 2 ? -1 : 1) * fact * v; }
  const C = (a, b) => { let v = 1; for (let i = 0; i < b; i++) v = v * (a - i) / (i + 1); return v; };
  for (let m = 1; m < n; m++){ let v = 0; for (let i = 0; i < m; i++) v += C(m - 1, i) * M[i] * L[m - i]; M[m] = v; }
  let p = 0, sm = 1, f = 1; for (let m = 0; m < n; m++){ if (m > 0){ sm *= s; f *= m; } p += sm / f * (m % 2 ? -1 : 1) * M[m]; } return Math.max(0, Math.min(1, p)); }
function mapTerms(alpha, n, meanFn){ const t = []; for (let j = 0; j < 2000; j++){ const w = alpha * Math.pow(1 - alpha, j); if (w < 1e-13) break; t.push({a: w * (meanFn ? meanFn(j) : 1) / n, c: n}); } return t; }      // j：何スキャン前か（0 がいちばん新しい）
const pfaOf = (k, alpha, n) => pExceed(k, mapTerms(alpha, n), 1 / n, n);
const KC = {};
function kFor(pfa, alpha, n){ const key = [pfa, alpha, n].join('/'); if (KC[key] === undefined){ const T = mapTerms(alpha, n); let lo = 0, hi = 1e5; for (let i = 0; i < 90; i++){ const m = (lo + hi) / 2; if (pExceed(m, T, 1 / n, n) > pfa) lo = m; else hi = m; } KC[key] = (lo + hi) / 2; } return KC[key]; }
const pdMap = (k, alpha, n, snr) => pExceed(k, mapTerms(alpha, n), (1 + snr) / n, n);      // 目標のいるセル：平均が (1 + S/N) 倍
function reqSnr(pd, pfa, alpha, n){ const k = kFor(pfa, alpha, n); let lo = 1e-3, hi = 1e7; for (let i = 0; i < 90; i++){ const m = Math.sqrt(lo * hi); if (pdMap(k, alpha, n, m) < pd) lo = m; else hi = m; } return hi; }
const gQ = (n, z) => { let s = 0, t = 1; for (let m = 0; m < n; m++){ if (m > 0) t *= z / m; s += t; } return Math.exp(-z) * s; };      // 平均 1 の指数分布 n 個の和が z を超える確率
function idealSnr(pd, pfa, n){ let lo = 0, hi = 1e4; for (let i = 0; i < 90; i++){ const m = (lo + hi) / 2; if (gQ(n, m) > pfa) lo = m; else hi = m; } const z = hi; lo = 1e-3; hi = 1e7; for (let i = 0; i < 90; i++){ const m = Math.sqrt(lo * hi); if (gQ(n, z / (1 + m)) < pd) lo = m; else hi = m; } return hi; }      // 背景の平均が正確に分かっている場合
const LC = {};
function lossDb(x, alpha, n){ const key = [x, alpha, n].join('/'); if (LC[key] === undefined){ const pfa = Math.pow(10, -x); LC[key] = db10(reqSnr(0.5, pfa, alpha, n) / idealSnr(0.5, pfa, n)); } return LC[key]; }      // クラッタマップ損失（検出確率 0.5 で比べる）
function caLoss(x, N){ const pfa = Math.pow(10, -x), k = N * (Math.pow(pfa, -1 / N) - 1); let lo = 1e-3, hi = 1e7; for (let i = 0; i < 90; i++){ const m = Math.sqrt(lo * hi); if (Math.pow(1 + k / (N * (1 + m)), -N) < 0.5) lo = m; else hi = m; } return db10(hi / idealSnr(0.5, pfa, 1)); }      // セル平均 CFAR（参照セル N 個）の損失
/* 立ち上がり：雑音だけの地図に、点状のクラッタ（平均が雑音の C 倍）が現れてから i スキャン目に、それを検出してしまう確率（図2.91 の条件：C = 20 dB、n = 4、Pf = 10^-6） */
function transient(alpha, n, cdb, pfa, N){ const C = Math.pow(10, cdb / 10), k = kFor(pfa, alpha, n), out = []; for (let i = 1; i <= N; i++) out.push(pExceed(k, mapTerms(alpha, n, j => j < i - 1 ? 1 + C : 1), (1 + C) / n, n)); return out; }
/* 速度の応答（図2.92 の条件）：マップセル = 分解能セル 5 つ、前後 1 セルずつ広げて更新（スプレッディング）、n = 4、α = 0.125、スキャン 5 秒、分解能セル 1 µs（150 m）、S/N = 20 dB。
   地図の更新には、範囲（7 セル）の中でいちばん強い受信を使うとした（ハンドブックに細部がないので、こちらで決めた）。雑音だけのときの「7 個の最大値」は、平均と分散を合わせたガンマ分布で近似する */
const VEL = {al: 0.125, n: 4, snr: 100, M: 5, sp: 1, T: 5, dr: 150, pfa: 1e-6, kt: 0.5144, c: {}, mx: null, k: null};
const cellsPerScan = v => v * VEL.kt * VEL.T / VEL.dr;
function velSetup(){ if (VEL.mx) return; const Z = VEL.M + 2 * VEL.sp, n = VEL.n; let m1 = 0, m2 = 0, prev = 0; const dz = 0.001; for (let t = dz; t < 12; t += dz){ const F = Math.pow(1 - gQ(n, n * t), Z), pr = F - prev, tm = t - dz / 2; m1 += tm * pr; m2 += tm * tm * pr; prev = F; }
  const v = m2 - m1 * m1; VEL.mx = {a: v / m1, c: m1 * m1 / v}; let lo = 0, hi = 1e3; const T0 = velTerms(); for (let i = 0; i < 80; i++){ const m = (lo + hi) / 2; if (pExceed(m, T0, 1 / n, n) > VEL.pfa) lo = m; else hi = m; } VEL.k = hi; }
function velTerms(inz){ const T = []; for (let j = 0; j < 300; j++){ const w = VEL.al * Math.pow(1 - VEL.al, j); if (w < 1e-12) break; if (inz && inz(j)) T.push({a: w * (1 + VEL.snr) / VEL.n, c: VEL.n}); else T.push({a: w * VEL.mx.a, c: VEL.mx.c}); } return T; }
const inZone = (pos, d, j) => { const pj = pos - (j + 1) * d; return pj >= -VEL.sp && pj < VEL.M + VEL.sp; };      // j+1 スキャン前に、目標が地図の更新の範囲にいたか
function velResp(v){ velSetup(); if (VEL.c[v] !== undefined) return VEL.c[v]; const d = cellsPerScan(v), np = 40; let acc = 0;
  for (let ph = 0; ph < np; ph++){ const pos = (ph + 0.5) / np * VEL.M; acc += pExceed(VEL.k, velTerms(j => inZone(pos, d, j)), (1 + VEL.snr) / VEL.n, VEL.n); }
  return VEL.c[v] = acc / np; }
const vCut = () => (VEL.M + VEL.sp) * VEL.dr / VEL.T / VEL.kt;      // 1 スキャンで、地図を更新する範囲の外へ必ず出る速度 [ノット]
/* ステップ 1 の場面：方位 120 本（3° きざみ）× 距離のセル 100 個 = 12,000 マス。丘（雑音より 15 dB 強い）、尾根（12 dB）、建物や鉄塔（点のクラッタ、20〜30 dB）、町（点が集まった所）。
   距離の図は、方位 45° の 1 本を切り出したもの：丘（セル 20〜40）、建物（セル 60、30 dB）、鉄塔（セル 75、22 dB）。目標 A：セル 10（雑音の中、S/N 15 dB）。目標 B：セル 30（丘の上。雑音に対して 30 dB） */
const SCN = {N: 100, NA: 120, ia0: 15, A: {c: 10, s: Math.pow(10, 1.5)}, B: {c: 30, s: Math.pow(10, 3.0)}, al: 0.125, pfa: 1e-5, m: null, e: null, y: null, img: null,
  pt: [[15, 60, 30], [15, 75, 22], [40, 30, 26], [100, 45, 28], [111, 82, 21], [32, 66, 24], [84, 20, 23]]};      // 点のクラッタ：[方位の番号, 距離のセル, 強さ dB]
function scnSetup(){ if (SCN.m) return; const r = mulberry32(1414), m = new Float64Array(SCN.NA * SCN.N).fill(1), e = new Float64Array(SCN.NA * SCN.N), y = new Float64Array(SCN.NA * SCN.N), set = (ia, c, v) => { m[ia * SCN.N + c] = v; };
  for (let ia = 7; ia <= 23; ia++){ const t = Math.round(Math.abs(ia - 15) * 0.75); for (let c = 20 + t; c <= 40 - t; c++) set(ia, c, Math.pow(10, 1.5)); }      // 丘
  for (let ia = 65; ia <= 85; ia++){ const t = Math.round(Math.abs(ia - 75) * 0.5); for (let c = 55 + t; c <= 68 - t; c++) set(ia, c, Math.pow(10, 1.2)); }      // 尾根
  for (let ia = 50; ia <= 57; ia++) for (let c = 10; c <= 18; c++) if (r() < 0.4) set(ia, c, Math.pow(10, 1.8 + 0.9 * r()));      // 町
  for (const q of SCN.pt) set(q[0], q[1], Math.pow(10, q[2] / 10));
  for (let i = 0; i < m.length; i++){ e[i] = -Math.log(1 - r()); y[i] = m[i] * (0.78 + 0.44 * r()); }      // e：今のスキャンのゆらぎ。y：地図の値（平均のまわりに少しばらつく）
  SCN.m = m; SCN.e = e; SCN.y = y; }
const scnMean = c => { scnSetup(); return SCN.m[SCN.ia0 * SCN.N + c]; };
function fixedStats(tdb){ scnSetup(); const T = Math.pow(10, tdb / 10); let fa = 0; for (let i = 0; i < SCN.m.length; i++) fa += Math.exp(-T / SCN.m[i]); return {fa, pdA: Math.exp(-T / (scnMean(SCN.A.c) + SCN.A.s)), pdB: Math.exp(-T / (scnMean(SCN.B.c) + SCN.B.s))}; }      // 12,000 マス全体での、誤警報の数の平均
function mapStats(){ scnSetup(); const k = kFor(SCN.pfa, SCN.al, 1); return {k, fa: SCN.NA * SCN.N * SCN.pfa, pdA: pdMap(k, SCN.al, 1, SCN.A.s / scnMean(SCN.A.c)), pdB: pdMap(k, SCN.al, 1, SCN.B.s / scnMean(SCN.B.c))}; }
function scnDraw(seed){ const r = mulberry32(1400 + seed), ex = m => -m * Math.log(1 - r()), y = [], x = []; for (let c = 0; c < SCN.N; c++){ let v = scnMean(c); for (let i = 0; i < 60; i++) v = (1 - SCN.al) * v + SCN.al * ex(scnMean(c)); y.push(v); x.push(ex(scnMean(c) + (c === SCN.A.c ? SCN.A.s : c === SCN.B.c ? SCN.B.s : 0))); } return {x, y}; }
/* PPI の絵：地図の値を、レーダを中心にした円の上に並べ直す（北が上、時計回り）。円の外は値なし */
function ppiImg(){ scnSetup(); if (SCN.img) return SCN.img; const G = 200, db = new Float64Array(G * G);
  for (let iy = 0; iy < G; iy++) for (let ix = 0; ix < G; ix++){ const x = (ix + 0.5) / G * 200 - 100, y = (iy + 0.5) / G * 200 - 100, rr = Math.hypot(x, y); if (rr >= 100){ db[iy * G + ix] = NaN; continue; }
    let az = Math.atan2(x, y) * 180 / Math.PI; if (az < 0) az += 360; const ia = Math.round(az / 3) % SCN.NA; db[iy * G + ix] = 10 * Math.log10(SCN.y[ia * SCN.N + Math.floor(rr)]); }
  return SCN.img = {db, G}; }
const ppiXY = (ia, c) => { const a = ia * 3 * Math.PI / 180; return [(c + 0.5) * Math.sin(a), (c + 0.5) * Math.cos(a)]; };
function ppiCross(tdb){ scnSetup(); const T = Math.pow(10, tdb / 10), x = [], y = []; for (let ia = 0; ia < SCN.NA; ia++) for (let c = 0; c < SCN.N; c++){ const i = ia * SCN.N + c; if (SCN.m[i] * SCN.e[i] > T){ const q = ppiXY(ia, c); x.push(q[0]); y.push(q[1]); } } return {x, y}; }      // 今のスキャンで、固定のしきい値を超えたマス（目標は除く）
/* ステップ 2：1 つのセルの受信の強さ（スキャンごと）と、地図の値。途中（スキャン 30）で、背景の平均が 10 dB から 16 dB に変わる */
function cellSeries(alpha, seed){ const r = mulberry32(1450 + seed), N = 80, x = [], y = [], m = []; let v = 10; for (let i = 0; i < N; i++){ const mu = i < 30 ? 10 : 40, xi = -mu * Math.log(1 - r()); v = (1 - alpha) * v + alpha * xi; x.push(xi); y.push(v); m.push(mu); } return {x, y, m, N}; }
const settle = alpha => alpha >= 1 ? 1 : Math.ceil(Math.log(0.1) / Math.log(1 - alpha));      // 変化の 9 割まで追いつくスキャン数
/* ステップ 7：MTD での使い方（簡略モデル）。ゼロ速度のチャネル：背景 = クラッタ + 雑音。動く目標のチャネル：背景 = クラッタ ÷ 改善度 + 雑音。どちらも、地図から作ったしきい値で判定 */
const MTD = {snr: Math.pow(10, 2.5), idb: 40, al: 0.125, pfa: 1e-5};
function mtdOf(cdb){ const C = Math.pow(10, cdb / 10), k = kFor(MTD.pfa, MTD.al, 1), bz = 1 + C, bm = 1 + C / Math.pow(10, MTD.idb / 10); return {k, bz, bm, pz: pdMap(k, MTD.al, 1, MTD.snr / bz), pm: pdMap(k, MTD.al, 1, MTD.snr / bm)}; }
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  add('実効的な平均回数 Leff（式2.63）。α = 0.125', 'Leff = 15', 'Leff = ' + fx(leff(0.125), 1), near(leff(0.125), 15, 1e-9), 'p.2.85');
  { const v = lossDb(5, 0.125, 1); add('クラッタマップ損失。Pf = 10⁻⁵、α = 0.125（x/Leff = 0.33）', '1.8 dB（p.2.85 の例。図2.90 の曲線から）', fx(v, 2) + ' dB（1 回の受信信号で判定、2 乗検波、検出確率 0.5、スキャンごとに変動する目標として計算）', Math.abs(v - 1.8) <= 0.15 ? 'ok' : 'info', '0.3 dB の差。図2.90 は複数の解析の結果を 1 本にまとめた曲線。Pf = 10⁻⁶（x/Leff = 0.4）で計算すると ' + fx(lossDb(6, 0.125, 1), 2) + ' dB'); }
  { const a1 = 2 / 6, a2 = 2 / 3.5, v1 = lossDb(5, a1, 1), v2 = lossDb(5, a2, 1); add('図2.90 の曲線の値（x/Leff = 1 と 2）', '約 3.8 dB、約 7.2 dB（図の読み取り値）', fx(v1, 1) + ' dB（Leff = ' + fx(leff(a1), 1) + '）、' + fx(v2, 1) + ' dB（Leff = ' + fx(leff(a2), 1) + '）。Pf = 10⁻⁵', Math.abs(v1 - 3.8) <= 0.5 && Math.abs(v2 - 7.2) <= 0.7 ? 'ok' : 'info', 'p.2.86。読み取りの誤差を含む'); }
  { const m = lossDb(5, 2 / 6, 1), c = caLoss(5, 5); add('図2.90：同じ x/Leff では、セル平均 CFAR の損失のほうが大きい（x/Leff = 1）', 'CFAR の曲線が上にある', 'クラッタマップ ' + fx(m, 1) + ' dB、セル平均 CFAR（参照セル 5 個）' + fx(c, 1) + ' dB', c > m ? 'ok' : 'ng', 'p.2.86。CFAR は参照セルを等しい重み付けで平均する場合'); }
  { const K = 7 / 8; add('第7章の式7.18（S = K·S + X）で K = 7/8 の場合に、何スキャン分の平均に相当するか', '直近の 8 スキャンを平均することに相当（p.7.19）', '重み係数の合計 1 ÷ (1 − K) = ' + fx(1 / (1 - K), 0) + '。式2.61 の α = 1 − K = ' + fx(1 - K, 3) + ' と同じフィルタ', near(1 / (1 - K), 8, 1e-9), '第2章と第7章で式の表し方は異なるが、同じ再帰フィルタ'); }
  { const t = transient(0.125, 4, 20, 1e-6, 30), at = p => { for (let i = 0; i < t.length; i++) if (t[i] <= p) return i + 1; return '30 超'; }; add('過渡応答（図2.91）：雑音より 20 dB 強い点状のクラッタ、α = 0.125、4 回の受信信号を積分、Pf = 10⁻⁶。検出する確率が 10⁻¹／10⁻²／10⁻³／10⁻⁴ を下回るスキャン', '約 4.5／7／9.5／12.5 スキャン（図の読み取り値）。30 スキャンで 10⁻⁶ に近づく', at(1e-1) + '／' + at(1e-2) + '／' + at(1e-3) + '／' + at(1e-4) + ' スキャン目。30 スキャン目は ' + sci(t[29], 1), 'info', 'p.2.85–2.86。形は同じで、計算のほうが約 1 スキャン早い結果。検波や積分の方法の細部が、図のもとの解析と異なる可能性がある'); }
  { const v0 = vCut(), p350 = velResp(350); add('速度の応答（図2.92）：検出確率が 1 に達する速度', '約 350 ノット（図の読み取り値）', '1 スキャンでマップの更新の範囲（5 + 1 セル）を出る速度 = ' + fx(v0, 0) + ' ノット。350 ノットでの検出確率 ' + fx(p350, 3), Math.abs(v0 - 350) < 10 && p350 > 0.99 ? 'ok' : 'info', 'p.2.86–2.87。マップセル 5 µs、スキャン 5 秒');
    add('速度の応答（図2.92）：低速側の検出確率（50／100／200 ノット）', '約 0.3／0.6／0.8（図の読み取り値）', fx(velResp(50), 2) + '／' + fx(velResp(100), 2) + '／' + fx(velResp(200), 2), 'info', '曲線の形（急激に立ち上がり、その後 350 ノットまで緩やかに 1 へ近づく）は同じ。値は約 0.1 高い結果。マップの更新方法の細部がハンドブックに記載されていないため、このシミュレータで設定したモデル（範囲の中で最も強い受信信号で更新。補足）で計算している'); }
  { const r = mulberry32(77), al = 0.125, k = kFor(1e-3, al, 1), N = 400000; let y = 1, c = 0; for (let i = 0; i < N; i++){ const x = -Math.log(1 - r()); if (x > k * y) c++; y = (1 - al) * y + al * x; } const w = wilson(c, N); add('誤警報確率の式の確認（乱数による試行）。設計値 10⁻³、α = 0.125', '（基準なし）10⁻³', sci(c / N, 2) + '（' + N / 10000 + ' 万回の試行。95% 信頼区間 ' + sci(w[0], 2) + '〜' + sci(w[1], 2) + '）', w[0] <= 1e-3 && 1e-3 <= w[1] ? 'ref' : 'ng', 'このシミュレータの計算の自己点検'); }
  return R;
}
