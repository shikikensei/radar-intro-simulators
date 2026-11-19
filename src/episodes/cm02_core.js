/* ============================================================
   中級 第2回 クラッタの中の性能：計算部分（共通の計算は cm_common.js）
   もとにした資料：Radar Handbook 3rd ed. 第2章 MTI Radar
     §2.4 Clutter Characteristics（p.2.10–2.19：式2.14・2.15）、§2.5 Definitions（p.2.19–2.23：改善係数、クラッタ減衰、SCV、クラッタ可視係数 Voc）
     §2.6 Improvement Factor Calculations（p.2.23–2.25：式2.23〜2.25）、§2.12 Radar System Stability Requirements（p.2.65–2.78：式2.51〜2.57、表2.5、量子化）
   PDF のページを画像で見て確かめた式（p.2.73 の例。I = 50 dB = 電圧比 316、τ = 2 µs、Bτ = 1、距離 100 nmi）：
     式2.51・2.53  位相の変化 Δφ = 1/316 = 0.00316 rad = 0.18°          → I = 20·log(1/Δφ)
     式2.52        周波数の変化 Δf = 1/(316·2π·T) = 0.4 Hz（T = 100 × 12.36 µs）→ I = 20·log(1/(2π·Δf·T))
     式2.54        パルスの時刻のゆらぎ Δt = τ/(316·√2·√(Bτ)) = 4.5 ns    → I = 20·log(τ/(√2·Δt·√(Bτ)))
     式2.55        パルス幅のゆらぎ ΔPW = τ/(316·√(Bτ)) = 6 ns            → I = 20·log(τ/(ΔPW·√(Bτ)))
     式2.56        振幅の変化 ΔA/A = 1/316 = 0.3%                          → I = 20·log(A/ΔA)
   入門 第2回（legacy/mcore.js）で確かめてある式を写した：
     式2.1   ブラインド速度 VB = λ·fr/2
     式2.14  内部の動きによる広がり σf = 2·σv/λ　　式2.15  走査による広がり σf = 0.265·fr/n（n：ビーム幅の中のパルスの数）
     式2.23〜2.25  二項係数のキャンセラの改善係数の上限（ガウス形のスペクトル）
             I1 = 2·(fr/(2π·σf))²、I2 = 2·(fr/(2π·σf))⁴、I3 = (4/3)·(fr/(2π·σf))⁶
     量子化（p.2.73–2.74）  I = 20·log[(2^N − 1)·√0.75]
     独立な原因の消え残りは、電力で足す（p.2.72）：1/I = Σ 1/Ii
   モデル（補足）：
   ・クラッタのセルの面積 Ac = R·θ·(c·τ/2)（低い見下ろし角。θ：方位のビーム幅 [rad]、τ：圧縮後のパルス幅）。クラッタの断面積 σc = σ0·Ac。一般的な式。
   ・要る改善係数 = クラッタと目標の比（C/S）+ クラッタ可視係数 Voc。Voc には、中級 第1回の必要な S/N（消え残りを雑音と同じに扱う）を使った。
   ・σ0、内部の動き σv、安定度の値は、説明用に置いた値。
   ============================================================ */
const CL = {R: 50, s0: -30, th: 4.5, tau: 1, sv: 0.2, hits: 16, ord: 3, dphi: 0.18, df: 1.5, bits: 12, voc: 13.12};
const DEFAULTS = Object.assign({}, CL, {v: 20});
const S = Object.assign({}, DEFAULTS);
const cellArea = (Rkm, thDeg, tauUs) => Rkm * 1000 * (thDeg * Math.PI / 180) * (C0 * tauUs * 1e-6 / 2);      // [m²]
const sigF = (sv, hits, fp, lam) => { const a = 2 * sv / lam, b = hits > 0 ? Math.sqrt(Math.LN2) / Math.PI * fp / hits : 0; return {int: a, scan: b, tot: Math.hypot(a, b)}; };      // 式2.14・2.15。ガウス形どうしは 2 乗和の平方根
function iSpec(order, fp, sf){ const q = fp / (2 * Math.PI * sf); return order === 2 ? 2 * q * q : order === 3 ? 2 * Math.pow(q, 4) : 4 / 3 * Math.pow(q, 6); }      // 式2.23〜2.25（倍率）。order：パルスの数
const iPhase = dphiRad => 1 / (dphiRad * dphiRad);                                  // 式2.51・2.53
const iFreq = (df, T) => 1 / Math.pow(2 * Math.PI * df * T, 2);                     // 式2.52。T：クラッタまでの往復の時間
const iTime = (dt, tau, bt) => Math.pow(tau / (Math.SQRT2 * dt * Math.sqrt(bt)), 2); // 式2.54
const iWidth = (dpw, tau, bt) => Math.pow(tau / (dpw * Math.sqrt(bt)), 2);          // 式2.55
const iAmp = da => 1 / (da * da);                                                   // 式2.56
const iQuant = N => Math.pow((Math.pow(2, N) - 1) * Math.sqrt(0.75), 2);            // 量子化
function combineI(list){ let s = 0; for (const v of list) s += 1 / v; return 1 / s; }
const vBlind = (lam, fp) => lam * fp / 2;                                           // 式2.1
const mtiResp = (x, order) => Math.pow(2 * Math.sin(Math.PI * x), 2 * (order - 1)); // 二項係数のキャンセラの応答（電力）。x = v/VB
function calc(s){
  s = s || S; const ac = cellArea(s.R, s.th, s.tau), sc = db10(ac) + s.s0, cs = sc - db10(EXR.rcs), ireq = cs + s.voc, f = sigF(s.sv, s.hits, EXR.fp, EXR.lam);
  const T = 2 * s.R * 1000 / C0, L = [['クラッタのスペクトル幅', db10(iSpec(s.ord, EXR.fp, f.tot))], ['位相安定度', db10(iPhase(s.dphi * Math.PI / 180))], ['周波数安定度', db10(iFreq(s.df, T))], ['A/D のビット数', db10(iQuant(s.bits))]];
  const itot = db10(combineI(L.map(q => lin(q[1])))); let worst = 0; L.forEach((q, i) => { if (q[1] < L[worst][1]) worst = i; });
  const snr = 40 * Math.log10(M1.ro / (s.R * 1000)), cn = snr + cs, resid = cn - itot;      // 1 つの CPI のあとの S/N（中級 第1回）、同じ基準の C/N、消え残りと雑音の比
  return {ac, sc, cs, ireq, f, T, L, itot, worst, margin: itot - ireq, scv: itot - s.voc, snr, cn, resid};
}
const with_ = o => Object.assign({}, DEFAULTS, o);
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note}), near2 = (a, b, t) => Math.abs(a - b) <= t ? 'ok' : 'ng';
  { const d = 1 / 316; add('位相変動の許容値（改善係数 50 dB）', '式2.51：1/316 = 0.00316 rad = 0.18°', fx(d, 5) + ' rad = ' + fx(d * 180 / Math.PI, 2) + '°。逆に、0.18° のとき I = ' + fx(db10(iPhase(0.18 * Math.PI / 180)), 1) + ' dB', near2(d * 180 / Math.PI, 0.18, 0.005), 'p.2.73。I = 20·log(1/Δφ)'); }
  { const T = 100 * 12.36e-6, df = 1 / (316 * 2 * Math.PI * T); add('周波数変動の許容値（改善係数 50 dB、距離 100 nmi）', '式2.52：0.4 Hz', fx(df, 2) + ' Hz。逆に、0.4 Hz のとき I = ' + fx(db10(iFreq(0.4, T)), 1) + ' dB', near2(df, 0.4, 0.02), 'p.2.73。T は 100 nmi の往復時間（100 × 12.36 µs）'); }
  { const dt = 2e-6 / (316 * Math.SQRT2), dw = 2e-6 / 316; add('パルスのタイミングのジッタ／パルス幅のジッタの許容値（τ = 2 µs、Bτ = 1）', '式2.54：4.5 ns、式2.55：6 ns', fx(dt * 1e9, 2) + ' ns／' + fx(dw * 1e9, 2) + ' ns（I = ' + fx(db10(iTime(dt, 2e-6, 1)), 1) + ' dB／' + fx(db10(iWidth(dw, 2e-6, 1)), 1) + ' dB）', near2(dt * 1e9, 4.5, 0.05) === 'ok' && near2(dw * 1e9, 6, 0.4) === 'ok' ? 'ok' : 'ng', 'p.2.73。6 ns は 6.3 ns を丸めた値とみられる'); }
  add('振幅変動の許容値（改善係数 50 dB）', '式2.56：0.3%', fx(100 / 316, 2) + '%', near2(100 / 316, 0.3, 0.02), 'p.2.73');
  add('量子化による上限（10 ビット／12 ビット）', '20·log[(2^N − 1)·√0.75]。入門 第2回の照合と同じ式', fx(db10(iQuant(10)), 1) + ' dB／' + fx(db10(iQuant(12)), 1) + ' dB', near2(db10(iQuant(10)), 58.95, 0.05), 'p.2.73–2.74。1 ビットで約 6 dB');
  { const f = sigF(0, 14.4, 1000, 0.1); add('走査によるスペクトル幅（ビーム幅内のパルス 14.4 個、PRF 1 kHz）', '式2.15：σf = 0.265·fr/n', fx(f.scan, 2) + ' Hz（0.265 × 1000 ÷ 14.4 = ' + fx(265 / 14.4, 2) + '）', near2(f.scan, 265 / 14.4, 0.03), 'p.2.16。係数は √(ln 2)/π = ' + fx(Math.sqrt(Math.LN2) / Math.PI, 4)); }
  { const q = 1000 / (2 * Math.PI * 17), a = db10(iSpec(2, 1000, 17)), b = db10(iSpec(3, 1000, 17)), c = db10(iSpec(4, 1000, 17)); add('式2.23〜2.25：スペクトル幅 17 Hz、PRF 1 kHz の場合の改善係数の上限（2／3／4 パルス）', '2q²、2q⁴、(4/3)q⁶（q = fr/(2π·σf) = ' + fx(q, 3) + '）', fx(a, 1) + '／' + fx(b, 1) + '／' + fx(c, 1) + ' dB', near2(a, db10(2 * q * q), 1e-9), 'p.2.23–2.24。入門 第2回の eqI と同じ式'); }
  { const a = db10(combineI([1e4, 1e4])), b = db10(combineI([1e4, 1e6])); add('上限の合成：40 dB と 40 dB／40 dB と 60 dB', '残留成分を電力で加算（p.2.72）：37.0 dB／ほぼ 40 dB', fx(a, 2) + ' dB／' + fx(b, 2) + ' dB', near2(a, 36.99, 0.01), '同じ大きさの要因が 2 つあると 3 dB 低下する。20 dB 離れていれば、ほとんど影響しない'); }
  { const c = calc(with_({})); add('SCV（サブクラッタビジビリティ）と、改善係数・クラッタ可視係数', 'SCV [dB] = 改善係数 − Voc（p.2.22）', 'I = ' + fx(c.itot, 1) + ' dB、Voc = ' + fx(CL.voc, 2) + ' dB → SCV = ' + fx(c.scv, 1) + ' dB', near2(c.scv, c.itot - CL.voc, 1e-9), '定義どおり。Voc に中級 第1回の必要 S/N を使ったのは、この教材での設定（補足）'); }
  add('クラッタ可視係数 Voc に使った値（中級 第1回の必要 S/N。非変動目標、Pd 0.9、PFA 10⁻⁶）', '中級 第1回 ステップ 2：13.12 dB', fx(M1.s0, 2) + ' dB', near2(M1.s0, 13.12, 0.005), '式4.23。同じ式を cm_common.js に複写');
  { const c = calc(with_({})); add('例の計算書：クラッタセル面積・クラッタの RCS・C/S・所要改善係数・得られる改善係数・余裕', '（基準なし）', sci(c.ac, 2) + ' m²、' + fx(c.sc, 1) + ' dBsm、' + fx(c.cs, 1) + ' dB、' + fx(c.ireq, 1) + ' dB、' + fx(c.itot, 1) + ' dB、' + sgn2(c.margin, 1) + ' dB', 'ref', 'クラッタの値（σ0 = −30 dB、σv = 0.2 m/s）は説明用'); }
  { const v = vBlind(0.1, 1000); add('ブラインド速度（波長 10 cm、PRF 1 kHz）', '式2.1：VB = λ·fr/2', fx(v, 1) + ' m/s', near2(v, 50, 1e-9), 'p.2.9。入門 第2回 ステップ 4、第16回 ステップ 5 と同じ値'); }
  return R;
}
