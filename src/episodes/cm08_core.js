/* ============================================================
   中級 第8回 性能計算書を通して作る：計算部分（共通の計算は cm_common.js）
   もとにした資料：Radar Handbook 3rd ed. 第1章 §1.4（レーダ方程式）、§1.10（レーダの設計の考え方）と、中級 第1〜7回で使った章
   方針：新しい式は足さない。中級 第1〜7回の計算書の式を、同じ例のレーダ・同じ要求について、通して使う。
         どの式も、もとの回の計算部分と同じ値になることを、照合表と tests/harness/tm08.js で確かめる。
   要求（説明用。実在の装置のものではない）：RCS 1 m²・Swerling 1 の目標を、距離 60 km で、1 回の P_d 0.9 で探知する。
         海面のクラッタの中で見える。600 m/s で近づく目標が見える。横方向の位置の誤差 200 m 以下。時間の予算に収まる。
   各回から持ってきた式（かっこの中は、もとの回）：
     探知（第1回）    S/N [dB] = 40·log(Ro/R)、要る S/N は式4.25（Swerling 1 で 21.14 dB）
     クラッタ（第2回） C/S = σ⁰·Ac/σ、Ac = R·θ·(c·τ/2)。要る改善係数 = C/S + 要る S/N。ブラインド速度 λ·fp/2、3 パルスの応答 (2·sin(π·v/VB))⁴
     波形（第3回）    あいまいにならない距離 c/(2·fp)、ドップラ周波数 2·v/λ
     精度（第4回）    角度の誤差 θB/(km·√(2·S/N))（式9.10、n = 2）
     アンテナ（第5回） 走査の損失（片道）cos θ（式13.19）
     環境（第6回）    見通し距離 √(2·k·a·ha) + √(2·k·a·ht)、雨の減衰（図19.1 の読み取り、4 GHz の線）
     時間（第7回）    占有率 = 照射の時間 × 回数 ÷ 間隔。探知距離は、照射の時間の 4 乗根
   簡略化（補足）：
   ・クラッタの改善係数は、スライダーで与える 1 つの値（標準は、第2回の合成の値 40.68 dB）。距離による変化は入れていない。
   ・海面の反射によるローブ（第6回）は入れていない（伝搬因子 1）。見通しの外は、探知できないとした。
   ・走査の損失は、送信と受信の 2 回ぶん。ビームの広がりによる向きの数の変化は入れていない。
   ============================================================ */
const RAD = Math.PI / 180, AE0 = 6371e3, K43 = 1 / (1 - AE0 * 39e-9);
const REQ = {R: 60, pd: 0.9, cross: 200, v: 600};
const CL = {s0: -30, th: 4.5, tau: 1, km: 1.6, i0: 40.68, rain4: 0.022};
const DEFAULTS = {R: 60, ladj: 0, th: 0, rain: 0, ns: 16, n: 30, v: 600, ht: 100, ha: 20, ic: 40.68};
const S = Object.assign({}, DEFAULTS);
const snrFree = Rkm => 40 * Math.log10(M1.ro / (Rkm * 1000));                                   // [dB]
const csOf = Rkm => db10(Rkm * 1000 * CL.th * RAD * (C0 * CL.tau * 1e-6 / 2)) + CL.s0 - db10(EXR.rcs);      // C/S [dB]
const vBlind = () => EXR.lam * EXR.fp / 2;
const mtiDb = v => { const x = v / vBlind(); return 10 * Math.log10(Math.max(1e-9, Math.pow(2 * Math.sin(Math.PI * x), 4) / 6)); };      // 3 パルスの応答。平均（6 倍）を 0 dB とした
const angErr = snrDb => CL.th * RAD / (CL.km * Math.sqrt(2 * lin(snrDb)));                     // [rad]
const scanDb = th => -20 * Math.log10(Math.cos(th * RAD));                                     // 往復 [dB]
const losKm = (ha, ht) => (Math.sqrt(2 * K43 * AE0 * ha) + Math.sqrt(2 * K43 * AE0 * ht)) / 1000;
const rainDb = (rate, Rkm) => rate > 0 ? 2 * CL.rain4 * Math.pow(rate / 25.4, 1.15) * Rkm : 0; // 往復 [dB]
function calc(s){
  s = s || S; const req = M1.s1, snr = snrFree(s.R) - s.ladj - scanDb(s.th) - rainDb(s.rain, s.R) + db10(s.ns / EXR.np), mS = snr - req, los = losKm(s.ha, s.ht);
  const cs = csOf(s.R), ireq = cs + req, mC = s.ic - ireq, x = s.v / vBlind(), fr = x - Math.floor(x), mti = mtiDb(s.v), ae = angErr(snr), cross = s.R * 1000 * ae;
  const lw = 160 * s.ns / EXR.fp / EXR.tf, lh = 0.16, lt = s.n * 0.004, dem = lw + lh + lt, rdet = M1.r1 / 1000 * Math.pow(10, (snr - snrFree(s.R)) / 40);
  const V = [['探知：60 km 以上で、S/N の余裕が 0 dB 以上', s.R >= REQ.R && mS >= -1e-9, sgn2(mS, 2) + ' dB'], ['見通し：目標が、水平線の手前にある', los >= s.R, fx(los, 1) + ' km'], ['クラッタ：改善係数の余裕が 0 dB 以上', mC >= -1e-9, sgn2(mC, 2) + ' dB'],
    ['速度：600 m/s 付近の目標で、MTI の応答が平均の −6 dB 以上', mti >= -6, sgn2(mti, 1) + ' dB'], ['精度：横方向の位置の誤差が 200 m 以下', cross <= REQ.cross, fx(cross, 0) + ' m'], ['時間：占有率の合計が 100% 以下', dem <= 1 + 1e-9, fx(dem * 100, 1) + '%']];
  return {req, snr, mS, los, cs, ireq, mC, x, fr, mti, ae, cross, lw, lh, lt, dem, mT: 1 - dem, rdet, V, nok: V.filter(q => q[1]).length};
}
function sens(s){      // 1 段動かしたときの、S/N の余裕の変化 [dB]。大きい順
  s = s || S; const b = calc(s).mS, d = (t, o) => [t, calc(Object.assign({}, s, o)).mS - b];
  const L = [d('距離を 10 km 遠くする', {R: s.R + 10}), d('損失が 1 dB 増える', {ladj: s.ladj + 1}), d('走査の角度を 45° にする', {th: 45}), d('走査の角度を 60° にする', {th: 60}), d('強い雨（25 mm/h）が降る', {rain: 25}), d('照射のパルスを 2 倍にする', {ns: s.ns * 2})];
  L.push(['目標を、ゆらがないと見なす（要る S/N が変わる）', M1.s1 - M1.s0]);
  return L.sort((a, b2) => Math.abs(b2[1]) - Math.abs(a[1]));
}
const with_ = o => Object.assign({}, DEFAULTS, o);
function runChecks(){
  const R = [], add = (item, ref, calc_, st, note) => R.push({item, ref, calc: calc_, st, note}), nr = (a, b, t) => Math.abs(a - b) <= t ? 'ok' : 'ng', Z = calc(with_({}));
  add('探知距離（Swerling 1、P_d 0.9）', '中級 第1回：62.9 km（要る S/N 21.14 dB、R_o 212.3 km）', fx(M1.r1 / 1000, 1) + ' km（要る S/N ' + fx(M1.s1, 2) + ' dB）', nr(M1.r1 / 1000, 62.9, 0.05), '同じ共通の計算（cm_common.js）');
  add('クラッタと目標の比（50 km、σ⁰ −30 dB、ビーム幅 4.5°、パルス幅 1 μs）', '中級 第2回 ステップ 1：27.70 dB', fx(csOf(50), 2) + ' dB', nr(csOf(50), 27.70, 0.01), '');
  add('要る改善係数（50 km、ゆらがない目標の S/N 13.12 dB を使った場合）', '中級 第2回 ステップ 2：40.82 dB', fx(csOf(50) + M1.s0, 2) + ' dB', nr(csOf(50) + M1.s0, 40.82, 0.01), '第2回は、ゆらがない目標の値を使った');
  add('要る改善係数（60 km、Swerling 1 の S/N 21.14 dB を使った場合）', '（この回の要求。第2回とは、距離と、目標のゆらぎ方が違う）', fx(Z.ireq, 2) + ' dB（第2回の合成の値 40.68 dB に対して、余裕 ' + sgn2(Z.mC, 2) + ' dB）', 'info', '前提をそろえると、第2回の「わずかに足りない」が、「大きく足りない」に変わる。ステップ 3 で扱う');
  add('ブラインド速度と、600 m/s のドップラ周波数', '中級 第2回 ステップ 7：50 m/s。第3回 ステップ 7：12 kHz', fx(vBlind(), 0) + ' m/s、' + fx(2 * 600 / EXR.lam / 1000, 0) + ' kHz（PRF の ' + fx(Z.x, 0) + ' 倍）', nr(vBlind(), 50, 1e-6), '600 m/s は、ブラインド速度のちょうど 12 倍');
  { const a = angErr(snrFree(100)) * 1000; add('熱雑音による角度の誤差（100 km）', '中級 第4回 ステップ 1：7.70 mrad', fx(a, 3) + ' mrad', nr(a, 7.699, 0.005), '式9.10'); }
  add('走査の損失（60°、片道）', '式13.19：10·log(1/cos 60°) = 3.01 dB', fx(scanDb(60) / 2, 3) + ' dB（往復 ' + fx(scanDb(60), 2) + ' dB）', nr(scanDb(60) / 2, 3.0103, 0.001), '送信と受信で 2 回かかる');
  add('走査の損失（45°、片道）', '中級 第5回 ステップ 3：1.505 dB', fx(scanDb(45) / 2, 3) + ' dB', nr(scanDb(45) / 2, 1.505, 0.001), '式13.19');
  add('見通し距離（アンテナ 20 m、目標 100 m）', '中級 第6回 ステップ 1：59.6 km', fx(losKm(20, 100), 2) + ' km', nr(losKm(20, 100), 59.59, 0.01), '');
  add('雨の減衰（25.4 mm/h、50 km、往復、4 GHz の線）', '中級 第6回 ステップ 6：2.2 dB', fx(rainDb(25.4, 50), 2) + ' dB', nr(rainDb(25.4, 50), 2.2, 0.001), '図19.1 の読み取り');
  add('占有率の合計（広域 64%、水平線 16%、追尾 30 目標）', '中級 第7回 ステップ 4：92%', fx(Z.dem * 100, 1) + '%', nr(Z.dem, 0.92, 1e-9), '');
  add('この回の例の計算書：6 つの判定', '（基準なし）', Z.V.map(q => (q[1] ? '○' : '×') + q[2]).join('、'), 'ref', '説明用の値。満たさない項目があるのは、わざと（直し方は 1 つではない）');
  return R;
}
