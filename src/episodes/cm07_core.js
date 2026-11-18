/* ============================================================
   中級 第7回 時間と資源の見積もり：計算部分（共通の計算は cm_common.js）
   もとにした資料：Radar Handbook 3rd ed. 第1章 §1.4（p.1.12、式1.5・1.6）、第24章 §24.11 のうち資源の管理の部分（p.24.44–24.45、図24.13）、
                   第4章 §4.6（式4.27：累積の検出確率）、
                   M. R. Smouse ほか "Integrated Air and Missile Defense Resource Management," Johns Hopkins APL Technical Digest, Vol. 35, No. 2 (2020) の前半（p.99–104）
   入門 第13回・第15回、中級 第1回で確かめてある式と考え方を写した：
     式1.6   捜索レーダの形：Rmax⁴ = Pav·Ae·σ·ts / (4π·k·T0·Fn·(S/N)·Ls·Ω)（ts：捜索 1 巡の時間、Ω：捜索する立体角）
     ビームの立体角 Ω0 = 4π/G = λ²/Ae（式1.6 の導き方。入門 第15回と同じ）
     式4.27  累積の検出確率 = 1 − Π(1 − 1 回の Pd)
     p.24.45 更新間隔を、目標の速さで選ぶ例（0.5 秒／2 秒／3 秒）
   モデル（補足。すべて説明用）：
   ・役目は 4 つ：広域の捜索、水平線の捜索、ふつうの追尾、速い目標の追尾。それぞれの占有率 = 1 回の照射の時間 × 回数 ÷ 間隔。
   ・照射の時間は、パルスの数 ÷ PRF（1 kHz）。向きを変える時間、送信の休み、スケジューラのすき間は、入れていない。
   ・優先度は、追尾 → 水平線の捜索 → 広域の捜索。要求の合計が 100% を超えたら、広域の捜索に残りの時間だけを渡し、フレーム時間を延ばす。
   ・探知距離は、広域の捜索の照射の時間（コヒーレントに足す）の 4 乗根に比例。16 パルスで、中級 第1回の 99.8 km。
   ・予測の誤差は、フィルタが考えていない一定の加速度 a が、更新間隔 T のあいだ続いた場合の a·T²/2。
   ・累積の検出確率は、Swerling 1、まっすぐ近づく目標（600 m/s）。照射の時間は同じで、フレーム時間だけが延びる（1 回の Pd は同じ、見る回数が減る）。
   ============================================================ */
const G0 = 9.8, OM0 = EXR.lam * EXR.lam / EXR.ae;      // ビームの立体角 [sr]
const DEFAULTS = {om: 1.0, ns: 16, tfd: 4, nh: 20, nhp: 8, th: 1, n: 30, nf: 0, tn: 2, tfs: 0.5, ntp: 8, acc: 3, tfa: 4, pd1: 0.4};
const S = Object.assign({}, DEFAULTS);
const beams = om => om / OM0;
const tSearch = s => beams(s.om) * s.ns / EXR.fp;                         // 広域の捜索 1 巡の、照射の時間の合計 [s]
const rDet = ns => M1.r0 * Math.pow(ns / EXR.np, 0.25);                   // [m]
const predErr = (g, T) => 0.5 * g * G0 * T * T;                           // [m]
function rmax16(ts, om, snrdb){ return Math.pow(EXR.pav * EXR.ae * EXR.rcs * ts / (4 * Math.PI * KT0 * lin(EXR.fn) * lin(snrdb) * lin(EXR.lt) * om), 0.25); }      // 式1.6
function calc(s){
  s = s || S; const tw = tSearch(s), lw = tw / s.tfd, lh = s.nh * s.nhp / EXR.fp / s.th, lt = s.n * s.ntp / EXR.fp / s.tn, lf = s.nf * s.ntp / EXR.fp / s.tfs;
  const dem = lw + lh + lt + lf, share = dem <= 1 ? lw : Math.max(0, 1 - lh - lt - lf), tfa = share > 1e-9 ? tw / share : Infinity;
  return {nb: beams(s.om), tw, lw, lh, lt, lf, dem, margin: 1 - dem, share, tfa, r: rDet(s.ns) / 1000, perN: s.ntp / EXR.fp / s.tn, perF: s.ntp / EXR.fp / s.tfs, err: predErr(s.acc, s.tn), errF: predErr(s.acc, s.tfs)};
}
const pdSw1 = (rkm, ro) => pd424(Math.pow(ro / 1000 / rkm, 4), EXR.pfa, 1, 1);
function cumAt(tf, rkm, ro){ let q = 1; ro = ro || M1.ro; for (let k = 0; k < 400; k++){ const R = rkm + k * 0.6 * tf; if (R > 3 * ro / 1000) break; q *= 1 - pdSw1(R, ro); } return 1 - q; }      // 距離 rkm までの累積（rkm で 1 回見る）
function rCum(tf, pc){ let lo = 5, hi = 400; for (let i = 0; i < 40; i++){ const m = (lo + hi) / 2; if (cumAt(tf, m) >= pc) lo = m; else hi = m; } return (lo + hi) / 2; }
const looksFor = (pd1, pc) => Math.ceil(Math.log(1 - pc) / Math.log(1 - pd1) - 1e-9);
const with_ = o => Object.assign({}, DEFAULTS, o);
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note}), nr = (a, b, t) => Math.abs(a - b) <= t ? 'ok' : 'ng', pc = v => fx(v * 100, 1) + '%';
  add('ビームの立体角 Ω0 = 4π/G = λ²/Ae（例のレーダ）', '入門 第15回と同じ決め方。4π ÷ 2011 = 0.00625 sr', fx(OM0, 5) + ' sr（4π/G = ' + fx(4 * Math.PI / gainOf(EXR.ae, EXR.lam), 5) + '）', nr(OM0, 4 * Math.PI / gainOf(EXR.ae, EXR.lam), 1e-9), '式1.6 の導き方（p.1.12）');
  { const c = calc(with_({})), r = rmax16(c.tw, 1.0, M1.s0) / 1000; add('式1.6（捜索の形）で、1 sr を 2.56 秒で 1 巡するときの探知距離', '中級 第1回：99.8 km（16 パルス = 16 ms の照射、ゆらがない目標、P_d 0.9）', fx(r, 2) + ' km', nr(r, M1.r0 / 1000, 0.05), '向きの数 × 照射の時間 = 1 巡の時間なので、式1.5 の形と同じ値になる'); }
  { const r = rmax16(4, 1.0, M1.s0) / 1000, a = rDet(25) / 1000; add('式1.6：1 巡の時間を 4 秒に延ばしたとき（照射 25 ms）', '99.8 km × (4 ÷ 2.56)^(1/4)', '式1.6：' + fx(r, 2) + ' km、照射の時間の 4 乗根：' + fx(a, 2) + ' km', nr(r, a, 0.05), '距離は、時間の 4 乗根でしか伸びない'); }
  { const ps = [120, 110, 100].map(x => pdSw1(x, M1.ro)), c = cumPd(ps); add('式4.27：累積の検出確率（Swerling 1、120・110・100 km で 1 回ずつ）', '中級 第1回 ステップ 8：1 回の P_d 0.278／0.395／0.523、累積 0.792', ps.map(p => fx(p, 3)).join('／') + '、累積 ' + fx(c[2], 3), nr(c[2], 0.792, 0.002), '回をまたいで、同じ条件なら同じ値'); }
  add('p.24.45：更新間隔を、目標の速さで選ぶ例（0.5 秒／2 秒／3 秒）', '（ハンドブックの例の値。占有率は、この回の計算）', '照射 8 ms なら、目標 1 つの占有率は ' + [0.5, 2, 3].map(t => pc(0.008 / t)).join('／'), 'ref', '速い目標ほど、短い間隔。間隔が 1/4 なら、負荷は 4 倍');
  { const c = calc(with_({n: 60, nf: 10})), sum = c.share + c.lh + c.lt + c.lf; add('要求が 100% を超えたとき（目標 60、速い目標 10）：渡した時間の合計', '100%（広域の捜索が、残りを全部使う）', '要求 ' + pc(c.dem) + '、渡した時間の合計 ' + pc(sum) + '、広域の捜索のフレーム時間 ' + fx(c.tfa, 2) + ' 秒（望みは 4 秒）', nr(sum, 1, 1e-9), 'Smouse ほか（2020）の「柔軟なタスク」の考え方：優先度の低い捜索が、延びて吸収する。入門 第13回 ステップ 6'); }
  add('予測の誤差 a·T²/2（3 g、更新間隔 2 秒／0.5 秒）', '（この範囲の資料に式なし）等加速度の運動の式', fx(predErr(3, 2), 1) + ' m／' + fx(predErr(3, 0.5), 1) + ' m', 'ref', '補足のモデル。入門 第5回の「遅れ」と同じ考え方');
  add('フレーム時間と、累積の P_d が 0.9 になる距離（照射の時間は同じ。Swerling 1、600 m/s）', '（基準なし）', [2, 4, 6, 8, 12].map(t => t + ' 秒：' + fx(rCum(t, 0.9), 1) + ' km').join('、'), 'ref', 'フレーム時間が延びると、見る回数が減り、距離が縮む。中級 第1回 ステップ 8 は、延ばしたぶん照射も長くする場合で、条件が違う');
  { const a = looksFor(0.4, 0.9); add('1 回の P_d 0.4 で、累積 0.9 に要る回数', '1 − 0.6⁵ = 0.922、1 − 0.6⁴ = 0.870', a + ' 回', a === 5 ? 'ok' : 'ng', '式4.27 で、1 回の P_d が同じ場合'); }
  return R;
}
