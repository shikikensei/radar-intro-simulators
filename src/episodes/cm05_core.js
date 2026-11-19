/* ============================================================
   中級 第5回 アレイの実際：計算部分（共通の計算は cm_common.js）
   もとにした資料：Radar Handbook 3rd ed. 第13章 Phased Array Radar Antennas
     §13.2 Array Theory（p.13.9–13.15：式13.5・13.9・13.15〜13.19）、§13.5 Low-sidelobe Phased Arrays（p.13.28–13.34：式13.22、誤りのある素子）、
     §13.6 Quantization Effects（p.13.34–13.38：式13.23〜13.25、図13.23）、§13.7 Bandwidth of Phased Arrays（p.13.38–13.46：式13.26）
   PDF のページを画像で見て確かめた式：
     式13.22（p.13.30）  MSSL = σT² / ( ηa·N·(1 − σT²) )、σT² = σφ² + σA²（σφ：位相の誤差 [rad]、σA：振幅の誤差 [V/V]）
                          例：5000 素子、ηa = 0.7、σA = 0.1、σφ = 0.1 → 5.8×10⁻⁶ = −52 dB
     p.13.32            故障した素子を含む場合：MSSL = ( (1 − P) + σA² + P·σφ² ) / ( ηa·P·N )（1 − P：素子が故障している確率。素子パターンを無視）
   入門 第7回（c7_core.js）で確かめてある式を写した：
     式13.5   一様な重みのビーム幅 50.8°/(a/λ)、第 1 サイドローブ −13.3 dB
     式13.9   グレーティングローブが出ない間隔 s/λ ≤ 1/(1 + sin θ0)
     式13.19  走査したときの利得の低下 cos θ0（片道）
     式13.25  移相器の量子化による利得の低下 ≈ σφ² = π²/(3·2^(2p))（p：ビット数）。図13.23：量子化のローブの頂上は、およそ −6p dB
     式13.26  周波数を変えたときのビームのずれ Δθ0 = −(Δf/f)·tan θ0。60° 走査での帯域の基準：帯域 [%] = 正面のビーム幅 [度]
   モデル（補足）：
   ・正方形の平面アレイ（1 辺 n 個、合計 N = n² 個、間隔 s）。利得 G = 4π·A/λ²·ηa、A = N·s²（p.13.13 の、一様で損失のない開口の式に、開口効率を掛けた）。
     半波長の間隔なら G = π·N·ηa。ビーム幅は式13.5 を 1 辺の長さ n·s に使う。走査したときのビーム幅は 1/cos θ0 倍。
   ・故障による利得の低下を 10·log P（開口が P 倍になるぶん）とした。送信の電力が減るぶんは入れていない。
   ・要求の値（利得 33 dB、走査 ±60°、サイドローブの平均 −45 dB、帯域幅 3%）は説明用。例のレーダの利得 33 dB（有効開口面積 1.6 m²、波長 10 cm）を、アレイで作るとした。
   ============================================================ */
const RAD = Math.PI / 180;
const REQ = {g: 33, scan: 60, mssl: -45, bw: 3};
const DEFAULTS = {n: 25, s: 0.5, th: 60, sp: 5, sa: 0.05, bits: 4, fail: 0, eta: 1, df: 1};
const S = Object.assign({}, DEFAULTS);
const gainArr = (N, s, eta) => 4 * Math.PI * N * s * s * eta;          // s：波長で測った間隔
const bw135 = aLam => 50.8 / aLam;                                    // 式13.5 [度]
const glLimit = thDeg => 1 / (1 + Math.sin(Math.abs(thDeg) * RAD));   // 式13.9
const scanLoss = thDeg => Math.cos(thDeg * RAD);                      // 式13.19（片道、倍率）
const mssl = (sp, sa, N, eta) => { const st = sp * sp + sa * sa; return st / (eta * N * (1 - st)); };                       // 式13.22。sp [rad]
const msslFail = (sp, sa, N, eta, P) => ((1 - P) + sa * sa + P * sp * sp) / (eta * P * N);                                 // p.13.32
const sigQ = p => Math.PI / (Math.sqrt(3) * Math.pow(2, p));          // 量子化の位相の誤差（rms）[rad]
const quantLoss = p => p > 0 ? 1 - sigQ(p) * sigQ(p) : 1;             // 式13.25（倍率）
const squint = (dfPct, thDeg) => dfPct / 100 * Math.tan(thDeg * RAD) / RAD;   // 式13.26 [度]（大きさ）
const fillTime = (aM, thDeg) => aM * Math.sin(thDeg * RAD) / C0;      // 開口を埋める時間 [s]
function calc(s){
  s = s || S; const N = s.n * s.n, g0 = gainArr(N, s.s, s.eta), aLam = s.n * s.s, bw0 = bw135(aLam), P = 1 - s.fail / 100, sp = s.sp * RAD, sq = s.bits > 0 ? sigQ(s.bits) : 0, spT = Math.hypot(sp, sq);
  const ms = P < 1 ? msslFail(spT, s.sa, N, s.eta, P) : mssl(spT, s.sa, N, s.eta), lScan = -db10(scanLoss(s.th)), lQ = -db10(quantLoss(s.bits)), lErr = -db10(1 - (sp * sp + s.sa * s.sa)), lFail = -db10(P);
  const sqz = squint(s.df, s.th), bwS = bw0 / Math.cos(s.th * RAD), bwPct = bw0;      // 帯域の基準（60° 走査）：帯域 [%] = 正面のビーム幅 [度]
  return {N, g0, g0db: db10(g0), aLam, aM: aLam * EXR.lam, bw0, bwS, gl: glLimit(REQ.scan), glOk: s.s <= glLimit(REQ.scan) + 1e-9, ms, msdb: db10(ms), spT, sq, lScan, lQ, lErr, lFail, lTot1: lScan + lQ + lErr + lFail, gS: db10(g0) - lScan - lQ - lErr - lFail, sqz, bwPct, fill: fillTime(aLam * EXR.lam, s.th), qpk: s.bits > 0 ? -6.02 * s.bits : NaN};
}
function verdict(s, c){ c = c || calc(s); return [['正面の利得 33 dB 以上（誤差・量子化・故障の損失を引いた値）', c.g0db - c.lQ - c.lErr - c.lFail >= REQ.g - 1e-9], ['±60° までグレーティングローブが生じない', c.glOk], ['平均サイドローブレベル −45 dB 以下', c.msdb <= REQ.mssl + 1e-9], ['帯域幅 3% 以上（60° 走査の基準）', c.bwPct >= REQ.bw - 1e-9]]; }
const with_ = o => Object.assign({}, DEFAULTS, o);
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note}), nr = (a, b, t) => Math.abs(a - b) <= t ? 'ok' : 'ng';
  { const m = mssl(0.1, 0.1, 5000, 0.7); add('式13.22 の例：5000 素子、開口効率 0.7、σA = 0.1、σφ = 0.1 rad', '5.8×10⁻⁶ = −52 dB', sci(m, 2) + ' = ' + fx(db10(m), 1) + ' dB', nr(db10(m), -52, 0.5), 'p.13.30。PDF の画像で確認した式'); }
  { const a = msslFail(0.1, 0.1, 5000, 0.7, 1), b = mssl(0.1, 0.1, 5000, 0.7); add('故障を含む式で故障なし（P = 1）とした場合', '式13.22 から分母の (1 − σT²) を除いた形（p.13.32）', fx(db10(a), 2) + ' dB（式13.22 は ' + fx(db10(b), 2) + ' dB）', nr(db10(a) - db10(b), db10(0.98), 1e-6), '差は 10·log(1 − σT²) = ' + fx(db10(0.98), 2) + ' dB。低サイドローブのアンテナでは無視できる'); }
  add('p.13.31 の例：位相誤差 5°（rms）の平均サイドローブレベル', '素子 1 つの利得の約 21 dB 下。1000 素子の場合は、アレイの利得の 51 dB 下', '素子に対して ' + fx(db10(Math.pow(5 * RAD, 2)), 1) + ' dB、1000 素子で ' + fx(db10(mssl(5 * RAD, 0, 1000, 1)), 1) + ' dB', nr(db10(Math.pow(5 * RAD, 2)), -21, 0.3), '図13.18 の説明。σφ² = (5° をラジアンに換算した値)²');
  add('式13.5：一様な重み付けの場合のビーム幅（開口 100 波長）', '50.8°/(a/λ) = 0.508°（入門 第7回の照合と同じ）', fx(bw135(100), 3) + '°', nr(bw135(100), 0.508, 1e-9), 'p.13.12');
  add('式13.9：グレーティングローブが生じない素子間隔の上限。走査 90°／60°／45°', '0.5／0.53／0.59 波長（入門 第7回の照合と同じ）', [90, 60, 45].map(t => fx(glLimit(t), 3)).join('／') + ' 波長', nr(glLimit(60), 0.536, 0.001), 'p.13.13');
  add('式13.19：60° に走査した場合の利得の低下（片道）', 'cos 60° = 0.5（−3.0 dB）', fx(scanLoss(60), 2) + '（' + fx(db10(scanLoss(60)), 2) + ' dB）。往復では ' + fx(2 * db10(scanLoss(60)), 2) + ' dB', nr(db10(scanLoss(60)), -3.01, 0.01), 'p.13.15。中級 第1回の損失の表の「走査 1.0 dB（往復）」は、約 27° に相当');
  add('式13.25：移相器の量子化による利得の低下。2／3／4 ビット', '1.0／0.23／0.06 dB（入門 第7回の照合と同じ）', [2, 3, 4].map(p => fx(-db10(quantLoss(p)), 2)).join('／') + ' dB', nr(-db10(quantLoss(3)), 0.23, 0.005), 'p.13.34–13.35。位相誤差（rms）は π/(√3·2^p)');
  { const d = squint(1, 60); add('式13.26：周波数を 1% 変えた場合のビーム方向の偏移（60° 走査）', 'Δθ0 = (Δf/f)·tan θ0 = 0.0173 rad', fx(d, 3) + '°（' + fx(d * RAD, 4) + ' rad）', nr(d * RAD, 0.01732, 1e-4), 'p.13.38。入門 第7回 ステップ 8'); }
  { const c = calc(with_({})); add('例のアレイ（25 × 25 = 625 素子、半波長間隔、一様な重み付け）の利得と例のレーダの利得', '中級 第1回：有効開口面積 1.6 m²、波長 10 cm で 33.0 dB', '利得 π·N = ' + fx(c.g0db, 2) + ' dB（開口 ' + fx(c.aM, 2) + ' m 角 = ' + fx(c.aM * c.aM, 2) + ' m²）', Math.abs(c.g0db - db10(gainOf(EXR.ae, EXR.lam))) < 0.15 ? 'ok' : 'info', 'G = 4π·A/λ²。625 素子 × (5 cm)² = 1.56 m² であり、1.6 m² よりわずかに小さい'); }
  { const c = calc(with_({})); add('例のアレイ：ビーム幅（正面／60°）、平均サイドローブレベル、損失の合計（60°、片道）', '（基準なし）', fx(c.bw0, 2) + '°／' + fx(c.bwS, 2) + '°、' + fx(c.msdb, 1) + ' dB、' + fx(c.lTot1, 2) + ' dB', 'ref', '位相誤差 5°、振幅誤差 5%、4 ビット。値は説明用'); }
  return R;
}
