/* ============================================================
   中級 第1回 検出の計算（必要な S/N と探知距離を、自分で出す）：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第4章 Pulse Doppler Radar §4.6 Range Performance（p.4.39–4.48）、式4.2 の記号の定義（§4.2、p.4.16）
                   第1章 §1.4（式1.5）→ 入門 第15回／第7章 §7.2（2 値積分）→ 入門 第4回
   方針：一般的な原理だけを扱う。例のレーダの値は、入門 第15回の基準のレーダを §4.6 の記号に直したもの（説明用。実在の装置の値ではない）。

   PDF のページを画像で見て確かめた式（記号は原本のまま）：
   式4.15  SNR = (Ro/R)^4
   式4.16  Ro = [ Pav·GT·GR·λ²·σT / ((4π)³·k·Ts·Bn·LT) ]^(1/4)      Ro：SNR が 1 になる距離。LT：目標にかかる損失
           Pav：平均送信電力、GT・GR：送信・受信の利得、λ：波長、k：ボルツマン定数、Ts：システム雑音温度、Bn：ドップラフィルタの帯域幅（式4.2 の下、p.4.16）
           SNR は、整合フィルタ・パルス圧縮・ドップラフィルタのあとの値（1 つの CPI についての値）。
   式4.17  エクリプシングとレンジゲートのストラドルの損失（近似）= 12N / (7N − 6)      N：IPP の中のレンジゲートの数。Pd が 0.5 に近いときだけ有効
   式4.18  PFA = (1/Nr)·[ Td·ln2 / ( C·Nf·NFM^(m−1)·TFR ) ]^(1/m)      1 ルック（m = n = 1）なら PFA = Td·ln2 / (Nr·Nf·TFR)
           TFR：誤報の時間（その時間内に 1 回以上の誤報が出る確率が 0.5）。TFR ≈ TAVG·ln2
           二項係数は、原本では上に m、下に n を書き、n!/[m!(n−m)!] と定義している（p.4.44）。
   式4.22  Pd = (1/2)·erfc( √(−0.8·ln[4·PFA(1−PFA)]) + √(Npdi/2 − 1/2) − √(Npdi·SNR + Npdi/2 − 1/2) )      ゆらがない目標
           ※ 原本の式4.22 は、2 つの根号の中がどちらも「−1/2」と印刷されている。式4.23 を P_d について解くと、ここは「−1/4」になる。
             印刷どおりの形は、厳密な計算から大きくずれる（P_FA = 10^-6、N = 1、S/N 10 dB で 0.505。厳密な値は 0.248）。「−1/4」とすると 0.261。
             ここでは「−1/4」の形（式4.23 と合う形）で計算し、印刷どおりの形は照合表にだけ出す。
   式4.23  SNRreqd = η²/Npdi + (2η/Npdi)·√(Npdi/2 − 1/4)
           η = √(−0.8·ln[4·PFA(1−PFA)]) − sign(0.5 − Pd)·√(−0.8·ln[4·Pd(1−Pd)])
   式4.24  Pd = Km[ ( Km⁻¹(PFA, 2Npdi) − 2(Npdi − ne) ) / ( (Npdi/ne)·SNR + 1 ), 2ne ]
   式4.25  SNR = [ ( Km⁻¹(PFA, 2Npdi) − 2(Npdi − ne) ) / Km⁻¹(Pd, 2ne) − 1 ]·ne/Npdi
           ※ 原本の式4.25 は、分子の最初の項が Km⁻¹(Pd, 2ne) と印刷されているように読める。式4.24 を SNR について解くと、
             分子は Km⁻¹(PFA, 2Npdi) になる。ここでは、式4.24 と合う形（上の形）で計算する。
           ne = 1（Swerling 1）、Npdi（2）、2（3）、2·Npdi（4）
           Km(x, d) = 1 − P(d/2, x/2)（カイ二乗分布の上側確率）、P(a, x)：正則化した不完全ガンマ関数
   式4.26  Pd,dwell = Σ(k = m..n) C(n, k)·Pd,look^k·(1 − Pd,look)^(n−k)
           ※ 原本は二項係数を、上に k、下に n と書いている（式4.18 と同じ書き方）。ここでは C(n, k) = n!/[k!(n−k)!] で計算する。
   式4.27  Pd,cum[k] = 1 − Π(i = 1..k) [1 − Pd,ss[i]] = Pd,cum[k−1] + Pd,ss[k]·(1 − Pd,cum[k−1])
           ※ 原本の 2 行目の最後は (1 − Pd,cum[k]) と印刷されているように読める。1 行目（積の形）と合うのは [k−1]。計算は積の形で行う。

   モデル（補足）：
   ・厳密な計算（照合用）：ゆらがない目標は、非心カイ二乗分布の級数（入門 第4回の pdNF と同じ）と、N = 1 では Marcum の Q 関数の数値積分。
     Swerling 2・4 は閉じた式（ガンマ分布、ガンマ分布の混合）。Swerling 1・3 は、目標の強さの分布で pdNF を数値的に平均する（Swerling 1 は、閉じた式 pdSw1 でも確かめる）。
   ・累積の検出確率（ステップ 8）：SNR = (Ro/R)^4、目標は一定の速さで近づく。走査ごとの検出は独立（Swerling 1、走査ごとに独立にゆらぐ）。
     平均電力が同じなら、Ro^4 がフレーム時間に比例するとした。最初の走査の位置（位相）は、一様にばらつくとして平均する。
   ============================================================ */
const KT0 = 4e-21, C0 = 3e8;
/* 例のレーダ（説明用。入門 第15回の基準のレーダを §4.6 の記号に直したもの）と、標準の条件 */
const EX = {pav: 1000, ae: 1.6, lam: 0.1, rcs: 1, fn: 3, bn: 62.5, td: 0.016, nr: 100, nf: 16, tavg: 10, pd: 0.9, ngate: 10, rcum: 100, tf0: 4, v: 600};
const LOSS = [['送信の損失（送信機からアンテナまで）', 1.0, 0], ['レドーム（往復）', 0.5, 0], ['伝搬（大気。往復）', 0.8, 0], ['走査（ビームを振ったときの利得の低下。往復）', 1.0, 0], ['ビーム形状', 1.3, 1], ['受信の損失（アンテナから初段の増幅器まで）', 0.8, 0], ['整合フィルタ', 0.5, 0], ['量子化', 0.1, 0], ['パルス圧縮のずれ（重み付け）', 1.0, 0],
  ['エクリプシングとレンジゲートのストラドル', null, 1], ['ドップラフィルタの重み付け', 1.5, 0], ['ドップラフィルタのストラドル', 0.6, 1], ['CFAR', 1.0, 1], ['ガード（ブランキング）', 0.2, 1]];      // [項目, dB（null は式4.17 で計算）, 目標だけにかかるか]
const DEFAULTS = {ltavg: 1, cells: 1600, x: 6, pd: 0.9, sw: 0, npdi: 1, m: 2, n: 3, pl: 0.7, ladj: 0, pavdb: 0, dr: 10, ltf: 0.602, seed: 1};
const S = Object.assign({}, DEFAULTS);
const lin = d => Math.pow(10, d / 10);
/* ---- 特殊関数 ---- */
function gammaln(x){ const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (let j = 0; j < 6; j++) s += c[j] / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function gammaP(a, x){      // 正則化した不完全ガンマ関数 P(a, x)。x < a + 1 は級数、それ以外は連分数
  if (x <= 0) return 0;
  if (x < a + 1){ let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 500; n++){ ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-15) break; } return sum * Math.exp(-x + a * Math.log(x) - gammaln(a)); }
  return 1 - gammaQcf(a, x);
}
function gammaQcf(a, x){ const tiny = 1e-300; let b = x + 1 - a, c = 1 / tiny, d = 1 / b, h = d; for (let i = 1; i < 500; i++){ const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < tiny) d = tiny; c = b + an / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-15) break; } return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h; }
function gammaQ(a, x){ if (x <= 0) return 1; return x < a + 1 ? 1 - gammaP(a, x) : gammaQcf(a, x); }      // 上側 Q(a, x) = 1 − P(a, x)（小さい値も正確に）
const Km = (x, d) => gammaQ(d / 2, x / 2);                                                                   // カイ二乗分布の上側確率
const KMC = new Map();
function KmInv(p, d){ const key = p + '/' + d, c = KMC.get(key); if (c !== undefined) return c; const v = KmInv0(p, d); if (KMC.size < 20000) KMC.set(key, v); return v; }
function KmInv0(p, d){ let lo = 0, hi = d + 10; while (Km(hi, d) > p) hi *= 2; for (let i = 0; i < 200; i++){ const m = (lo + hi) / 2; if (Km(m, d) > p) lo = m; else hi = m; if (hi - lo < 1e-13 * hi) break; } return (lo + hi) / 2; }
const erfc = x => x >= 0 ? gammaQ(0.5, x * x) : 2 - gammaQ(0.5, x * x);
/* ---- §4.6 の式 ---- */
const etaA = p => Math.sqrt(-0.8 * Math.log(4 * p * (1 - p)));
const etaOf = (pd, pfa) => etaA(pfa) - Math.sign(0.5 - pd) * etaA(pd);
function pd422(snr, pfa, N){ return 0.5 * erfc(etaA(pfa) + Math.sqrt(N / 2 - 0.25) - Math.sqrt(N * snr + N / 2 - 0.25)); }                       // 式4.22（式4.23 と合う形：根号の中を −1/4 とした）
function pd422print(snr, pfa, N){ return 0.5 * erfc(etaA(pfa) + Math.sqrt(N / 2 - 0.5) - Math.sqrt(N * snr + N / 2 - 0.5)); }                    // 式4.22（原本に印刷されている形：−1/2）
function snr423(pd, pfa, N){ const e = etaOf(pd, pfa); return e * e / N + 2 * e / N * Math.sqrt(N / 2 - 0.25); }                                // 式4.23
const neOf = (sw, N) => sw === 1 ? 1 : sw === 2 ? N : sw === 3 ? 2 : 2 * N;
function pd424(snr, pfa, N, ne){ return Km((KmInv(pfa, 2 * N) - 2 * (N - ne)) / (N / ne * snr + 1), 2 * ne); }                                  // 式4.24
function snr425(pd, pfa, N, ne){ return ((KmInv(pfa, 2 * N) - 2 * (N - ne)) / KmInv(pd, 2 * ne) - 1) * ne / N; }                                // 式4.25（式4.24 と合う形）
const pdApprox = (snr, pfa, N, sw) => sw === 0 ? pd422(snr, pfa, N) : pd424(snr, pfa, N, neOf(sw, N));
const snrApprox = (pd, pfa, N, sw) => sw === 0 ? snr423(pd, pfa, N) : snr425(pd, pfa, N, neOf(sw, N));
function binom(n, k){ let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
function mOfN(m, n, p){ let s = 0; for (let k = m; k <= n; k++) s += binom(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k); return s; }      // 式4.26
function mOfNinv(m, n, P){ let lo = 0, hi = 1; for (let i = 0; i < 100; i++){ const q = (lo + hi) / 2; if (mOfN(m, n, q) < P) lo = q; else hi = q; } return (lo + hi) / 2; }      // ドウェルで P になる、1 ルックの確率
function cumPd(ps){ const out = []; let q = 1; for (const p of ps){ q *= 1 - p; out.push(1 - q); } return out; }                             // 式4.27（積の形）
const pfaCell = (td, nr, nf, tfr) => td * Math.LN2 / (nr * nf * tfr);                                                                       // 式4.18 で m = n = 1
const eclApprox = N => 12 * N / (7 * N - 6);                                                                                                // 式4.17
/* 式4.16。G·Ae = GT·GR·λ²/(4π) なので、入門 第15回の式1.5 と同じ形に書ける。k·Ts = kT0·Fn とした */
function roOf(o){ const g = 4 * Math.PI * o.ae / (o.lam * o.lam); return Math.pow(o.pav * g * g * o.lam * o.lam * o.rcs / (Math.pow(4 * Math.PI, 3) * KT0 * lin(o.fn) * o.bn * lin(o.lt)), 0.25); }
/* 入門 第15回（c15_core.js）から写した式：式1.5 */
function rmax15(p){ return Math.pow(p.pav * p.g * p.ae * p.rcs * p.n * p.ei * Math.pow(p.F, 4) / (16 * Math.PI * Math.PI * KT0 * p.Fn * p.fp * p.snr1 * p.Ls), 0.25); }
/* ---- 厳密な計算（照合用） ---- */
function pdNF(n, s, T){      // 入門 第4回（legacy/ccore.js）と同じ：ゆらがない目標、n 個の和、しきい値 T（雑音の平均を 1 とした値）
  const lam = n * s; if (!(lam > 0)) return gammaQ(n, T);
  if (n + lam - T > 12 * Math.sqrt(n + 2 * lam)) return 1;
  const k0 = Math.floor(lam), kmax = k0 + Math.ceil(12 * Math.sqrt(lam + 1)) + 30, q = new Float64Array(kmax + 1);
  let t = Math.exp(-T), acc = 0; for (let j = 0; j < n; j++){ acc += t; t *= T / (j + 1); }
  for (let k = 0; k <= kmax; k++){ q[k] = acc; acc += t; t *= T / (n + k + 1); }
  const p0 = Math.exp(-lam + k0 * Math.log(lam) - gammaln(k0 + 1)); let sum = 0, p = p0;
  for (let k = k0; k <= kmax; k++){ sum += p * q[k]; p *= lam / (k + 1); if (p < 1e-18 && k > k0 + 5) break; }
  p = p0; for (let k = k0 - 1; k >= 0; k--){ p *= (k + 1) / lam; sum += p * q[k]; if (p < 1e-18) break; }
  return Math.min(1, sum);
}
const thrOf = (pfa, N) => KmInv(pfa, 2 * N) / 2;                                            // N 個の和（雑音の平均 1）のしきい値
function marcumInt(s, T){      // N = 1 の検出確率を、数値積分で：∫_T^∞ exp(−(v+s))·I0(2√(vs)) dv（Simpson 則。I0 は指数を掛けて桁あふれを防ぐ）
  const i0e = x => { if (x < 3.75){ const y = (x / 3.75) * (x / 3.75); return Math.exp(-x) * (1 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492 + y * (0.2659732 + y * (0.0360768 + y * 0.0045813)))))); } const y = 3.75 / x; return (0.39894228 + y * (0.01328592 + y * (0.00225319 + y * (-0.00157565 + y * (0.00916281 + y * (-0.02057706 + y * (0.02635537 + y * (-0.01647633 + y * 0.00392377)))))))) / Math.sqrt(x); };
  const f = v => { const a = 2 * Math.sqrt(v * s); return Math.exp(-(Math.sqrt(v) - Math.sqrt(s)) * (Math.sqrt(v) - Math.sqrt(s))) * i0e(a); }, hi = Math.pow(Math.sqrt(s) + 9, 2) + T, n = 4000, h = (hi - T) / n; if (hi <= T) return 0;
  let sum = f(T) + f(hi); for (let i = 1; i < n; i++) sum += f(T + i * h) * (i % 2 ? 4 : 2); return Math.min(1, sum * h / 3);
}
function pdExact(snr, pfa, N, sw){
  const T = thrOf(pfa, N);
  if (sw === 0) return pdNF(N, snr, T);
  if (sw === 2) return gammaQ(N, T / (1 + snr));                                            // 各 CPI が独立な指数分布 → ガンマ分布
  if (sw === 4){ const c = 1 + snr / 2, b = (snr / 2) / c; let s = 0; for (let k = 0; k <= N; k++) s += binom(N, k) * Math.pow(1 - b, N - k) * Math.pow(b, k) * gammaQ(N + k, T / c); return s; }      // ガンマ分布の混合
  if (sw === 1 && N === 1) return Math.exp(-T / (1 + snr));
  /* Swerling 1・3：ドウェルの中では同じ強さ。強さの分布（平均 1 の指数分布、または自由度 4 のカイ二乗）で平均する。変数変換して台形則 */
  const n = 500, zmax = sw === 1 ? 40 : 30; let acc = 0, wsum = 0;
  for (let i = 0; i < n; i++){ const u = (i + 0.5) / n, z = zmax * u * u * u, w = (sw === 1 ? Math.exp(-z) : 4 * z * Math.exp(-2 * z)) * u * u; acc += w * pdNF(N, snr * z, T); wsum += w; }      // z = zmax·u³ と置いて、0 の近くを細かく刻む
  return acc / wsum;
}
/* Swerling 1 の閉じた式（N ≥ 2。一般に知られた式）：確かめ用 */
function pdSw1(snr, pfa, N){ const T = thrOf(pfa, N); if (N === 1) return Math.exp(-T / (1 + snr)); const a = 1 + 1 / (N * snr); return 1 - gammaP(N - 1, T) + Math.pow(a, N - 1) * gammaP(N - 1, T / a) * Math.exp(-T / (1 + N * snr)); }
function snrExact(pd, pfa, N, sw){ let lo = -30, hi = 70; for (let i = 0; i < 44; i++){ const m = (lo + hi) / 2; if (pdExact(lin(m), pfa, N, sw) < pd) lo = m; else hi = m; } return (lo + hi) / 2; }      // [dB]
/* ---- エクリプシングとレンジゲートのストラドル（p.4.41 の 4 段の手順。ゲートの重なりなし、IPP の中に N ゲート、最初の 1 つは送信） ---- */
function eclPower(x, N){ const t = x * N, k = Math.floor(t), f = t - k; const v = k === 0 ? f : k === N - 1 ? 1 - f : Math.max(f, 1 - f); return v * v; }      // 遅れ x（IPP に対する割合）での、整合フィルタの出力の電力（最大 1）
function eclPd(snrDb, pfa, N){ const n = 400; let a = 0; const T = thrOf(pfa, 1); for (let i = 0; i < n; i++) a += pdNF(1, lin(snrDb) * eclPower((i + 0.5) / n, N), T); return a / n; }      // 遅れが一様にばらつくとして、検出確率を平均
function eclLoss(pd, pfa, N){ let lo = 0, hi = 60; for (let i = 0; i < 50; i++){ const m = (lo + hi) / 2; if (eclPd(m, pfa, N) < pd) lo = m; else hi = m; } return (lo + hi) / 2 - snrExact(pd, pfa, 1, 0); }      // 同じ Pd に要る S/N の増え方 [dB]
/* ---- 標準の計算書 ---- */
function lossTable(ngate){ const rows = LOSS.map(r => ({k: r[0], db: r[1] === null ? db10(eclApprox(ngate === undefined ? EX.ngate : ngate)) : r[1], tgt: !!r[2]})); let tot = 0, tgt = 0; for (const r of rows){ tot += r.db; if (r.tgt) tgt += r.db; } return {rows, tot, tgt, com: tot - tgt}; }
function std(){
  const tfr = EX.tavg * Math.LN2, pfa = pfaCell(EX.td, EX.nr, EX.nf, tfr), s0 = db10(snr423(EX.pd, pfa, 1)), s1 = db10(snr425(EX.pd, pfa, 1, 1)), s4 = db10(snr423(EX.pd, pfa, 4));
  const lt = lossTable(), ro0 = roOf(Object.assign({}, EX, {lt: 0})), ro = roOf(Object.assign({}, EX, {lt: lt.tot}));
  const r0 = ro * Math.pow(10, -s0 / 40), r1 = ro * Math.pow(10, -s1 / 40), ps = [120, 110, 100].map(R => pd424(Math.pow(ro / 1000 / R, 4), pfa, 1, 1)), cum = cumPd(ps);
  return {tfr, pfa, s0, s1, fl: s1 - s0, s4, il: s4 + db10(4) - s0, pdw: mOfN(2, 3, 0.7), pfw: mOfN(2, 3, 1e-3), lt, ro0, ro, r0, r1, c5: 1 - Math.pow(0.7, 5), c3: 1 - 0.9 * 0.8 * 0.7, ps, cum};
}
/* ---- 累積の検出確率と、フレーム時間（ステップ 7〜9） ---- */
function scanCurve(ro, pfa, sw, npdi, dr, rmax, rmin){      // 距離 rmax から dr ずつ近づく。1 回の Pd と、累積の Pd（1 回の Pd が 5% を超えた所から足す）
  const R = [], ps = [], cu = []; let q = 1, started = false;
  for (let r = rmax; r >= rmin - 1e-9; r -= dr){ const p = pdApprox(Math.pow(ro / r, 4), pfa, npdi, sw); if (!started && p >= 0.05) started = true; if (started) q *= 1 - p; R.push(r); ps.push(p); cu.push(started ? 1 - q : 0); }
  return {R, ps, cu};
}
function cumAt(ro, pfa, sw, npdi, dr, rspec, nph){      // 距離 rspec までの累積 Pd。1 回の Pd が 5% になる距離から足し始める。最初の走査の位置を一様にばらつかせて平均
  const r5 = ro * Math.pow(Math.max(1e-9, snrApprox(0.05, pfa, npdi, sw)), -0.25); if (r5 <= rspec) return 0;
  const pOf = r => pdApprox(Math.pow(ro / r, 4), pfa, npdi, sw);
  if ((r5 - rspec) / dr > 60){ const n = 120, h = (r5 - rspec) / n; let s = 0; for (let i = 0; i < n; i++) s += Math.log(Math.max(1e-300, 1 - pOf(rspec + (i + 0.5) * h))); return 1 - Math.exp(s * h / dr); }      // 走査が細かいときは、積を積分で近似
  nph = nph || 16; let acc = 0; for (let j = 0; j < nph; j++){ let q = 1; for (let r = r5 - (j + 0.5) / nph * dr; r >= rspec; r -= dr) q *= 1 - pOf(r); acc += 1 - q; } return acc / nph;
}
function rCum(ro, pfa, sw, npdi, dr, pc){ let lo = 0.01 * ro, hi = 3 * ro; for (let i = 0; i < 26; i++){ const m = (lo + hi) / 2; if (cumAt(ro, pfa, sw, npdi, dr, m) >= pc) lo = m; else hi = m; } return (lo + hi) / 2; }      // 累積 Pd が pc になる距離
const roFrame = (ro4s, tf) => ro4s * Math.pow(tf / EX.tf0, 0.25);                             // 平均電力が同じなら、Ro^4 はフレーム時間に比例
function frameCurve(ro4s, pfa, sw, npdi, v, pc){ const xs = [], ys = []; for (let l = 0; l <= 2.5001; l += 0.05){ const tf = Math.pow(10, l), ro = roFrame(ro4s, tf); xs.push(l); ys.push(rCum(ro, pfa, sw, npdi, v * tf, pc) / 1000); } return {xs, ys}; }
const FC = {};
function frameCached(ro4s, pfa, sw, npdi, v, pc){ const key = [Math.round(ro4s), pfa, sw, npdi, v, pc].join('/'); if (!FC[key]) FC[key] = frameCurve(ro4s, pfa, sw, npdi, v, pc); return FC[key]; }
const with_ = o => Object.assign({}, DEFAULTS, o);
/* 今の設定（S）での計算書の値（ステップ 9） */
function calc(s){
  s = s || S; const tavg = Math.pow(10, s.ltavg), tfr = tavg * Math.LN2, pfa = Math.pow(10, -s.x), lt = lossTable().tot + s.ladj, ro = roOf(Object.assign({}, EX, {pav: EX.pav * lin(s.pavdb), lt})), req = db10(snrApprox(s.pd, pfa, s.npdi, s.sw));
  const r1 = ro * Math.pow(10, -req / 40), tf = Math.pow(10, s.ltf), roF = roFrame(ro, tf), dr = EX.v * tf, rc = rCum(roF, pfa, s.sw, s.npdi, dr, s.pd), r1F = roF * Math.pow(10, -req / 40);
  return {tavg, tfr, pfa, lt, ro, req, r1, tf, roF, dr, rc, r1F};
}
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note}), Z = std();
  add('誤報の時間と、平均の誤報の間隔（Marcum の定義）', 'T_FR ≈ T_AVG·ln 2（p.4.44）', '誤報がポアソン的に起きるとすると、T_FR の間に 1 回以上起きる確率 = 1 − exp(−T_FR/T_AVG) = ' + fx(1 - Math.exp(-Z.tfr / EX.tavg), 4), near(1 - Math.exp(-Z.tfr / EX.tavg), 0.5, 1e-12), '式4.18 の説明（p.4.44）。T_AVG = 10 秒で T_FR = ' + fx(Z.tfr, 2) + ' 秒');
  add('式4.18（1 ルック）：セルあたりの誤警報確率。T_d = 16 ms、N_r = 100、N_f = 16、T_AVG = 10 秒', '（式に値を入れたもの）10⁻⁶', sci(Z.pfa, 3), near(Z.pfa, 1e-6, 1e-12), '式4.18 で m = n = 1（p.4.44）。例の値は説明用');
  { const a = db10(snr423(0.5, 1e-6, 1)), b = db10(snr423(0.9, 1e-6, 1)); add('式4.23：ゆらがない目標の必要 S/N。P_FA = 10⁻⁶、N_pdi = 1、P_d = 0.5／0.9', '11.17 dB／13.12 dB（指示書で確かめた値）', fx(a, 2) + ' dB／' + fx(b, 2) + ' dB', Math.abs(a - 11.17) < 0.006 && Math.abs(b - 13.12) < 0.006 ? 'ok' : 'ng', '式4.23（p.4.46）。η = ' + fx(etaOf(0.5, 1e-6), 4) + '／' + fx(etaOf(0.9, 1e-6), 4)); }
  { const a = db10(snr425(0.5, 1e-6, 1, 1)), b = db10(snr425(0.9, 1e-6, 1, 1)); add('式4.25：Swerling 1 の必要 S/N。P_FA = 10⁻⁶、N_pdi = 1、P_d = 0.5／0.9', '12.77 dB／21.14 dB（指示書で確かめた値）', fx(a, 2) + ' dB／' + fx(b, 2) + ' dB', Math.abs(a - 12.77) < 0.006 && Math.abs(b - 21.14) < 0.006 ? 'ok' : 'ng', '式4.25（p.4.46）。式4.24 と合う形で計算（下の「原本の印刷」の行を参照）'); }
  { let mx = 0; for (const s of [0.5, 2, 10, 50, 200]) for (const x of [4, 6, 8]){ const pfa = Math.pow(10, -x); mx = Math.max(mx, Math.abs(pd424(s, pfa, 1, 1) - Math.pow(pfa, 1 / (1 + s)))); } add('式4.24：Swerling 1、N_pdi = 1 のとき', 'P_d = P_FA^(1/(1+SNR)) になり、厳密な式と一致する', '15 通りの条件で、差の最大 ' + sci(mx, 1), mx < 1e-9 ? 'ok' : 'ng', '自由度 2 のカイ二乗の上側確率は exp(−x/2) なので、式が閉じた形になる'); }
  { let mx = 0, m0 = 0; for (const pd of [0.1, 0.5, 0.9, 0.99]) for (const x of [4, 6, 8]) for (const N of [1, 4, 16]) for (const sw of [0, 1, 2, 3, 4]){ const pfa = Math.pow(10, -x), s = snrApprox(pd, pfa, N, sw), d = Math.abs(pdApprox(s, pfa, N, sw) - pd); if (sw === 0) m0 = Math.max(m0, d); else mx = Math.max(mx, d); }
    add('式4.24 と式4.25 が、たがいに逆の関係になっていること（Swerling 1〜4）', '必要 S/N を P_d の式に戻すと、もとの P_d になる', '144 通りの条件で、差の最大 ' + sci(mx, 1), mx < 1e-6 ? 'ok' : 'ng', '式4.25 を、式4.24 と合う形で計算した場合（下の「原本の印刷」の行を参照）');
    add('式4.22 と式4.23 の関係（ゆらがない目標）', '（基準なし）式4.23 の必要 S/N を、式4.22 に戻す', '根号の中を −1/4 とした形で、P_d の差は 36 通りの条件で最大 ' + fx(m0, 3), 'ref', '差が残るのは、P_d の側で、誤差関数の逆関数に近似を使っているため（η の式）'); }
  { const s = lin(10), a = pd422print(s, 1e-6, 1), b = pd422(s, 1e-6, 1), c = pdExact(s, 1e-6, 1, 0), s2 = lin(13), a2 = pd422print(s2, 1e-6, 1), b2 = pd422(s2, 1e-6, 1), c2 = pdExact(s2, 1e-6, 1, 0); add('原本の印刷：式4.22 の根号の中の定数。P_FA = 10⁻⁶、N = 1、S/N 10 dB／13 dB の P_d', '2 つの根号の中が、どちらも「−1/2」と印刷されている', '印刷どおり：' + fx(a, 3) + '／' + fx(a2, 3) + '。「−1/4」とした形：' + fx(b, 3) + '／' + fx(b2, 3) + '。厳密な計算：' + fx(c, 3) + '／' + fx(c2, 3), 'ref', '式4.23 を P_d について解くと「−1/4」になる。印刷どおりの形は、式4.23 とも、厳密な計算とも合わない。計算は「−1/4」の形で行った'); }
  { const a = marcumInt(lin(13.12), -Math.log(1e-6)), b = pdNF(1, lin(13.12), -Math.log(1e-6)); add('厳密な計算どうしの確かめ：ゆらがない目標、N = 1、S/N 13.12 dB、P_FA = 10⁻⁶', '（基準なし）Marcum の Q 関数の数値積分と、級数の計算', '数値積分 ' + fx(a, 4) + '、級数 ' + fx(b, 4), Math.abs(a - b) < 2e-4 ? 'ref' : 'ng', '級数は、入門 第4回の pdNF と同じ計算'); }
  { const ex = snrExact(0.9, 1e-6, 1, 0); add('式4.23 と、厳密な計算の差（ゆらがない目標、P_d = 0.9、P_FA = 10⁻⁶、N = 1）', '「それなりに正確」（p.4.46）', '近似 ' + fx(Z.s0, 2) + ' dB、厳密 ' + fx(ex, 2) + ' dB（差 ' + fx(Z.s0 - ex, 2) + ' dB）', Math.abs(Z.s0 - ex) < 0.3 ? 'ok' : 'info', '入門 第15回・第17回の「検出に要る S/N 13 dB」、第16回の 13.18 dB は、この条件に当たる'); }
  { let mx = 0, at = ''; const t = []; for (const sw of [0, 1, 2, 3, 4]){ let m = 0; for (const pd of [0.5, 0.9]) for (const x of [4, 6, 8]) for (const N of [1, 4, 16]){ const pfa = Math.pow(10, -x), d = db10(snrApprox(pd, pfa, N, sw)) - snrExact(pd, pfa, N, sw); if (Math.abs(d) > Math.abs(m)) m = d; if (Math.abs(d) > Math.abs(mx)){ mx = d; at = 'Swerling ' + sw + '、P_d ' + pd + '、10' + sup(-x) + '、N ' + N; } } t.push((sw === 0 ? 'ゆらがない' : 'Swerling ' + sw) + ' ' + (m >= 0 ? '+' : MINUS) + fx(Math.abs(m), 2)); }
    add('近似式（式4.23・4.25）と厳密な計算の、必要 S/N の差。P_d 0.5・0.9、P_FA 10⁻⁴〜10⁻⁸、N_pdi 1・4・16', '「それなりに正確」（p.4.46。数値の保証はない）', '差がいちばん大きい条件での値 [dB]：' + t.join('、'), Math.abs(mx) <= 1 ? 'ok' : 'info', 'この表は 18 通り × 5 種類。P_d 0.1〜0.99、N 1〜32 まで広げた結果は、報告書と本文（ステップ 3・4）に書いた。差が大きいのは ' + at); }
  { const d = mOfN(2, 3, 0.7); add('式4.26：3 ルックのうち 2 回以上。1 ルックの P_d = 0.7', '3·0.7²·0.3 + 0.7³ = 0.784', fx(d, 4), near(d, 0.784, 1e-12), '式4.26（p.4.47）。二項係数は C(n, k) = n!/[k!(n−k)!] で計算'); }
  { const N = 5, exact = 12 * N / (7 * N - 6); let a = 0; const n = 20000; for (let i = 0; i < n; i++) a += eclPower((i + 0.5) / n, N) / n; add('式4.17：エクリプシングとストラドルで減る、整合フィルタの出力の平均（N = 5 ゲート）', '損失 = 12N/(7N − 6) = ' + fx(exact, 4) + ' 倍（' + fx(db10(exact), 2) + ' dB）', '遅れを一様にばらつかせて、出力の電力を平均：1/' + fx(1 / a, 4), Math.abs(1 / a - exact) < 1e-3 ? 'ok' : 'ng', '式4.17（p.4.41）。図4.20 の左の場合（ゲートの重なりなし）を、自分の計算で作ったもの'); }
  { const N = 5, l5 = eclLoss(0.5, 1e-6, N), l9 = eclLoss(0.9, 1e-6, N), l2 = eclLoss(0.2, 1e-6, N); add('エクリプシングとストラドルの損失は、P_d によって変わる（N = 5、P_FA = 10⁻⁶、ゆらがない目標）', '式4.17 の近似は、P_d が 50% に近いときだけ有効（p.4.43、図4.21）', 'P_d 0.2／0.5／0.9 で ' + fx(l2, 1) + '／' + fx(l5, 1) + '／' + fx(l9, 1) + ' dB（式4.17 は ' + fx(db10(eclApprox(N)), 1) + ' dB）', Math.abs(l5 - db10(eclApprox(N))) < 1.2 && l9 > l5 + 2 ? 'ok' : 'info', 'p.4.41 の 4 段の手順を、厳密な P_d の曲線で計算した。P_d が高いほど損失が大きい'); }
  { const a = eclPd(14, 1e-6, 5), b = eclPd(20, 1e-6, 5), c = pdExact(lin(14), 1e-6, 1, 0); add('図4.21 に当たる曲線（デューティ 20%、5 ゲート、P_FA = 10⁻⁶、ゆらがない目標）：損失を入れない S/N が 14 dB／20 dB のときの P_d', '約 0.46／約 0.855（図の読み取り）。損失なしの曲線は 14 dB で約 0.97', fx(a, 3) + '／' + fx(b, 3) + '（損失なしは 14 dB で ' + fx(c, 3) + '）', Math.abs(a - 0.46) < 0.04 && Math.abs(b - 0.855) < 0.03 ? 'ok' : 'info', '図4.21（p.4.43）。読み取りの誤差を含む。図は転載せず、自分の計算で描いた'); }
  { const g = 4 * Math.PI * EX.ae / (EX.lam * EX.lam), a = roOf(Object.assign({}, EX, {lt: 0})), b = rmax15({pav: EX.pav, g, ae: EX.ae, rcs: 1, n: 16, ei: 1, F: 1, Fn: lin(EX.fn), fp: 1000, snr1: 1, Ls: 1}); add('式4.16 の R_o と、入門 第15回の式1.5 で S/N = 1 とした距離（損失なし）', '同じ値になる（B_n = f_p/n、k·T_s = k·T_0·F_n、G·A_e = G_T·G_R·λ²/4π）', '式4.16：' + fx(a / 1000, 3) + ' km、式1.5：' + fx(b / 1000, 3) + ' km', near(a, b, 1e-6), '平均 1 kW、有効開口面積 1.6 m²、波長 10 cm、1 m²、雑音指数 3 dB、PRF 1 kHz で 16 パルス（B_n = 62.5 Hz）。第15回の rmax15 と同じ式'); }
  add('例の計算書：損失の合計、R_o、探知距離（1 回の P_d 0.9。ゆらがない／Swerling 1）', '（基準なし）', fx(Z.lt.tot, 2) + ' dB、' + fx(Z.ro / 1000, 1) + ' km、' + fx(Z.r0 / 1000, 1) + ' km／' + fx(Z.r1 / 1000, 1) + ' km', 'ref', '損失の値は説明用。目標だけにかかる損失は ' + fx(Z.lt.tgt, 2) + ' dB');
  { const ps = [0.1, 0.2, 0.3], a = cumPd(ps); let c = 0; const b = ps.map(p => (c = c + p * (1 - c))); add('式4.27：積の形（1 行目）と、漸化式。1 回の P_d が 0.1、0.2、0.3 と続く場合', '同じ値になる', '積の形：' + a.map(v => fx(v, 3)).join('、') + '。漸化式（[k−1] の形）：' + b.map(v => fx(v, 3)).join('、'), Math.abs(a[2] - b[2]) < 1e-12 ? 'ok' : 'ng', '式4.27（p.4.47）'); }
  { const ps = [0.1, 0.2, 0.3], prod = cumPd(ps); let c = 0; const pr = ps.map(p => { c = (c + p) / (1 + p); return c; }); add('原本の印刷：式4.27 の 2 行目', '2 行目の最後が (1 − P_d,cum[k]) と印刷されているように読める', 'その形を P_d,cum[k] について解いて計算すると ' + pr.map(v => fx(v, 3)).join('、') + '。積の形は ' + prod.map(v => fx(v, 3)).join('、'), 'ref', '印刷どおりの形は、1 行目（積の形）と合わない。[k−1] と読むと合う。計算は積の形で行った'); }
  { const a = ((KmInv(0.9, 2) - 0) / KmInv(0.9, 2) - 1); add('原本の印刷：式4.25 の分子', '分子の最初の項が K_m⁻¹(P_d, 2n_e) と印刷されているように読める', '印刷どおりに計算すると、Swerling 1・N = 1 で SNR = ' + fx(a, 1) + '（P_FA が式に現れない）', 'ref', '式4.24 を SNR について解くと、分子は K_m⁻¹(P_FA, 2N_pdi) − 2(N_pdi − n_e) になる。この形で計算すると、指示書で確かめた値（21.14 dB）と合う'); }
  add('原本の印刷：式4.18・4.26 の二項係数', '上に m（または k）、下に n と書かれている。p.4.44 に n!/[m!(n−m)!] と定義がある', 'ふつうの書き方の C(n, m) と同じ値。3 つのうち 2 つを選ぶ場合 = ' + binom(3, 2), 'ref', '誤りではなく、書き方の違いと読める。計算は C(n, k) = n!/[k!(n−k)!] で行った');
  return R;
}
