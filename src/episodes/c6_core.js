/* ============================================================
   第6回 航空機搭載MTI（AMTI）：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第3章 Airborne MTI（p.3.1–3.34）
   簡略化：平らな地面。アンテナの往復の電力パターン G⁴(θ) はガウス形（θa/2 で 0.25。式3.5・3.6 と同じ近似）。
           クラッタのスペクトルはガウス形とし、改善度は「フィルタの平均利得 ÷ スペクトルで重み付けした応答の平均」で計算。
   ============================================================ */
const RAD = Math.PI / 180;
const AM = {lam: 0.7, a: 7, prf: 300, H: 9};                       // 例の値：波長 0.7 m（UHF）、開口 7 m、PRF 300 Hz、高度 9 km
AM.tha = AM.lam / AM.a; AM.Tp = 1 / AM.prf;                        // ビーム幅 θa ≈ λ/a [rad]（p.3.9）
const DEFAULTS = {vg: 0, az: 0, rs: 150, w: 0, rpm: 1, tv: 0, order: 3, tac: true, dpca: false, sl: -30};
const S = Object.assign({}, DEFAULTS);
const fdOf = (vg, az) => 2 * vg * Math.cos(az * RAD) / AM.lam;      // メインビームクラッタの中心 [Hz]（Vr = Vg cos α、p.3.4）
const sigPm = (vx, a) => 0.6 * Math.abs(vx) / (a || AM.a);          // 式3.6 [Hz]
const sigScan = (rpm) => 0.265 * (rpm * 6 * RAD) / AM.tha;          // 式3.16 [Hz]。θ̇ = rpm × 6 [度/秒]
const hitsBw = (rpm) => AM.tha * AM.prf / (rpm * 6 * RAD);          // ビーム幅あたりのパルス数 n
const g4 = th => Math.exp(-4 * Math.LN2 * 2 * th * th / (AM.tha * AM.tha));    // 往復の電力パターン。θ = θa/2 で 0.25
function mtiPow(order, f){ const s = Math.sin(Math.PI * f / AM.prf); return order === 2 ? 4 * s * s : 16 * s * s * s * s; }   // |H(f)|²。2 パルス／3 パルス
const mtiGain = order => order === 2 ? 2 : 6;                       // 雑音に対する平均利得（式3.10 の K と同じ）
const mtiDb = (order, f) => 10 * Math.log10(Math.max(1e-9, mtiPow(order, f) / mtiGain(order)));
function impFactor(order, sig, off){        // 幅 sig [Hz]、中心のずれ off [Hz] のガウス形スペクトルに対する改善度（比）
  if (sig < 1e-6) { const p = mtiPow(order, off); return p < 1e-12 ? 1e12 : mtiGain(order) / p; }
  let num = 0, den = 0; for (let i = -400; i <= 400; i++){ const x = i / 80, w = Math.exp(-x * x / 2); num += w * mtiPow(order, off + x * sig); den += w; } return mtiGain(order) / (num / den); }
function impSl(order, slDb){               // 式3.10：サイドローブによる上限。メインビームはガウス形、サイドローブは一様な高さ slDb（片道の電力）と仮定
  const main = AM.tha * Math.sqrt(Math.PI / (8 * Math.LN2)), sl = Math.pow(10, slDb / 10); return mtiGain(order) * (main + sl * sl * 2 * Math.PI) / (sl * sl * 2 * Math.PI); }
const par = (a, b) => 1 / (1 / a + 1 / b);                          // 式3.11
function spectrum(vg, az, lo, hi, nb, rel){  // ビーム内の各方向のドップラを、往復のパターンで重み付けして数えたスペクトル（数値計算）
  const h = new Float64Array(nb), f0 = fdOf(vg, az), bw = (hi - lo) / nb; let m1 = 0, m2 = 0, sw = 0;
  for (let i = -3000; i <= 3000; i++){ const th = i / 3000 * 3 * AM.tha, w = g4(th), f = 2 * vg * Math.cos(az * RAD + th) / AM.lam - (rel ? f0 : 0), q = (f - lo) / bw - 0.5, b = Math.floor(q), fr = q - b; if (b >= 0 && b < nb) h[b] += w * (1 - fr); if (b + 1 >= 0 && b + 1 < nb) h[b + 1] += w * fr; m1 += w * f; m2 += w * f * f; sw += w; }
  let pk = 0; for (let b = 0; b < nb; b++) if (h[b] > pk) pk = h[b]; const x = [], y = []; for (let b = 0; b < nb; b++){ x.push(lo + (b + 0.5) * bw); y.push(pk ? h[b] / pk : 0); }
  const mean = m1 / sw; return {x, y, mean, std: Math.sqrt(Math.max(0, m2 / sw - mean * mean)), f0}; }
const term1 = (vg, az) => vg * Math.sin(az * RAD) * AM.tha / AM.lam;             // 式3.4 の、ビームの端（θ = θa/2）での値 [Hz]
const term2 = (vg, az) => vg * Math.cos(az * RAD) * AM.tha * AM.tha / (4 * AM.lam);   // 式3.23 の、ビームの端での値 [Hz]
/* ---- 時空間適応処理（STAP）の小さな例：素子 8 個 × パルス 8 個。横向きの直線アレイ、素子間隔 λ/2、
        1 パルスの間に機体が素子間隔の半分だけ進む（クラッタの方向とドップラが 1 本の直線に並ぶ条件）。 ---- */
const ST = {N: 8, M: 8, cnr: 1e4, nc: 181, cache: null};
function stv(sn, f){ const n = ST.N * ST.M, r = new Float64Array(n), i = new Float64Array(n); for (let m = 0; m < ST.M; m++) for (let k = 0; k < ST.N; k++){ const ph = Math.PI * k * sn + 2 * Math.PI * m * f; r[m * ST.N + k] = Math.cos(ph); i[m * ST.N + k] = Math.sin(ph); } return {r, i}; }
function stapSetup(){ if (ST.cache) return ST.cache; const n = ST.N * ST.M, Ar = new Float64Array(n * n), Ai = new Float64Array(n * n), xi = ST.cnr / ST.nc;
  for (let p = 0; p < n; p++) Ar[p * n + p] = 1;
  for (let c = 0; c < ST.nc; c++){ const sn = -1 + 2 * c / (ST.nc - 1), v = stv(sn, 0.5 * sn); for (let p = 0; p < n; p++) for (let q = 0; q <= p; q++){ Ar[p * n + q] += xi * (v.r[p] * v.r[q] + v.i[p] * v.i[q]); Ai[p * n + q] += xi * (v.i[p] * v.r[q] - v.r[p] * v.i[q]); } }
  const Lr = new Float64Array(n * n), Li = new Float64Array(n * n);                 // 複素コレスキー分解 R = L·Lᴴ
  for (let j = 0; j < n; j++){ let s = Ar[j * n + j]; for (let k = 0; k < j; k++) s -= Lr[j * n + k] * Lr[j * n + k] + Li[j * n + k] * Li[j * n + k]; const d = Math.sqrt(s); Lr[j * n + j] = d;
    for (let i = j + 1; i < n; i++){ let sr = Ar[i * n + j], si = Ai[i * n + j]; for (let k = 0; k < j; k++){ const ar = Lr[i * n + k], ai = Li[i * n + k], br = Lr[j * n + k], bi = -Li[j * n + k]; sr -= ar * br - ai * bi; si -= ar * bi + ai * br; } Lr[i * n + j] = sr / d; Li[i * n + j] = si / d; } }
  for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++){ Ar[p * n + q] = Ar[q * n + p]; Ai[p * n + q] = -Ai[q * n + p]; }
  const ham = k => 0.54 - 0.46 * Math.cos(2 * Math.PI * k / 7), tap = new Float64Array(n); for (let m = 0; m < ST.M; m++) for (let k = 0; k < ST.N; k++) tap[m * ST.N + k] = ham(m) * ham(k);
  return (ST.cache = {n, Ar, Ai, Lr, Li, tap}); }
function stapSolve(s){ const C = stapSetup(), n = C.n, yr = new Float64Array(n), yi = new Float64Array(n);      // R·w = s を解く（式3.28 の形）
  for (let i = 0; i < n; i++){ let sr = s.r[i], si = s.i[i]; for (let k = 0; k < i; k++){ sr -= C.Lr[i * n + k] * yr[k] - C.Li[i * n + k] * yi[k]; si -= C.Lr[i * n + k] * yi[k] + C.Li[i * n + k] * yr[k]; } yr[i] = sr / C.Lr[i * n + i]; yi[i] = si / C.Lr[i * n + i]; }
  for (let i = n - 1; i >= 0; i--){ let sr = yr[i], si = yi[i]; for (let k = i + 1; k < n; k++){ const lr = C.Lr[k * n + i], li = -C.Li[k * n + i]; sr -= lr * yr[k] - li * yi[k]; si -= lr * yi[k] + li * yr[k]; } yr[i] = sr / C.Lr[i * n + i]; yi[i] = si / C.Lr[i * n + i]; }
  return {r: yr, i: yi}; }
function quadR(w){ const C = stapSetup(), n = C.n; let q = 0; for (let p = 0; p < n; p++){ let tr = 0, ti = 0; for (let k = 0; k < n; k++){ tr += C.Ar[p * n + k] * w.r[k] - C.Ai[p * n + k] * w.i[k]; ti += C.Ar[p * n + k] * w.i[k] + C.Ai[p * n + k] * w.r[k]; } q += w.r[p] * tr + w.i[p] * ti; } return q; }
function stapLoss(f){                      // 目標（正面、正規化ドップラ f）に対する S/(C+N) の、雑音だけのときからの低下 [dB]。STAP と従来処理
  const C = stapSetup(), n = C.n, s = stv(0, f), w = stapSolve(s); let so = 0; for (let p = 0; p < n; p++) so += s.r[p] * w.r[p] + s.i[p] * w.i[p];
  const wc = {r: new Float64Array(n), i: new Float64Array(n)}; let g = 0; for (let p = 0; p < n; p++){ wc.r[p] = s.r[p] * C.tap[p]; wc.i[p] = s.i[p] * C.tap[p]; g += C.tap[p]; }
  return {opt: 10 * Math.log10(so / n), conv: 10 * Math.log10(g * g / quadR(wc) / n), w}; }
function stapMap(w, nx, ny){ const z = new Float32Array(nx * ny), n = ST.N * ST.M; let pk = 0;          // フィルタの応答 |wᴴv(方向, ドップラ)|²
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++){ const v = stv(-1 + 2 * ix / (nx - 1), -0.5 + iy / (ny - 1)); let ar = 0, ai = 0; for (let p = 0; p < n; p++){ ar += w.r[p] * v.r[p] + w.i[p] * v.i[p]; ai += w.r[p] * v.i[p] - w.i[p] * v.r[p]; } const m = ar * ar + ai * ai; z[iy * nx + ix] = m; if (m > pk) pk = m; }
  for (let k = 0; k < z.length; k++) z[k] = Math.max(-60, 10 * Math.log10(z[k] / pk + 1e-12)); return z; }
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  { const az = 40 * RAD, ph = 12 * RAD, ca = Math.cos(az) * Math.cos(ph); add('式3.2：正規化したボアサイト速度比（方位 40°、俯角 12°）', 'cos φ₀ = ' + fx(Math.cos(ph), 4), 'cos α₀ / cos ψ₀ = ' + fx(ca / Math.cos(az), 4), near(ca / Math.cos(az), Math.cos(ph), 1e-12), '式3.2（p.3.5）。平面大地で cos α₀ = cos ψ₀·cos φ₀ として計算'); }
  { const vg = 150, a0 = 60 * RAD, th = 0.05, ex = vg * (Math.cos(a0) - Math.cos(a0 + th)), ap = vg * Math.sin(a0) * Math.sin(th) + 2 * vg * Math.cos(a0) * Math.sin(th / 2) * Math.sin(th / 2); add('式3.3：ボアサイトとの速度差（Vg = 150 m/s、α₀ = 60°、θ = 0.05 rad）', 'Vg[cos α₀ − cos(α₀ + θ)] = ' + fx(ex, 4) + ' m/s', 'Vx sin θ + 2Vy sin²(θ/2) = ' + fx(ap, 4) + ' m/s', near(ex, ap, 1e-9), '式3.3（p.3.9）'); }
  { const k = 1 / Math.sqrt(2 * Math.log(4)), sp = spectrum(150, 90, -80, 80, 160, true); add('式3.6：プラットフォーム運動によるスペクトルの標準偏差 σpm', '0.6·Vx/a', fx(k, 4) + '·Vx/a（式3.5 が 0.25 になる条件から）。真横・150 m/s・開口 7 m の数値計算：' + fx(sp.std, 2) + ' Hz（式：' + fx(sigPm(150), 2) + ' Hz）', Math.abs(k - 0.6) < 0.005 && Math.abs(sp.std / sigPm(150) - 1) < 0.01 ? 'ok' : 'ng', '式3.5・3.6（p.3.9）。数値計算はビーム内の各方向のドップラ周波数を往復のパターンで重み付けして求めた標準偏差'); }
  { const i2 = 10 * Math.log10(impFactor(3, 0.6 * 0.054 * 1000, 0) * 1), i1 = 10 * Math.log10(impFactor(2, 0.6 * 0.011 * 1000, 0)), sv = AM.prf; AM.prf = 1000; const j2 = 10 * Math.log10(impFactor(3, 0.6 * 0.054 * 1000, 0)), j1 = 10 * Math.log10(impFactor(2, 0.6 * 0.011 * 1000, 0)); AM.prf = sv;
    add('図3.10：1 パルスの間に開口の 5.4% 進む場合の 2 重キャンセラ／1.1% 進む場合の 1 重キャンセラの改善係数', '30 dB／30 dB', fx(j2, 1) + ' dB／' + fx(j1, 1) + ' dB', Math.abs(j2 - 30) < 1.5 && Math.abs(j1 - 30) < 1.5 ? 'ok' : 'info', '図3.10 と本文（p.3.10）。σpm = 0.6·Vx/a のガウス形スペクトルで計算。ハンドブックはアンテナパターンのヌルからヌルまでを数値積分');
    const kt = 0.054 * 10 * 0.3048 * 1000 / 0.514444; add('同じ条件を速度に換算した値（PRF 1000 Hz、開口 10 ft の 5.4%）', '325 kt', fx(kt, 0) + ' kt', Math.abs(kt - 325) < 8 ? 'ok' : 'info', '本文（p.3.10）。0.054 × 10 ft × 1000 Hz'); }
  { const kt = 0.01 * 1000 * 0.03 / 2 / 0.514444; add('図3.8 の説明：10 GHz・PRF 1 kHz で、PRF の 1/100 のドップラ周波数に相当する速度', '0.29 kt（「または 0.005Vg」、Vg = 580 kt）', fx(kt, 2) + ' kt = ' + fx(kt / 580, 4) + '·Vg', Math.abs(kt - 0.29) < 0.01 ? 'info' : 'ng', '本文（p.3.7–3.8）。0.29 kt は一致。0.29 ÷ 580 = 0.0005 であるため、本文の「0.005Vg」は 0.0005Vg の誤記と読める'); }
  { const vx = 150, W = 2 * vx * AM.Tp; const res = w => { let s = 0; for (let i = -200; i <= 200; i++){ const th = i / 200 * 1.5 * AM.tha, eta = 2 * Math.PI * vx * AM.Tp * Math.sin(th) / AM.lam, xi = Math.PI * w * Math.sin(th) / AM.lam, d = 2 * Math.sin(eta - xi) / Math.cos(xi); s += g4(th) * d * d; } return s; };
    add('式3.7〜3.9：差パターンによる補正後に残留する 2 パルスの差の電力（ビーム内の合計）。W = 0／W = 2VxTp', 'W = 2VxTp、k = 1 で理想的に完全に打ち消される', 'W = 0 の場合を 1 として、W = 2VxTp = ' + fx(W, 2) + ' m の場合 ' + sci(res(W) / res(0) + 1e-40, 0), res(W) / res(0) < 1e-20 ? 'ok' : 'ng', '式3.7〜3.9 と本文（p.3.11）'); }
  { const n = 20, thd = AM.tha * AM.prf / n, dt = AM.Tp / 16; let s0 = 0, s2 = 0; const N = 4096, g = []; for (let k = -N / 2; k < N / 2; k++){ const th = thd * k * dt; g.push(Math.exp(-4 * Math.LN2 * th * th / (AM.tha * AM.tha))); }
    for (let m = -400; m <= 400; m++){ const f = m * 0.1; let re = 0, im = 0; for (let k = 0; k < N; k++){ const t = (k - N / 2) * dt; re += g[k] * Math.cos(2 * Math.PI * f * t); im -= g[k] * Math.sin(2 * Math.PI * f * t); } const p = re * re + im * im; s0 += p; s2 += p * f * f; }
    const sd = Math.sqrt(s2 / s0), fm = 0.265 * AM.prf / n; add('式3.16：走査によるスペクトルの標準偏差（ビーム幅あたり 20 パルス、PRF 300 Hz）', '0.265·fr/n = ' + fx(fm, 3) + ' Hz', fx(sd, 3) + ' Hz（ガウス形ビームが目標を通過する間の振幅変化のスペクトルを数値計算）', Math.abs(sd / fm - 1) < 0.01 ? 'ok' : 'ng', '式3.15・3.16（p.3.15）'); }
  { const vy = 150, th = 0.05, a = 4 * vy / AM.lam * Math.sin(th / 2) * Math.sin(th / 2), b = vy * th * th / AM.lam, ex = 2 * vy / AM.lam * (1 - Math.cos(th)); add('式3.23：進行方向を向いた場合のドップラ周波数の差（Vy = 150 m/s、θ = 0.05 rad）', '(4Vy/λ)·sin²(θ/2) ≈ Vy·θ²/λ', '正確な値 ' + fx(ex, 4) + ' Hz、式の左 ' + fx(a, 4) + ' Hz、右（近似）' + fx(b, 4) + ' Hz', near(a, ex, 1e-9) === 'ok' && Math.abs(b / a - 1) < 0.001 ? 'ok' : 'ng', '式3.23（p.3.21）');
    const azc = Math.atan(2.5 * AM.tha) / RAD; add('式3.3 の第 2 項が、第 1 項の 10% になるビームの方向（進行方向からの角度）', '第 2 項が無視できなくなるのは「進行方向から数ビーム幅以内」', fx(azc, 1) + '°（ビーム幅 ' + fx(AM.tha / RAD, 1) + '° の ' + fx(azc / (AM.tha / RAD), 1) + ' 倍）。2 つの項が等しくなるのは ' + fx(Math.atan(AM.tha / 4) / RAD, 1) + '°', azc / (AM.tha / RAD) > 1.5 && azc / (AM.tha / RAD) < 4 ? 'ok' : 'info', '本文（p.3.21）。ビームの端（θ = θa/2）での 2 つの項の比 = θa/(4·tan ψ₀) として計算（補足）'); }
  { const a = 1e5, b = 1e4, t = par(a, b); add('式3.11：サイドローブによる上限 50 dB と、DPCA の改善係数 40 dB を合成した値', '1/I_total = 1/I_sl + 1/I_DPCA', fx(10 * Math.log10(t), 2) + ' dB', near(10 * Math.log10(t), 39.59, 0.01), '式3.11（p.3.14）。並列の抵抗と同じ形の合成');
    add('式3.10：サイドローブによる改善係数の上限（ガウス形のメインビーム、一様な −30 dB のサイドローブと仮定）。1 重／2 重', '（ハンドブックに数値例なし）', fx(10 * Math.log10(impSl(2, -30)), 1) + ' dB／' + fx(10 * Math.log10(impSl(3, -30)), 1) + ' dB', 'ref', '式3.10（p.3.13）を、このシミュレータのアンテナの仮定に適用した値（補足）'); }
  { const sv = ST.cnr; ST.cnr = 0; ST.cache = null; const l0 = stapLoss(0.3); ST.cnr = sv; ST.cache = null; const l1 = stapLoss(0.3), l2 = stapLoss(0), l3 = stapLoss(0.06);
    add('STAP の例（素子 8 × パルス 8）：クラッタがない場合の S/N の低下。STAP／従来処理', '0 dB／重み付けによる損失だけ', fx(l0.opt, 2) + ' dB／' + fx(l0.conv, 2) + ' dB', Math.abs(l0.opt) < 1e-6 ? 'ref' : 'ng', '補足（計算の自己確認）。従来処理はハミングの重み付けを素子とパルスの両方に行ったもの');
    add('STAP の例：クラッタ（C/N 40 dB）がある場合の S/(C+N) の低下。正規化ドップラ 0.3／0.06／0 の目標。STAP', '（ハンドブックに数値例なし）', fx(l1.opt, 1) + '／' + fx(l3.opt, 1) + '／' + fx(l2.opt, 1) + ' dB（従来処理は ' + fx(l1.conv, 1) + '／' + fx(l3.conv, 1) + '／' + fx(l2.conv, 1) + ' dB）', 'ref', '補足。係数は式3.28 の形（w = R⁻¹·s）で計算。メインビームのクラッタと同じドップラ周波数（0）の目標は STAP でも検出できない'); }
  return R;
}
