/* ============================================================
   第8回 モノパルス測角と追尾レーダ：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第9章 Tracking Radar（p.9.1–9.47）
   簡略化：1 つの角度（1 次元）だけを扱う。2 つのビームはガウス形（電圧パターン exp(−2 ln2·(θ∓θs)²/θb²)）で、
           軸から ±θs だけ開いている（スクイント）。和 Σ = 2 つの足し算、差 Δ = 引き算。
           サーボは 1 次の閉ループ（雑音に対する帯域 βn = ループの利得 ÷ 4）。
   ============================================================ */
const RAD = Math.PI / 180, LN2 = Math.LN2;
const DEFAULTS = {thb: 1.5, off: 0, m: 0, tg: 0, weak: false, sq: 0.8, bn: 5, phi: 0, el: 4, R: 10, L: 15, snr: 50};
const S = Object.assign({}, DEFAULTS);
const gb = (th, c, bw) => Math.exp(-2 * LN2 * (th - c) * (th - c) / (bw * bw));
function sd(th, ax, sq, bw){ const a = gb(th - ax, sq, bw), b = gb(th - ax, -sq, bw); return {s: a + b, d: a - b}; }
const ratio = (th, sq, bw) => { const v = sd(th, 0, sq, bw); return v.d / v.s; };
const slope0 = (sq, bw) => 4 * LN2 * sq / (bw * bw);                 // Δ/Σ の軸上での傾き [1/度]。Δ/Σ = tanh(4 ln2·θ·θs/θb²)
function sumBw(sq, bw){ const p0 = Math.pow(sd(0, 0, sq, bw).s, 2); let lo = 0, hi = 4 * bw; for (let i = 0; i < 60; i++){ const m = (lo + hi) / 2; if (Math.pow(sd(m, 0, sq, bw).s, 2) > p0 / 2) lo = m; else hi = m; } return 2 * lo; }   // 和パターンの 3 dB 幅
const kmOf = (sq, bw) => slope0(sq, bw) * sumBw(sq, bw);              // 誤差の傾き km（和のビーム幅あたり。p.9.42）
const sum0 = (sq, bw) => gb(0, sq, bw);                              // 軸上の和信号（ビームを開かないときを 1）
function errSig(ax, src, sq, bw){ let sr = 0, si = 0, dr = 0, di = 0; for (const q of src){ const v = sd(q.th, ax, sq, bw), c = q.a * Math.cos(q.ph), s = q.a * Math.sin(q.ph); sr += v.s * c; si += v.s * s; dr += v.d * c; di += v.d * s; } return {e: (dr * sr + di * si) / (sr * sr + si * si + 1e-300), amp: Math.hypot(sr, si)}; }   // 式9.1：Re(Δ/Σ)
function solveAxis(src, sq, bw, start, span){      // 閉ループの追尾がとどまる軸の向き（誤差信号が ＋ から − に変わる点のうち、start にいちばん近いもの）
  const n = 600, lo = start - span, hi = start + span; let best = null, pv = errSig(lo, src, sq, bw).e;
  for (let i = 1; i <= n; i++){ const x = lo + (hi - lo) * i / n, v = errSig(x, src, sq, bw).e; if (pv > 0 && v <= 0){ let a = x - (hi - lo) / n, b = x; for (let k = 0; k < 40; k++){ const m = (a + b) / 2; if (errSig(m, src, sq, bw).e > 0) a = m; else b = m; } const r = (a + b) / 2; if (best === null || Math.abs(r - start) < Math.abs(best - start)) best = r; } pv = v; }
  return best === null ? start : best; }
const glint2 = (sep, a, phi) => sep * (a * a + a * Math.cos(phi)) / (1 + a * a + 2 * a * Math.cos(phi));   // 式9.7 の形：反射点 1 から見た、反射点 2 の側へのずれ（間隔 sep）
const ampl2 = (a, phi) => Math.sqrt(1 + a * a + 2 * a * Math.cos(phi));
const thermal = (thB, km, snr, n) => thB / (km * Math.sqrt(snr * n));       // 式9.10（Bτ = 1、n = fr/βn）
function loopSim(o){       // o: {thB, km, snr(比), fr, bn, rate[度/秒], T[秒], seed} → 1 次のサーボで追尾したときの軸の向き
  const g = gaussGen(700 + o.seed), s1 = o.thB / (o.km * Math.sqrt(2 * o.snr)), G = 4 * o.bn / o.fr, n = Math.round(o.T * o.fr), t = [], tg = [], ax = []; let a = 0, se = 0, c = 0, sl = 0;
  for (let k = 0; k < n; k++){ const tt = k / o.fr, th = o.rate * tt, meas = th - a + s1 * g(); a += G * meas; if (k % 10 === 0){ t.push(tt); tg.push(th); ax.push(a); } if (tt > o.T / 3){ const e = a - o.rate * (tt + 1 / o.fr); se += e * e; sl += e; c++; } }
  return {t, tg, ax, rms: Math.sqrt(se / c), mean: sl / c, s1}; }
const lagOf = (rate, bn) => rate / (4 * bn);
function conScan(m, off, seed){      // 円錐走査：1 回転 16 パルス。目標のエコーの強さが、パルスごとに m（割合）だけゆらぐ
  const bw = 2, sq = 1, N = 16, g = gaussGen(900 + seed), amp = [], ang = []; let fl = 1, c = 0, s = 0, mean = 0;
  for (let k = 0; k < N; k++){ const ph = 2 * Math.PI * k / N; fl = 1 + m * (0.75 * (fl - 1) / Math.max(m, 1e-9) + 0.66 * g()); const dx = off - sq * Math.cos(ph), dy = -sq * Math.sin(ph), a = Math.max(0.02, fl) * Math.exp(-2 * LN2 * (dx * dx + dy * dy) / (bw * bw)); amp.push(a); ang.push(ph / RAD); c += a * Math.cos(ph); s += a * Math.sin(ph); mean += a; }
  mean /= N; const k1 = 4 * LN2 * sq / (bw * bw);      // 変調の深さ ≈ k1 × ずれ
  return {amp, ang, ex: 2 * c / N / mean / k1, ey: 2 * s / N / mean / k1, mean}; }
function conRms(m, off){ let se = 0; const n = 60; for (let s = 1; s <= n; s++){ const r = conScan(m, off, s); se += (r.ex - off) * (r.ex - off) + r.ey * r.ey; } return Math.sqrt(se / n); }
function mpAt(o, e, start){ const ph = Math.PI + 4 * Math.PI * o.hr * Math.sin(e * RAD) / o.lam; return {ind: solveAxis([{th: e, a: 1, ph: 0}, {th: -e, a: o.rho, ph}], o.sq, o.bw, start === undefined ? e : start, 2.5 * o.bw), ph}; }
function mpCurve(o){       // 低高度のマルチパス：目標（仰角 E）と海面の像（仰角 −E、強さ ρ、位相 π + 4π·hr·sinE/λ）を追尾したときに、レーダが指す仰角
  const E = [], ind = [], n = 400; let prev = o.e1;
  for (let i = 0; i <= n; i++){ const e = o.e1 - (o.e1 - o.e0) * i / n, ph = Math.PI + 4 * Math.PI * o.hr * Math.sin(e * RAD) / o.lam, r = solveAxis([{th: e, a: 1, ph: 0}, {th: -e, a: o.rho, ph}], o.sq, o.bw, prev, 2.5 * o.bw); E.push(e); ind.push(r); prev = r; }
  return {E, ind}; }
const MP = {bw: 2, sq: 0.8, hr: 3, lam: 0.1, rho: 0.9, e0: 0.2, e1: 8};
const BUD = {km: 1.6, fr: 1000, fix: 0.05, kg: 0.15};      // 誤差の見積もりの例：km、PRF、その他の誤差 0.05 mrad、グリント σang = 0.15 L
function budget(R, o){ const snr = Math.pow(10, o.snr / 10) * Math.pow(10 / R, 4), th = thermal(o.thb * RAD * 1000, BUD.km, snr, BUD.fr / o.bn), gl = BUD.kg * o.L / R, tot = Math.sqrt(th * th + gl * gl + BUD.fix * BUD.fix); return {th, gl, fix: BUD.fix, tot, snr}; }   // [mrad]。R は km
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  { const a = errSig(0, [{th: 0.3, a: 1, ph: 0}], 1, 2).e, b = errSig(0, [{th: -0.3, a: 5, ph: 1.1}], 1, 2).e; add('式9.1：角度誤差検出器の出力（目標が軸の右 0.3°／左 0.3° で、強度が 5 倍・位相も異なる場合）', '大きさは |Δ|/|Σ|、符号は目標の側で反転。エコーの強度によらない', fx(a, 4) + '／' + fx(b, 4), Math.abs(a + b) < 1e-12 && a > 0 ? 'ok' : 'ng', '式9.1（p.9.5）、AGC の説明（p.9.10）'); }
  { const sq = 1, bw = 2; let mx = 0; for (let t = -2; t <= 2; t += 0.1) mx = Math.max(mx, Math.abs(ratio(t, sq, bw) - Math.tanh(4 * LN2 * t * sq / (bw * bw)))); add('このシミュレータのビームのモデルでの Δ/Σ と角度の関係', '（ハンドブックに式なし）軸の付近で直線', 'Δ/Σ = tanh(4·ln2·θ·θs/θb²) と一致（差 ' + sci(mx + 1e-20, 0) + '）。軸上の傾き ' + fx(slope0(sq, bw), 3) + ' /度', 'ref', '補足：ガウス形の 2 ビームから導いた関係'); }
  { const k = kmOf(0.8, 2), k2 = kmOf(0.6, 2), k3 = kmOf(1, 2); add('モノパルス傾斜 km（和のビーム幅あたりの Δ/Σ の変化）。スクイント角 θs/θb = 0.3／0.4／0.5', '給電の方式により 1.2〜1.9、代表値 1.57', fx(k2, 2) + '／' + fx(k, 2) + '／' + fx(k3, 2), k > 1.2 && k < 1.9 ? 'ok' : 'info', '本文（p.9.42）。このシミュレータの 2 ビームのモデルでは、km がスクイント角に依存。θs/θb = 0.4 を標準に使用（ステップ 4 でスクイント角を変えて確かめる）'); }
  { const thB = 1.5, km = 1.6, snr = 10, fr = 1000, bn = 5, f = thermal(thB, km, snr, fr / bn); let se = 0, c = 0; for (let s = 1; s <= 20; s++){ const r = loopSim({thB, km, snr, fr, bn, rate: 0, T: 30, seed: s}); se += r.rms * r.rms; c++; }
    const m = Math.sqrt(se / c); add('式9.10：受信機の熱雑音による角度誤差（ビーム幅 1.5°、km 1.6、S/N 10 dB、PRF 1000 Hz、サーボ帯域 5 Hz）', fx(f * 1000, 2) + ' ミリ度', fx(m * 1000, 2) + ' ミリ度（1 パルスごとの測定値に雑音を加え、1 次のサーボで追尾した実測値。20 通り × 20 秒）', Math.abs(m / f - 1) < 0.05 ? 'ok' : 'ng', '式9.10（p.9.42）。Bτ = 1。1 パルスの誤差は θB/(km·√(2·S/N))、サーボの利得は 4βn として計算'); }
  { const r = loopSim({thB: 1.5, km: 1.6, snr: 1e9, fr: 1000, bn: 5, rate: 2, T: 20, seed: 1}); add('一定の角速度（2°/秒）で運動する目標に対するサーボの遅れ（帯域 5 Hz）', '（ハンドブックに式なし）帯域を広げると遅れが減る', fx(-r.mean, 4) + '°（式 ω/(4βn) = ' + fx(lagOf(2, 5), 4) + '°）', Math.abs(-r.mean / lagOf(2, 5) - 1) < 0.02 ? 'ref' : 'ng', '補足：1 次のサーボの性質。傾向は本文（p.9.18）'); }
  { const t = []; let ok = true; for (const ph of [0, 90, 150, 170]){ const sep = 0.04, a = 0.8, p = ph * RAD, f = glint2(sep, a, p), r = solveAxis([{th: 0, a: 1, ph: 0}, {th: sep, a, ph: p}], 1, 2, f, 3); t.push(ph + '°：' + fx(r / sep, 3) + '（式 ' + fx(f / sep, 3) + '）'); if (Math.abs(r - f) > 0.02 * Math.max(sep, Math.abs(f))) ok = false; }
    add('式9.7：2 つの反射点（振幅比 0.8）を追尾した場合の見かけの位置（反射点 1 から、間隔を 1 として）。位相差 0／90／150／170°', '(ρ² + ρ·cosφ)/(1 + ρ² + 2ρ·cosφ)', t.join('、'), ok ? 'ok' : 'info', '式9.7（p.9.39）、図9.20（p.9.31）。モノパルスのモデル（反射点の間隔 0.04°、ビーム幅の 1/50）で、誤差信号が 0 になる軸の方向を求めた値。負の値は 2 点の外側。間隔が広いと、Δ/Σ が直線から外れるために式との差がわずかに生じる'); }
  { let s0 = 0, s2 = 0; for (let i = -5000; i <= 5000; i++){ const a = i / 10000, w = Math.pow(Math.cos(Math.PI * a), 2); s0 += w; s2 += w * a * a; } const ro = Math.sqrt(s2 / s0); add('グリントの大きさ：反射の分布が cos²(πα/L) の場合の σang', '回転半径 ÷ √2 = 0.19 L', '回転半径 = ' + fx(ro, 3) + ' L、÷ √2 = ' + fx(ro / Math.SQRT2, 3) + ' L', Math.abs(ro / Math.SQRT2 - 0.19) < 0.01 ? 'ok' : 'info', '本文（p.9.31）。計算では 0.128 L となり、本文の 0.19 L と合わない（回転半径そのものは 0.181 L。一様な分布なら回転半径 ÷ √2 = 0.204 L）。シミュレータでは本文の実機の代表値の範囲から σang = 0.15 L を使用'); }
  { const c = mpCurve(MP); let hi = 0, lo = 9, hiE = 0; for (let i = 0; i < c.E.length; i++){ if (c.E[i] > 4) hi = Math.max(hi, Math.abs(c.ind[i] - c.E[i])); if (c.E[i] < 1.5){ const d = Math.abs(c.ind[i] - c.E[i]); if (d > hiE) hiE = d; } }
    add('マルチパスによる仰角の誤差の傾向（和のビーム幅 約 2.6°、反射係数 0.9）。仰角 4° 以上／1.5° 以下での最大値', '鏡像がメインビームに入る低い仰角で、誤差が大きくなる', fx(hi, 2) + '°／' + fx(hiE, 2) + '°', hiE > 3 * hi ? 'ok' : 'info', '本文と図9.27（p.9.37–9.39）。傾向の確認'); }
  { const b1 = budget(10, {snr: 50, thb: 1.5, bn: 5, L: 15}), b2 = budget(100, {snr: 50, thb: 1.5, bn: 5, L: 15}); add('誤差の見積もりの例（距離 10 km／100 km）：熱雑音、グリント [mrad]', '近距離ではグリント、遠距離では熱雑音が支配的（図9.30 の傾向）', '10 km：熱雑音 ' + fx(b1.th, 4) + '、グリント ' + fx(b1.gl, 3) + '／100 km：熱雑音 ' + fx(b2.th, 3) + '、グリント ' + fx(b2.gl, 4), b1.gl > b1.th && b2.th > b2.gl ? 'ok' : 'ng', '§9.11（p.9.43–9.45、図9.30）。熱雑音は式9.10、グリントは σang ÷ 距離'); }
  return R;
}
