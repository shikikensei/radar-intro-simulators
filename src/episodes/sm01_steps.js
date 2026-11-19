/* ============================================================
   中級 第1回 検出の計算：ステップの定義（数値入力式。枠組みは fw_m_add.js）
   ============================================================ */
function resetS(init){ for (const k in S) delete S[k]; Object.assign(S, DEFAULTS, init); }
const PRE = ['db', 'prob', {no: 4, step: 3, t: '検出確率・誤警報確率・目標の変動：'}, {no: 15, step: 4, t: 'レーダ方程式と「検出に必要な S/N」：'}, {no: 16, step: 6, t: '信号の流れの中での判定：'}];
const Z = std();
const SWN = ['非変動', 'Swerling 1', 'Swerling 2', 'Swerling 3', 'Swerling 4'];
const sg = (v, d) => (v >= 0 ? '+' : MINUS) + Math.abs(v).toFixed(d === undefined ? 2 : d);
const pfaTxt = x => x % 1 ? sci(Math.pow(10, -x), 1) : '10' + sup(-x);
const kmT = m => fx(m / 1000, 1) + ' km';
const NS = [1, 2, 4, 8, 16, 32];
const CT = {
  ltavg: {l: '平均誤警報間隔 T<sub>AVG</sub>', min: 0, max: 4, step: 0.25, f: v => (v < 2 ? fx(Math.pow(10, v), v % 1 ? 1 : 0) + ' 秒' : fx(Math.pow(10, v) / 60, 1) + ' 分'), h: v => '誤警報時間 T_FR = ' + fx(Math.pow(10, v) * Math.LN2, 2) + ' 秒'},
  cells: {l: '1 回のドウェルで判定するセル数', seg: [[160, '160'], [1600, '1600'], [16000, '1.6 万'], [160000, '16 万']]},
  x: {l: '誤警報確率 P<sub>FA</sub>', min: 4, max: 8, step: 0.5, f: v => pfaTxt(v)},
  pd: {l: '検出確率 P<sub>d</sub>', min: 0.1, max: 0.99, step: 0.01, f: v => fx(v, 2)},
  sw: {l: '目標の変動モデル', seg: [[0, '非変動'], [1, 'Swerling 1'], [2, '2'], [3, '3'], [4, '4']]},
  npdi: {l: 'ノンコヒーレント積分する CPI 数 N<sub>pdi</sub>', seg: NS.map(n => [n, String(n)])},
  n: {l: 'ルック数 N', min: 1, max: 8, step: 1, f: v => fx(v, 0) + ' 回'},
  m: {l: '必要な検出数 M', min: 1, max: 8, step: 1, f: v => fx(Math.min(v, S.n), 0) + ' 回以上', h: v => v > S.n ? 'N を超えないように ' + S.n + ' として計算' : ''},
  pl: {l: '1 ルックの検出確率', min: 0.05, max: 0.99, step: 0.01, f: v => fx(v, 2)},
  ng: {l: 'IPP 内のレンジゲート数', seg: [[5, '5'], [10, '10'], [20, '20']]},
  ladj: {l: '損失見積もりの変更', min: -6, max: 6, step: 0.5, f: v => sg(v, 1) + ' dB', h: v => '損失の合計 ' + fx(Z.lt.tot + v, 2) + ' dB'},
  pavdb: {l: '平均電力の変更', min: -6, max: 10, step: 1, f: v => sg(v, 0) + ' dB', h: v => fx(EX.pav * lin(v) / 1000, 2) + ' kW'},
  dr: {l: '1 回の走査の間に目標が接近する距離', min: 2, max: 30, step: 1, f: v => fx(v, 0) + ' km'},
  ltf: {l: 'フレーム時間（同じ方向を再び照射するまでの時間）', min: 0, max: 2.5, step: 0.05, f: v => fx(Math.pow(10, v), v < 1 ? 1 : 0) + ' 秒', h: v => '1 回の走査の間に ' + fx(EX.v * Math.pow(10, v) / 1000, 1) + ' km 接近'}
};
const STEPS = [];
const FIXE = ['例のレーダ：平均電力 1 kW、利得 33 dB、波長 10 cm、目標 1 m²'];
/* 計算書：全ステップ共通の行（標準の条件）。st は、その行を決めるステップ */
function SHEET(){
  return [
    {head: '前提（例のレーダ。説明用の値）'},
    {k: '平均送信電力 P<sub>av</sub>', f: '所与', v: '1.00', u: 'kW', st: 0}, {k: '利得 G<sub>T</sub> = G<sub>R</sub>、波長 λ', f: '有効開口面積 1.6 m²', v: '33.0 dB、10', u: 'cm', st: 0}, {k: '目標 σ<sub>T</sub>', f: '所与', v: '1', u: 'm²', st: 0},
    {k: '雑音 k·T<sub>s</sub>、帯域幅 B<sub>n</sub>', f: '雑音指数 3 dB、CPI 16 ms', v: sci(KT0 * lin(EX.fn), 2) + ' W/Hz、62.5', u: 'Hz', st: 0}, {k: 'ドウェル T<sub>d</sub>、セル N<sub>r</sub> × N<sub>f</sub>', f: '所与', v: '16 ms、100 × 16', u: '', st: 0}, {k: '平均誤警報間隔 T<sub>AVG</sub>、検出確率 P<sub>d</sub>', f: '要求として所与', v: '10 秒、0.9', u: '', st: 0},
    {head: '誤警報'},
    {k: '誤警報時間 T<sub>FR</sub>', f: 'T<sub>AVG</sub>·ln 2（p.4.44）', v: fx(Z.tfr, 2), u: '秒', st: 1}, {k: 'セルあたりの P<sub>FA</sub>', f: '式4.18（1 ルック）', v: sci(Z.pfa, 1), u: '', st: 1},
    {head: '必要 S/N（1 つの CPI の処理後の値）'},
    {k: 'η', f: '式4.23 の下の式', v: fx(etaOf(EX.pd, Z.pfa), 3), u: '', st: 2}, {k: '非変動目標', f: '式4.23、N<sub>pdi</sub> = 1', v: fx(Z.s0, 2), u: 'dB', st: 2},
    {k: 'Swerling 1 の目標', f: '式4.25、N<sub>pdi</sub> = 1、n<sub>e</sub> = 1', v: fx(Z.s1, 2), u: 'dB', st: 3}, {k: '変動損失', f: '上の 2 行の差', v: fx(Z.fl, 2), u: 'dB', st: 3},
    {k: '4 個を積分する場合（非変動）', f: '式4.23、N<sub>pdi</sub> = 4。1 個あたり', v: fx(Z.s4, 2), u: 'dB', st: 4}, {k: '積分損失', f: '6.02 dB − 積分による改善量', v: fx(Z.il, 2), u: 'dB', st: 4},
    {k: '2-of-3 のドウェルの P<sub>d</sub>', f: '式4.26。1 ルック 0.7', v: fx(Z.pdw, 3), u: '', st: 5}, {k: '2-of-3 のドウェルの誤警報確率', f: '式4.26。1 ルック 10⁻³', v: sci(Z.pfw, 2), u: '', st: 5},
    {head: '損失と探知距離'},
    {k: 'エクリプシングとストラドル', f: '式4.17、N = 10', v: fx(db10(eclApprox(EX.ngate)), 2), u: 'dB', st: 6}, {k: '損失の合計 L<sub>T</sub>', f: '14 項目の和（dB）', v: fx(Z.lt.tot, 2), u: 'dB', st: 6},
    {k: 'R<sub>o</sub>（S/N が 1 になる距離）', f: '式4.16', v: fx(Z.ro / 1000, 1), u: 'km', st: 6}, {k: '探知距離（1 回の P<sub>d</sub> 0.9、非変動）', f: '式4.15、S/N = 13.12 dB', v: fx(Z.r0 / 1000, 1), u: 'km', st: 6}, {k: '探知距離（1 回の P<sub>d</sub> 0.9、Swerling 1）', f: '式4.15、S/N = 21.14 dB', v: fx(Z.r1 / 1000, 1), u: 'km', st: 6},
    {head: '累積検出確率'},
    {k: '5 回のうち 1 回以上（毎回 0.3）', f: '1 − 0.7⁵', v: fx(Z.c5, 3), u: '', st: 7}, {k: '3 回のうち 1 回以上（0.1、0.2、0.3）', f: '式4.27', v: fx(Z.c3, 3), u: '', st: 7},
    {k: '100 km での 1 回の P<sub>d</sub>（Swerling 1）', f: '式4.15・4.24', v: fx(Z.ps[2], 3), u: '', st: 8}, {k: '100 km までの累積の P<sub>d</sub>（120・110・100 km）', f: '式4.27', v: fx(Z.cum[2], 3), u: '', st: 8}];
}
const xsDb = (a, b, d) => { const o = []; for (let v = a; v <= b + 1e-9; v += d) o.push(v); return o; };
const PDX = xsDb(0.1, 0.99, 0.01);

/* 1 */
STEPS.push({short: '誤警報確率の決定', title: '誤警報確率の決定 — 誤警報時間からセルあたりの P_FA を求める', src: '第4章 §4.6 Range Performance：Probability of False Alarm（p.4.44、式4.18）',
  q: '誤警報は平均して 10 秒に 1 回まで許容すると決めた。1 回の{{g-look-and-dwell|ドウェル}}（16 ms）で判定するセルは距離 100 × ドップラ 16 = 1600 個ある。||(1) {{g-false-report-time|誤警報時間}} T<sub>FR</sub>（その時間内に 1 回以上の誤警報が生じる確率が 0.5 になる時間）は何秒か。||(2) セルあたりの{{g-pfa-per-cell|誤警報確率}} P<sub>FA</sub> はいくらか。',
  ask: [{id: 'tfr', label: '(1) 誤警報時間 T<sub>FR</sub>', unit: '秒', ans: Z.tfr, tol: 0.05, tolType: 'abs', hints: ['T<sub>FR</sub> ≈ T<sub>AVG</sub> × ln 2 であり、ln 2 ≈ 0.693 である。', '10 × 0.693 を計算する。']},
    {id: 'pfa', label: '(2) セルあたりの P<sub>FA</sub>', unit: '× 10⁻⁶', ans: Z.pfa * 1e6, tol: 0.03, tolType: 'abs', hints: ['式4.18 で 1 ルックの場合は、P<sub>FA</sub> = T<sub>d</sub>·ln 2 ÷ (N<sub>r</sub>·N<sub>f</sub>·T<sub>FR</sub>) である。T<sub>d</sub> = 0.016 秒を代入する。', '分子は 0.016 × 0.693 = 0.01109、分母は 100 × 16 × 6.93 = 11090 である。割り算を行い、10⁻⁶ を単位として答える。']}],
  solve: 'T<sub>FR</sub> = T<sub>AVG</sub>·ln 2 = 10 × 0.693 = <b>6.93 秒</b>。||P<sub>FA</sub> = T<sub>d</sub>·ln 2 ÷ (N<sub>r</sub>·N<sub>f</sub>·T<sub>FR</sub>) = 0.016 × 0.693 ÷ (1600 × 6.93) = <b>1.0×10⁻⁶</b>。||T<sub>FR</sub> に T<sub>AVG</sub>·ln 2 を代入すると ln 2 が消去され、P<sub>FA</sub> = T<sub>d</sub> ÷ (N<sub>r</sub>·N<sub>f</sub>·T<sub>AVG</sub>) = 0.016 ÷ 16000 になる。これは「1 回のドウェルで生じる誤警報の数（セル数 × P<sub>FA</sub>）」が「ドウェル時間 ÷ 平均誤警報間隔」に等しいことを意味する。',
  read: {
    what: '検出の計算は誤警報をどこまで許容するかを決めることから始まる。{{g-threshold|しきい値}}は所定の誤警報確率になるように設定するためである。||仕様に書かれるのは、通常「誤警報は何秒（何分）に 1 回まで」という時間である。一方、式に代入するのは、距離とドップラで区切った [[cellp|1 つのセル]]あたりの確率 P<sub>FA</sub> である。この 2 つを、判定するセル数によって関係づける。||ハンドブックは誤警報時間 T<sub>FR</sub> を Marcum の定義で使っている。これは「その時間内に 1 回以上の誤警報が生じる確率が 0.5」になる時間であり、平均誤警報間隔 T<sub>AVG</sub> の ln 2 倍（約 0.69 倍）である。||答え合わせのあとで、誤警報の間隔とセル数を変えると、P<sub>FA</sub> は何桁も変化する。しかし、[[reqc|必要 S/N]] は P<sub>FA</sub> が 1 桁変化しても 1 dB も変わらない。すなわち、誤警報の要求を 10 倍厳しくしても、探知距離は数 % しか短くならない。',
    eq: '<i>P</i><sub>FA</sub> = <i>T</i><sub>d</sub>·ln 2 ÷ ( <i>N</i><sub>r</sub>·<i>N</i><sub>f</sub>·<i>T</i><sub>FR</sub> )<br><i>T</i><sub>FR</sub> ≈ <i>T</i><sub>AVG</sub>·ln 2',
    sym: '式4.18 でルックが 1 回（m = n = 1）の場合である。<i>T</i><sub>d</sub>：1 回のドウェル時間 [s]。<i>N</i><sub>r</sub>：1 つの IPP（パルス繰り返し周期）で処理する、独立な距離サンプルの数。<i>N</i><sub>f</sub>：ドップラの通過域内の、独立なフィルタの数。<i>T</i><sub>FR</sub>：誤警報時間 [s]。<i>T</i><sub>AVG</sub>：平均誤警報間隔 [s]。',
    cond: '雑音制限の場合（雑音だけが性能を決める領域）に成り立つ。ハンドブックもこの計算は雑音で決まる環境を仮定していると断っている。||また、セル間の雑音が独立であり、すべてのセルを同じしきい値（雑音の平均に対する倍率）で判定していることが前提である。',
    fail: '残留クラッタや妨害があり、背景のレベルがセルごとに異なる場合は成り立たない。この場合はしきい値を背景に合わせて変える {{g-cfar|CFAR}} が必要になり、その分の損失が加わる（入門 第4回 ステップ 7・8）。||複数のルックの結果を照合してから誤警報とする方式では、1 ルックあたりの P<sub>FA</sub> をより大きくできる（式4.18 の一般形、式4.20・4.21。ステップ 5）。',
    mis: '「P<sub>FA</sub> = 10⁻⁶ は 100 万回に 1 回であるから、誤警報はほとんど生じない」という理解は誤りである。この例では 1 秒間に 10 万個のセルを判定しているため、10 秒に 1 回は誤警報が生じる。P<sub>FA</sub> は判定するセル数と組にして初めて意味をもつ。'},
  hosoku: ['例の値（ドウェル 16 ms、距離 100 × ドップラ 16、誤警報は平均 10 秒に 1 回）は説明のために置いた値。P_FA がちょうど 10⁻⁶ になるように選定', '「誤警報がポアソン過程に従うとすると、T_FR の間に 1 回以上生じる確率は 1 − exp(−T_FR/T_AVG) = 0.5」という説明（ハンドブックの記載は T_FR ≈ T_AVG·ln 2 のみ）', '感度の図の必要 S/N は、P_d = 0.9、N_pdi = 1 での値。非変動目標は式4.23、Swerling 1 は式4.25'],
  memo: 'つまずきやすい点は、「誤警報時間」と「平均誤警報間隔」の違い（ln 2 倍）である。仕様書がどちらで書かれているかを確認する習慣を付けさせる。||声かけの例：「セル数が 10 倍になったら、P_FA をどうするか。必要 S/N は何 dB 変わるか」「誤警報を 1 時間に 1 回にしたい。探知距離は何 % 短くなるか」',
  init: {}, ctl: ['ltavg', 'cells'], fixed: [], fixT: ['ドウェル時間 16 ms', '感度の図：検出確率 0.9、1 つの CPI で判定'], plots: [{h: 250}],
  sol: {ltavg: 2},
  draw(P){
    const tavg = Math.pow(10, S.ltavg), pfa = EX.td / (S.cells * tavg), lx = Math.log10(pfa), xs = [], y0 = [], y1 = [];
    for (let l = -11; l <= -2.999; l += 0.1){ const p = Math.pow(10, l); xs.push(l); y0.push(db10(snr423(0.9, p, 1))); y1.push(db10(snr425(0.9, p, 1, 1))); }
    const r0 = db10(snr423(0.9, pfa, 1));
    P[0].set({title: 'セルあたりの P_FA と必要 S/N（検出確率 0.9）', xr: [-11, -3], yr: [8, 26], xl: 'セルあたりの誤警報確率 P_FA', yl: '必要 S/N [dB]', xticks: [-11, -10, -9, -8, -7, -6, -5, -4, -3].map(v => [v, '10' + sup(v)]),
      series: [{name: '非変動目標（式4.23）', color: 's1', x: xs, y: y0, w: 2.2}, {name: 'Swerling 1（式4.25）', color: 's3', x: xs, y: y1, w: 2}],
      vl: [{x: -6, color: 'ref', label: '標準 10⁻⁶', row: 0}], pts: lx >= -11 && lx <= -3 ? [{x: lx, y: r0, color: 's2', r: 6, label: fx(r0, 2) + ' dB'}] : [],
      marks: {cellp: {x0: lx - 0.3, x1: lx + 0.3, t: '現在の P_FA'}, reqc: {t: '1 桁で 1 dB 未満しか変わらない'}}, tipx: v => '10^' + fx(v, 1), tipy: v => fx(v, 2) + ' dB'});
    return {tiles: [{k: 'セルあたりの P_FA', v: sci(pfa, 2), s: 'T_FR = ' + fx(tavg * Math.LN2, 2) + ' 秒'}, {k: '必要 S/N（非変動）', v: fx(r0, 2) + ' <small>dB</small>', s: '標準（10⁻⁶）との差 ' + sg(r0 - Z.s0) + ' dB'}, {k: '探知距離の変化', v: sg((Math.pow(10, -(r0 - Z.s0) / 40) - 1) * 100, 1) + ' <small>%</small>', s: '必要 S/N の差を 40 で割って倍率に換算'}]};
  }});

/* 2 */
STEPS.push({short: '非変動目標', title: '非変動目標 — η を経て必要 S/N を求める', src: '§4.6 Probability of Detection（p.4.46、式4.22・4.23）',
  q: 'P<sub>FA</sub> = 10⁻⁶ とし、目標は{{g-nonfluctuating-target|非変動目標}}（RCS が変動しない目標）とする。1 つの CPI だけで判定する（N<sub>pdi</sub> = 1）。{{g-probability-of-detection|検出確率}} P<sub>d</sub> = 0.9 に必要な S/N を式4.23 で求める。||(1) η はいくらか。||(2) 必要 S/N は何 dB か。',
  ask: [{id: 'eta', label: '(1) η', unit: '', ans: etaOf(0.9, 1e-6), tol: 0.02, tolType: 'abs', hints: ['η は 2 つの項からなる。P<sub>d</sub> > 0.5 であるから sign(0.5 − P<sub>d</sub>) = −1 となり、2 つの項は和になる。1 つ目は √(−0.8·ln[4·P<sub>FA</sub>(1 − P<sub>FA</sub>)]) であり、ln(4×10⁻⁶) ≈ −12.43 である。', '1 つ目 = √(0.8 × 12.43) = √9.943 ≈ 3.153。2 つ目 = √(−0.8·ln[4 × 0.9 × 0.1]) = √(−0.8 × ln 0.36) ≈ 0.904。']},
    {id: 'snr', label: '(2) 必要 S/N', unit: 'dB', ans: Z.s0, tol: 0.15, tolType: 'abs', hints: ['N<sub>pdi</sub> = 1 の場合、式4.23 は SNR = η² + 2η·√(1/2 − 1/4) = η² + η（真数）になる。', 'η² + η = 16.46 + 4.06 = 20.52（真数）。dB への換算は 10·log₁₀(20.52) である。']}],
  solve: 'η = √(−0.8·ln[4×10⁻⁶]) + √(−0.8·ln 0.36) = 3.153 + 0.904 = <b>4.057</b>。||SNR = η²/1 + (2η/1)·√(1/2 − 1/4) = 16.46 + 4.06 = 20.52 倍 → 10·log₁₀(20.52) = <b>13.12 dB</b>。||入門の第15回・第17回で使った「検出に必要な S/N 13 dB」は、この条件（非変動目標、P<sub>d</sub> 0.9、P<sub>FA</sub> 10⁻⁶、1 回の判定）に対応する。厳密に計算すると 13.18 dB（第16回の値）であり、式4.23 との差は 0.06 dB である。',
  read: {
    what: 'P<sub>FA</sub> が決まると、しきい値が決まる。次に求めるのは、目標のエコーがそのしきい値を確率 P<sub>d</sub> で超えるために必要な S/N（{{g-required-snr|必要 S/N}}）である。ここではまず、RCS が変動しない目標（ハンドブックは Marcum の目標と呼ぶ）を扱う。||厳密な P<sub>d</sub> は Marcum の Q 関数という、手計算の困難な関数で表される。ハンドブックは P<sub>d</sub> を求める近似式（式4.22）と、その逆に必要 S/N を求める近似式（式4.23）を示している。式4.23 は電卓で計算できる。||計算は 2 段階で行う。まず η を求める。η は「P<sub>FA</sub> から決まる項」と「P<sub>d</sub> から決まる項」の和（P<sub>d</sub> が 0.5 より大きい場合）であり、しきい値と信号の間隔を、雑音の標準偏差を単位として表した量に相当する{H}。次に、η から S/N を求める。||ここでの S/N は整合フィルタとドップラフィルタを通過したあとの、[[one|1 つの CPI]] についての値である（入門 第16回の「処理後の S/N」）。||感度の図には[[apx|式4.22 の曲線]]と[[ext|厳密な計算]]を重ねて示している。',
    eq: 'SNR<sub>reqd</sub> = η<sup>2</sup>/<i>N</i><sub>pdi</sub> + (2η/<i>N</i><sub>pdi</sub>)·√(<i>N</i><sub>pdi</sub>/2 − 1/4)<br>η = √(−0.8·ln[4<i>P</i><sub>FA</sub>(1−<i>P</i><sub>FA</sub>)])<br>　　− sign(0.5−<i>P</i><sub>d</sub>)·√(−0.8·ln[4<i>P</i><sub>d</sub>(1−<i>P</i><sub>d</sub>)])',
    sym: 'SNR<sub>reqd</sub>：必要 S/N（真数。1 つの CPI あたり）。<i>N</i><sub>pdi</sub>：ノンコヒーレント積分する CPI 数（ここでは 1。ステップ 4）。sign(x)：x が正ならば +1、負ならば −1、0 ならば 0。P<sub>d</sub> = 0.5 の場合、2 つ目の項は 0 になる。ln は自然対数である。',
    cond: '雑音がガウス分布に従い、雑音制限の場合に成り立つ。また、積分する CPI の間で目標の RCS が変化しないことが前提である。||この教材で調べた範囲（P<sub>d</sub> 0.1〜0.99、P<sub>FA</sub> 10⁻⁴〜10⁻⁸、N<sub>pdi</sub> 1〜32）では、式4.23 と厳密な計算の差は −0.19〜+0.23 dB であった。',
    fail: '目標の RCS が変動する場合は成り立たない（ステップ 3。同じ P<sub>d</sub> 0.9 でも、8 dB 多く必要になることがある）。||しきい値を周囲のセルから推定している場合（CFAR）は、推定の変動の分だけ余分な S/N が必要になる。||P<sub>d</sub> を求める式4.22 は、原本に印刷されている形のままでは、厳密な計算から大きく外れる（下の「指導者向けメモ」と、最後のステップの照合表）。',
    mis: '「検出に必要な S/N は 13 dB である」と、定数のように記憶することは危険である。13 dB は非変動目標・P<sub>d</sub> 0.9・P<sub>FA</sub> 10⁻⁶・1 回の判定という条件での値である。条件を明記せずに数値だけを引き継ぐと、後の計算と整合しなくなる。'},
  hosoku: ['η の解釈（「しきい値と信号の間隔を、雑音の標準偏差を単位として表した量」）', '式4.22 は根号の中の定数を「−1/4」とした形で作図。原本には「−1/2」と印刷されているが、その形は式4.23 と整合せず、厳密な計算からも大きく外れる（P_FA = 10⁻⁶、S/N 10 dB で 0.505。厳密な値は 0.248）。図の点線が印刷どおりの形', '厳密な計算は非心カイ二乗分布の級数（入門 第4回と同じ計算）。Marcum の Q 関数の数値積分との一致を確認済み', '「調べた範囲での差」は、この教材の計算による値。ハンドブックの記載は「それなりに正確」という表現のみ'],
  memo: 'つまずきやすい点は、sign の符号（P_d > 0.5 では和、< 0.5 では差）と、真数と dB の取り違え（式4.23 の答えは真数）である。||式4.22 について：原本の印刷では 2 つの根号の中がどちらも「N/2 − 1/2」である。式4.23 を P_d について解くと「N/2 − 1/4」になる。印刷どおりの形では、N = 1・S/N 10 dB・P_FA 10⁻⁶ で 0.505（厳密には 0.248）になり、図の点線で確認できる。断定はできないため、「原本を使うときは式4.23 と照合すること」と伝えるのがよい。||声かけの例：「P_d を 0.5 にすると、η はいくつになるか。必要 S/N はどうか」「P_d 0.9 と 0.99 では、何 dB 違うか」',
  init: {}, ctl: ['pd', 'x'], fixed: [], fixT: ['非変動目標、1 つの CPI で判定（N_pdi = 1）'], plots: [{h: 270}],
  sol: {pd: 0.5},
  draw(P){
    const pfa = Math.pow(10, -S.x), xs = xsDb(0, 20, 0.25), ya = [], ye = [], yp = [], T = thrOf(pfa, 1); for (const d of xs){ const s = lin(d); ya.push(pd422(s, pfa, 1)); ye.push(pdNF(1, s, T)); yp.push(pd422print(s, pfa, 1)); }
    const req = db10(snr423(S.pd, pfa, 1)), ex = snrExact(S.pd, pfa, 1, 0);
    P[0].set({title: 'S/N と検出確率（非変動目標、N_pdi = 1）', xr: [0, 20], yr: [0, 1.05], xl: 'S/N [dB]（1 つの CPI の処理後）', yl: '検出確率 P_d',
      series: [{name: '厳密な計算', color: 's3', x: xs, y: ye, w: 2.4}, {name: '式4.22（−1/4 とした形）', color: 's1', x: xs, y: ya, w: 1.6}, {name: '式4.22（原本の印刷どおり）', color: 'ref', x: xs, y: yp, w: 1.4, dash: [4, 4]}],
      hl: [{y: S.pd, color: 'ref'}], vl: [{x: req, color: 's2', label: '式4.23：' + fx(req, 2) + ' dB', row: 6}], pts: [{x: req, y: S.pd, color: 's2', r: 6}],
      marks: {apx: {t: '近似式（式4.22）'}, ext: {t: '厳密な計算'}, one: {x0: req - 0.6, x1: req + 0.6, t: '必要 S/N'}}, tipx: v => fx(v, 2) + ' dB', tipy: v => fx(v, 3)});
    return {tiles: [{k: '必要 S/N（式4.23）', v: fx(req, 2) + ' <small>dB</small>', s: 'η = ' + fx(etaOf(S.pd, pfa), 3)}, {k: '厳密な計算', v: fx(ex, 2) + ' <small>dB</small>', s: '近似との差 ' + sg(req - ex) + ' dB'}, {k: '標準（P_d 0.9、10⁻⁶）との差', v: sg(req - Z.s0) + ' <small>dB</small>', s: '距離に換算して ' + sg((Math.pow(10, -(req - Z.s0) / 40) - 1) * 100, 1) + '%'}]};
  }});

/* 3 */
STEPS.push({short: '変動目標', title: '変動目標 — 検出確率が高いほど変動損失が大きい', src: '§4.6（p.4.46–4.47、式4.24・4.25）',
  q: 'ステップ 2 と同じ条件（P<sub>FA</sub> = 10⁻⁶、N<sub>pdi</sub> = 1、P<sub>d</sub> = 0.9）で、目標が {{g-swerling-cases|Swerling 1}}（ドウェルごとに、RCS が指数分布に従って変動する）の場合を考える。||自由度 2 のカイ二乗分布では、上側確率は K<sub>m</sub>(x, 2) = exp(−x/2)、逆関数は K<sub>m</sub>⁻¹(p, 2) = −2·ln p になる。||(1) 必要 S/N は何 dB か。||(2) 非変動目標（ステップ 2）より何 dB 多く必要か（{{g-fluctuation-loss|変動損失}}）。',
  ask: [{id: 's1', label: '(1) Swerling 1 の必要 S/N', unit: 'dB', ans: Z.s1, tol: 0.2, tolType: 'abs', hints: ['Swerling 1 は n<sub>e</sub> = 1 である。N<sub>pdi</sub> = 1 の場合、式4.25 は SNR = K<sub>m</sub>⁻¹(P<sub>FA</sub>, 2) ÷ K<sub>m</sub>⁻¹(P<sub>d</sub>, 2) − 1 になる。', 'K<sub>m</sub>⁻¹(10⁻⁶, 2) = −2·ln(10⁻⁶) = 27.63、K<sub>m</sub>⁻¹(0.9, 2) = −2·ln 0.9 = 0.2107 であり、比は 131.1 である。1 を引いて dB に換算する。']},
    {id: 'fl', label: '(2) 変動損失', unit: 'dB', ans: Z.fl, tol: 0.25, tolType: 'abs', hints: ['変動損失 = Swerling 1 の必要 S/N [dB] − 非変動目標の必要 S/N [dB]。', 'ステップ 2 の答えは 13.12 dB である。これを (1) の答えから引く。']}],
  solve: 'SNR = K<sub>m</sub>⁻¹(10⁻⁶, 2) ÷ K<sub>m</sub>⁻¹(0.9, 2) − 1 = 27.63 ÷ 0.2107 − 1 = 130.1 倍 → <b>21.14 dB</b>。||変動損失 = 21.14 − 13.12 = <b>8.02 dB</b>。||この場合、式4.24 は P<sub>d</sub> = P<sub>FA</sub><sup>1/(1+SNR)</sup> と書ける。これは近似ではなく厳密な式である。P<sub>d</sub> = 0.5 で同じ計算をすると 12.77 dB になり、変動損失は 1.6 dB にすぎない。',
  read: {
    what: '実際の目標は姿勢がわずかに変化するだけで RCS が大きく変化する（入門 第10回）。Swerling のモデルは、この RCS 変動を 4 つの型で表す。||Swerling 1 と 3 は、ドウェルの中では RCS が一定で、ドウェルが変わると独立に変化する。2 と 4 は CPI ごとに独立に変化する。1 と 2 は RCS が指数分布（自由度 2 のカイ二乗分布）に従い、3 と 4 は変動の小さい分布（自由度 4）に従う。式の中ではこの違いを n<sub>e</sub> という 1 つの数で表す。||変動目標では RCS が偶然小さい瞬間に観測すると検出できない。高い P<sub>d</sub> を保証するには、RCS が小さい瞬間でもしきい値を超えるだけの、大きな平均 S/N が必要である。このため、[[flc|変動損失]]は P<sub>d</sub> が高いほど大きくなる。Swerling 1 の場合、P<sub>d</sub> 0.5 では 1.6 dB、0.9 では 8 dB、0.99 では 17 dB である。||逆に、P<sub>d</sub> が低い領域（約 0.3 より下）では、変動目標のほうが小さい S/N で検出できる。RCS が偶然大きい瞬間があるためである。図では曲線の[[cross|交点]]でこの関係が入れ替わる。',
    eq: 'SNR = [ ( <i>K</i><sub>m</sub><sup>−1</sup>(<i>P</i><sub>FA</sub>, 2<i>N</i><sub>pdi</sub>) − 2(<i>N</i><sub>pdi</sub> − <i>n</i><sub>e</sub>) )<br>　　÷ <i>K</i><sub>m</sub><sup>−1</sup>(<i>P</i><sub>d</sub>, 2<i>n</i><sub>e</sub>) − 1 ]·<i>n</i><sub>e</sub>/<i>N</i><sub>pdi</sub>',
    sym: '式4.25 である（式4.24 と整合する形。下の「崩れる条件」を参照）。<i>K</i><sub>m</sub>(x, d)：自由度 d のカイ二乗分布で、値が x を超える確率。<i>K</i><sub>m</sub><sup>−1</sup>(p, d)：その逆関数（上側確率が p になる x）。<i>n</i><sub>e</sub>：Swerling 1 は 1、2 は <i>N</i><sub>pdi</sub>、3 は 2、4 は 2·<i>N</i><sub>pdi</sub>。自由度が 2 でない場合は、数表か計算ソフトが必要である。',
    cond: '目標の RCS 変動が Swerling のいずれかの型で表され、ドウェルごと（1・3）または CPI ごと（2・4）に独立に変化する場合に成り立つ。また、雑音制限の場合であることが前提である。||Swerling 1・N<sub>pdi</sub> = 1 では厳密な式と一致する。この教材では P<sub>d</sub> 0.1〜0.99、P<sub>FA</sub> 10⁻⁴〜10⁻⁸、N<sub>pdi</sub> 1〜32 の範囲を調べた。厳密な計算との差は型によって異なる（Swerling 1 で 0〜+0.28 dB、2 で 0.01 dB 未満、3 で −0.11〜+0.34 dB、4 で −0.61〜+0.30 dB）。',
    fail: '目標の RCS 変動が CPI の間で部分的に相関をもつ場合（1 と 2 の中間）は、型を一方に決めると数 dB の差が生じる。||原本の式4.25 は、分子の最初の項が K<sub>m</sub><sup>−1</sup>(P<sub>d</sub>, 2n<sub>e</sub>) と印刷されているように読める。その形では P<sub>FA</sub> が式から消え、式4.24 の逆関数にならない。この教材では式4.24 を SNR について解いた形（上の式）で計算している。',
    mis: '「RCS が変動しても、平均値が同じであれば検出確率も同じである」という理解は誤りである。平均値が同じでも、RCS が小さい瞬間がある分だけ、高い確率での検出は難しくなる。仕様に「P<sub>d</sub> 0.9」と書くか「0.5」と書くかによって、変動目標では必要 S/N が 8 dB、探知距離が 1.6 倍変わる。'},
  hosoku: ['「RCS が偶然小さい瞬間に観測すると検出できない」という説明', 'Swerling 1 の P_d 0.99 での変動損失 17 dB と、「約 0.3 より下では変動目標のほうが有利」は、この教材の計算（式4.23・4.25）による値', '式4.25 の印刷についての注意と、「調べた範囲での差」。厳密な計算は Swerling 2・4 は閉じた式、1・3 は RCS の分布についての数値的な平均', '図は N_pdi = 1 の場合。このとき Swerling 1 と 2、3 と 4 はそれぞれ同じ曲線'],
  memo: 'つまずきやすい点は、K_m⁻¹ という見慣れない記号である。自由度 2 ならば −2·ln p であり、電卓で計算できることを先に示す。||声かけの例：「P_d 0.5 で同じ計算をするとどうなるか。変動損失は何 dB か」「探知距離で表すと、8 dB は何倍か（10^(8/40) ≈ 1.58 倍）」「目標の変動モデルが分からないとき、どちらの型で計算書を書くか。その理由は何か」',
  init: {}, ctl: ['pd', 'x'], fixed: [], fixT: ['1 つの CPI で判定（N_pdi = 1）'], plots: [{h: 250}, {h: 200}],
  sol: {pd: 0.5},
  draw(P){
    const pfa = Math.pow(10, -S.x), y0 = [], y1 = [], y3 = [], f1 = [], f3 = []; for (const p of PDX){ const a = db10(snr423(p, pfa, 1)), b = db10(snr425(p, pfa, 1, 1)), c = db10(snr425(p, pfa, 1, 2)); y0.push(a); y1.push(b); y3.push(c); f1.push(b - a); f3.push(c - a); }
    const a = db10(snr423(S.pd, pfa, 1)), b = db10(snr425(S.pd, pfa, 1, 1)), c = db10(snr425(S.pd, pfa, 1, 2)); let xc = 0.3; for (let i = 1; i < PDX.length; i++) if (f1[i - 1] < 0 && f1[i] >= 0) xc = PDX[i];
    P[0].set({title: '検出確率と必要 S/N（N_pdi = 1）', xr: [0.1, 1], yr: [5, 40], xl: '検出確率 P_d', yl: '必要 S/N [dB]', series: [{name: '非変動（式4.23）', color: 's1', x: PDX, y: y0, w: 2}, {name: 'Swerling 1・2（式4.25）', color: 's2', x: PDX, y: y1, w: 2.2}, {name: 'Swerling 3・4', color: 's3', x: PDX, y: y3, w: 2}],
      vl: [{x: S.pd, color: 'ref'}], pts: [{x: S.pd, y: a, color: 's1', r: 5, label: fx(a, 1), left: true, below: true}, {x: S.pd, y: Math.min(39.5, b), color: 's2', r: 5, label: fx(b, 1), left: true}], marks: {cross: {x0: xc - 0.05, x1: xc + 0.05, t: 'ここより下では変動目標のほうが有利'}}, tipx: v => fx(v, 2), tipy: v => fx(v, 2) + ' dB'});
    P[1].set({title: '変動損失（非変動目標との差）', xr: [0.1, 1], yr: [-4, 20], xl: '検出確率 P_d', yl: '変動損失 [dB]', series: [{name: 'Swerling 1・2', color: 's2', x: PDX, y: f1, w: 2.2}, {name: 'Swerling 3・4', color: 's3', x: PDX, y: f3, w: 2}],
      hl: [{y: 0, color: 'ref', dash: []}], vl: [{x: S.pd, color: 'ref'}], pts: [{x: S.pd, y: Math.min(19.5, b - a), color: 's2', r: 6, label: fx(b - a, 2) + ' dB', left: true}], marks: {flc: {t: 'P_d が高いほど大きい'}}, tipx: v => fx(v, 2), tipy: v => fx(v, 2) + ' dB'});
    return {tiles: [{k: 'Swerling 1 の必要 S/N', v: fx(b, 2) + ' <small>dB</small>', s: '変動損失 ' + sg(b - a) + ' dB'}, {k: 'Swerling 3 の必要 S/N', v: fx(c, 2) + ' <small>dB</small>', s: '変動損失 ' + sg(c - a) + ' dB'}, {k: '非変動目標', v: fx(a, 2) + ' <small>dB</small>'}, {k: '探知距離の比（Swerling 1 ÷ 非変動）', v: fx(Math.pow(10, -(b - a) / 40), 2) + ' <small>倍</small>'}]};
  }});

/* 4 */
const INT = {};
function intCurve(pd, pfa){ const key = pd + '/' + pfa; if (!INT[key]){ const o = []; for (let sw = 0; sw <= 4; sw++) o.push(NS.map(n => db10(snrApprox(pd, pfa, n, sw)))); INT[key] = o; } return INT[key]; }
STEPS.push({short: 'ノンコヒーレント積分', title: 'ノンコヒーレント積分 — N 個を積分しても N 倍の改善には届かない', src: '§4.6（p.4.46–4.47、式4.23・4.25 の N<sub>pdi</sub>）',
  q: '4 つの CPI の出力を、検波後に加算（{{g-npdi|ノンコヒーレント積分}}）してから判定する（N<sub>pdi</sub> = 4）。目標は非変動目標とし、P<sub>FA</sub> = 10⁻⁶、P<sub>d</sub> = 0.9 とする。||(1) 1 つの CPI あたりに必要な S/N は何 dB か。||(2) 「4 個を積分すれば、1 個あたりは 1/4（6.02 dB 少なくて済む）」という理想に何 dB 届かないか（{{g-integration-loss|積分損失}}）。',
  ask: [{id: 's4', label: '(1) 1 つの CPI あたりの必要 S/N', unit: 'dB', ans: Z.s4, tol: 0.15, tolType: 'abs', hints: ['η はステップ 2 と同じ値（4.057）である。式4.23 に N<sub>pdi</sub> = 4 を代入すると、SNR = η²/4 + (2η/4)·√(4/2 − 1/4) になる。', 'η²/4 = 4.116、(2η/4)·√1.75 = 2.029 × 1.323 = 2.684 であり、和は 6.800（真数）である。これを dB に換算する。']},
    {id: 'il', label: '(2) 積分損失', unit: 'dB', ans: Z.il, tol: 0.2, tolType: 'abs', hints: ['実際の改善量 = 1 個のときの必要 S/N（13.12 dB）− 4 個のときの 1 個あたりの必要 S/N。', '改善量は 13.12 − 8.32 = 4.80 dB であり、理想は 10·log₁₀4 = 6.02 dB である。']}],
  solve: 'SNR = η²/4 + (2η/4)·√(4/2 − 1/4) = 4.116 + 2.684 = 6.800 倍 → <b>8.32 dB</b>。||改善量 = 13.12 − 8.32 = 4.80 dB。理想の 6.02 dB との差 = <b>1.22 dB</b>（積分損失）。||コヒーレント積分をすれば（CPI を 4 倍に延ばせば）、6.02 dB の改善がそのまま得られる。ノンコヒーレント積分では、雑音どうしの積の項が残るため、改善量がわずかに小さくなる。',
  read: {
    what: '1 つの CPI では S/N が不足する場合、複数の CPI の出力を{{g-integration|積分}}してから判定する。コヒーレント積分（CPI を延ばす方法）は、目標のドップラ周波数が変化しない時間内でしか使えない。それより長い時間については、検波して位相を捨てたあとの出力を加算する（N<sub>pdi</sub>。入門 第4回 ステップ 4、第15回 ステップ 5）。||非変動目標では N 個を積分しても、1 個あたりの必要 S/N は 1/N までは下がらない。この差が[[ilc|積分損失]]である。積分損失は N = 4 で 1.2 dB、N = 16 で 2.8 dB であり、N とともに増加する。それでも積分すること自体は有利である。||変動目標では事情が異なる。Swerling 2・4（CPI ごとに独立に変動する）では、積分するうちに RCS の小さい瞬間と大きい瞬間が平均化される。ステップ 3 の変動損失が減少するため、[[sw2|N 倍よりも大きい]]改善が得られることがある。Swerling 1・3（ドウェルの中では RCS が一定）では平均化されないため、変動損失はそのまま残る。||CPI ごとに周波数を変えると RCS 変動が独立になり、Swerling 1 の目標を 2 に近づけることができる{H}。',
    eq: 'SNR<sub>reqd</sub> = η<sup>2</sup>/<i>N</i><sub>pdi</sub> + (2η/<i>N</i><sub>pdi</sub>)·√(<i>N</i><sub>pdi</sub>/2 − 1/4)',
    sym: '式4.23（ステップ 2 と同じ式）である。<i>N</i><sub>pdi</sub>：ノンコヒーレント積分する CPI 数。SNR<sub>reqd</sub> は 1 つの CPI あたりの値である。1 項目（η²/N）は N に反比例して低下するが、2 項目は √N に反比例してしか低下しない。このため、N が大きいと 2 項目が支配的になる。変動目標については、式4.25 に同じ N<sub>pdi</sub> を代入する。',
    cond: '積分する CPI の間で雑音が独立であり、目標が非変動目標であるか、Swerling の型のとおりに変動する場合に成り立つ。||厳密な計算との差は、ステップ 2・3 に示した範囲である（N<sub>pdi</sub> 32 まで）。',
    fail: '積分している間に目標がレンジゲートやドップラフィルタをまたいで移動する場合は成り立たない（加算するセルが一致しなくなる）。||目標の RCS 変動が CPI の間で部分的に相関をもつ場合（Swerling 1 と 2 の中間）は、改善量が 2 つの型の中間になる。',
    mis: '「ノンコヒーレント積分にはほとんど効果がない」という理解も「N 個を積分すれば必ず N 倍の改善が得られる」という理解も誤りである。非変動目標では N 倍にわずかに届かず、CPI ごとに変動する目標では N 倍を超えることがある。どちらになるかは、目標の変動モデルで決まる。'},
  hosoku: ['「雑音どうしの積の項が残るため、改善量がわずかに小さくなる」という説明', 'N = 16 での積分損失 2.8 dB は、式4.23 による値', '「CPI ごとに周波数を変えると RCS 変動が独立になる」という説明（入門 第12回の周波数アジリティと同じ事情。§4.6 に記載なし）', '下の図の「N 倍に対する過不足」は、10·log₁₀N −（N = 1 のときの必要 S/N − N 個のときの 1 個あたりの必要 S/N）。正ならば損失'],
  memo: 'つまずきやすい点は、「1 個あたりの S/N」と「積分後の S/N」の区別である。式4.23 が与えるのは前者である。||声かけの例：「N を 4 から 16 にすると、1 個あたりの必要 S/N は何 dB 下がるか。理想は 6 dB である」「Swerling 2 で N = 4 にすると、何 dB の改善になるか。なぜ 6 dB を超えるのか」',
  init: {npdi: 4}, ctl: ['npdi', 'sw', 'pd'], fixed: [], fixT: ['P_FA = 10⁻⁶'], plots: [{h: 240}, {h: 210}],
  sol: {sw: 2},
  draw(P){
    const pfa = 1e-6, C = intCurve(S.pd, pfa), lx = NS.map(n => Math.log2(n)), i = NS.indexOf(S.npdi), col = ['s1', 's2', 's2', 's3', 's3'], ideal = lx.map(l => C[S.sw][0] - 3.0103 * l), xt = NS.map((n, k) => [k, String(n)]);
    P[0].set({title: '積分する CPI 数と 1 つの CPI あたりの必要 S/N（' + SWN[S.sw] + '）', xr: [-0.2, 5.2], yr: [-6, 24], xl: 'ノンコヒーレント積分する CPI 数 N_pdi', yl: '必要 S/N [dB]', xticks: xt,
      series: [{name: SWN[S.sw], color: 's1', x: lx, y: C[S.sw], w: 2.2, mk: 3}, {name: 'N 倍の改善が得られる場合（理想）', color: 'ref', x: lx, y: ideal, dash: [5, 4], w: 1.5}], pts: [{x: lx[i], y: C[S.sw][i], color: 's2', r: 6, label: fx(C[S.sw][i], 2) + ' dB'}], tipx: v => 'N = ' + fx(Math.pow(2, v), 0), tipy: v => fx(v, 2) + ' dB'});
    const ser = [0, 1, 2, 3, 4].map(sw => ({name: sw === 0 ? '非変動' : String(sw), color: col[sw], x: lx, y: lx.map((l, k) => 3.0103 * l - (C[sw][0] - C[sw][k])), w: sw === S.sw ? 2.6 : 1.3, dash: sw === 2 || sw === 4 ? [5, 3] : null}));
    const lossNow = 3.0103 * lx[i] - (C[S.sw][0] - C[S.sw][i]);
    P[1].set({title: 'N 倍に対する過不足（上：損失。下：N 倍を超える改善）。点線は Swerling 2・4', xr: [-0.2, 5.2], yr: [-14, 6], xl: 'ノンコヒーレント積分する CPI 数 N_pdi', yl: '損失 [dB]', xticks: xt, series: ser, hl: [{y: 0, color: 'ref', dash: []}], pts: [{x: lx[i], y: lossNow, color: 's2', r: 6, label: sg(lossNow) + ' dB'}],
      marks: {ilc: {y0: 0, y1: 6, t: '積分損失'}, sw2: {y0: -14, y1: 0, t: 'N 倍を超える改善（RCS 変動の平均化）'}}, tipx: v => 'N = ' + fx(Math.pow(2, v), 0), tipy: v => fx(v, 2) + ' dB'});
    return {tiles: [{k: '1 つの CPI あたりの必要 S/N', v: fx(C[S.sw][i], 2) + ' <small>dB</small>', s: SWN[S.sw] + '、N = ' + S.npdi}, {k: '改善量', v: fx(C[S.sw][0] - C[S.sw][i], 2) + ' <small>dB</small>', s: '理想（N 倍）は ' + fx(3.0103 * lx[i], 2) + ' dB'}, {k: 'N 倍に対する過不足', v: sg(lossNow) + ' <small>dB</small>', s: lossNow >= 0 ? '積分損失' : 'N 倍を超える改善'}]};
  }});

/* 5 */
STEPS.push({short: 'M-of-N', title: 'M-of-N — N 回のうち M 回以上の検出で「目標あり」と判定する', src: '§4.6（p.4.47、式4.26）、p.4.45（式4.20）、第7章 §7.2 Binary Integrator（p.7.7–7.9）',
  q: '1 つのドウェルを 3 回のルックに分け、3 回のうち 2 回以上で検出した場合に「目標あり」と判定する（2-of-3。{{g-m-of-n|M-of-N}}）。ルック間は独立とする。||(1) 1 ルックの検出確率が 0.7 の場合、ドウェルの検出確率はいくらか。||(2) 1 ルックの誤警報確率が 10⁻³ の場合、同じセルで 2 回以上、雑音だけでしきい値を超える確率（ドウェルの誤警報確率）はいくらか。',
  ask: [{id: 'pdw', label: '(1) ドウェルの検出確率', unit: '', ans: Z.pdw, tol: 0.005, tolType: 'abs', hints: ['「ちょうど 2 回」の確率と「3 回とも」の確率を加算する。ちょうど 2 回の場合は、どの 2 回であるかによって 3 通りある。', 'ちょうど 2 回：3 × 0.7² × 0.3 = 0.441。3 回とも：0.7³ = 0.343。']},
    {id: 'pfw', label: '(2) ドウェルの誤警報確率', unit: '× 10⁻⁶', ans: Z.pfw * 1e6, tol: 0.05, tolType: 'abs', hints: ['式は (1) と同じである。確率に 10⁻³ を代入する。', 'ちょうど 2 回：3 × (10⁻³)² × 0.999 = 2.997×10⁻⁶。3 回とも：10⁻⁹。']}],
  solve: 'ドウェルの P<sub>d</sub> = 3 × 0.7² × 0.3 + 0.7³ = 0.441 + 0.343 = <b>0.784</b>。||ドウェルの誤警報確率 = 3 × (10⁻³)² × 0.999 + (10⁻³)³ = <b>3.0×10⁻⁶</b>。||検出確率は 0.7 → 0.78 とわずかに上がるだけであるが、誤警報確率は 10⁻³ → 3×10⁻⁶ と、300 分の 1 になる。このため、1 ルックのしきい値を大幅に下げることができる（1 ルックの誤警報確率を 10⁻³ まで許容できる）。これが M-of-N によって感度が向上する理由である。',
  read: {
    what: 'パルスドップラレーダは、距離のアンビギュイティを解くために、1 つのドウェルの中で PRF を変えながら複数回（ルック）観測し、「N 回のうち M 回以上で検出」を判定の条件とすることが多い（入門 第3回 ステップ 9）。これは入門 第4回 ステップ 5 の 2 値積分と同じ考え方である。||1 ルックの確率を p とすると、N 回のうちちょうど k 回しきい値を超える確率は二項分布で表される。これを k = M から N まで加算した値が、ドウェルの確率である。この式は検出確率にも誤警報確率にも同じように適用できる。||重要なのは誤警報の側である。雑音だけで M 回しきい値を超える確率は、1 回超える確率に比べて何桁も小さい。したがって、ドウェルで許容する誤警報確率が同じであれば、1 ルックのしきい値を下げることができる。式4.20 はこの関係から 1 ルックあたりの P<sub>FA</sub> を求める式である。||[[mopt|下の図]]はドウェルで P<sub>d</sub> 0.9・誤警報確率 10⁻⁶ を満たすために 1 ルックあたりに必要な S/N を、M ごとに比較したものである。M には最適な値がある。',
    eq: '<i>P</i><sub>d,dwell</sub><br>　= Σ<sub>k = m…n</sub> C(<i>n</i>, <i>k</i>)·<i>P</i><sub>d,look</sub><sup><i>k</i></sup>·(1 − <i>P</i><sub>d,look</sub>)<sup><i>n</i>−<i>k</i></sup>',
    sym: '式4.26 である。<i>P</i><sub>d,dwell</sub>：ドウェルの検出確率。<i>P</i><sub>d,look</sub>：1 ルックの検出確率。<i>n</i>：ルック数。<i>m</i>：必要な検出数。C(<i>n</i>, <i>k</i>) = <i>n</i>! ÷ (<i>k</i>!·(<i>n</i>−<i>k</i>)!)：n 回のうち k 回を選ぶ組合せの数。原本は二項係数を上に k、下に n と書いている（p.4.44 に定義がある）。',
    cond: 'ルック間の検出が独立である場合に成り立つ。雑音はルックごとに独立である。目標については、非変動目標であるか、ルックごとに独立に変動する（Swerling 2・4 に相当する）ことが前提である。',
    fail: '目標の RCS がドウェルの中で変化しない場合（Swerling 1・3）は成り立たない。RCS が小さい瞬間に当たると、どのルックでも検出できないため、ルック間が独立でなくなる。この場合、ドウェルの P<sub>d</sub> は RCS の分布について平均して求める必要があり、式4.26 に 1 ルックの平均の P<sub>d</sub> を代入した値とは異なる{H}。||PRF によって、目標がエクリプシングやブラインド速度に入るルックがある場合も成り立たない（ルックごとに P<sub>d</sub> が異なる）。',
    mis: '「2 回もしきい値を超える必要があるため、M-of-N は感度の面で不利である」という理解は誤りである。同じ誤警報確率で比較すれば、1 ルックのしきい値を下げられる分だけ有利になる。ただし、振幅を加算する方法（ステップ 4）にはわずかに及ばない。'},
  hosoku: ['「Swerling 1・3 では、ルック間が独立にならない」という注意（§4.6 に記載なし。一般的な事情）', '下の図の計算：ドウェルの確率から、式4.26 を逆に解いて 1 ルックの確率を求め、式4.23（非変動目標、N_pdi = 1）で 1 ルックあたりの必要 S/N を算出', '第7章の 2 値積分（入門 第4回 ステップ 5）との対応。式4.20 は距離だけで照合する場合の式であり、ドップラの扱いはここでは省略'],
  memo: 'つまずきやすい点は、「ちょうど k 回」の数え落とし（3 回ともの場合を忘れる、組合せの数を掛け忘れる）である。||声かけの例：「3-of-3 にすると、誤警報確率はどうなるか。検出確率はどうか」「N = 8 のとき、最適な M はいくつか（図で 5）」「1-of-N は何をしていることになるか」',
  init: {m: 2, n: 3, pl: 0.7}, ctl: ['n', 'm', 'pl'], fixed: [], fixT: ['下の図：ドウェルで P_d 0.9、誤警報確率 10⁻⁶。非変動目標'], plots: [{h: 220}, {h: 220}],
  sol: {n: 8, m: 5},
  draw(P){
    const n = S.n, m = Math.min(S.m, n), xs = xsDb(0, 1, 0.01), ys = xs.map(p => mOfN(m, n, p)), pdw = mOfN(m, n, S.pl), ms = [], rq = [], single = db10(snr423(0.9, 1e-6, 1)); let best = 1;
    for (let k = 1; k <= n; k++){ ms.push(k); rq.push(db10(snr423(mOfNinv(k, n, 0.9), mOfNinv(k, n, 1e-6), 1))); if (rq[k - 1] < rq[best - 1]) best = k; }
    P[0].set({title: '1 ルックの確率とドウェルの確率（' + m + '-of-' + n + '）', xr: [0, 1], yr: [0, 1.05], xl: '1 ルックの確率', yl: 'ドウェルの確率', series: [{name: m + '-of-' + n, color: 's1', x: xs, y: ys, w: 2.2}, {name: '1 回だけの判定', color: 'ref', x: [0, 1], y: [0, 1], dash: [5, 4], w: 1.3}], pts: [{x: S.pl, y: pdw, color: 's2', r: 6, label: fx(pdw, 3)}], tipx: v => fx(v, 2), tipy: v => fx(v, 3)});
    P[1].set({title: 'M の選び方と 1 ルックあたりの必要 S/N（N = ' + n + '）', xr: [0.5, n + 0.5], yr: [Math.floor(Math.min(...rq) - 1.5), Math.ceil(Math.max(...rq, single) + 1)], xl: '必要な検出数 M', yl: '必要 S/N [dB]', xticks: ms.map(k => [k, String(k)]), series: [{name: '1 ルックあたりの必要 S/N', color: 's1', x: ms, y: rq, w: 2, mk: 3.5}],
      hl: [{y: single, label: '1 ルックだけで判定：' + fx(single, 2) + ' dB', color: 'ref', left: true}], pts: [{x: m, y: rq[m - 1], color: 's2', r: 6, label: fx(rq[m - 1], 2) + ' dB'}], marks: {mopt: {x0: best - 0.4, x1: best + 0.4, t: '最適な M = ' + best}}, tipx: v => 'M = ' + fx(v, 0), tipy: v => fx(v, 2) + ' dB'});
    return {tiles: [{k: 'ドウェルの確率', v: fx(pdw, 3), s: '1 ルック ' + fx(S.pl, 2) + ' の場合'}, {k: '1 ルックに許容できる誤警報確率', v: sci(mOfNinv(m, n, 1e-6), 1), s: 'ドウェルで 10⁻⁶ にする場合'}, {k: '1 ルックあたりの必要 S/N', v: fx(rq[m - 1], 2) + ' <small>dB</small>', s: '最適な M は ' + best + '（' + fx(rq[best - 1], 2) + ' dB）'}]};
  }});

/* 6 */
function lossHtml(){
  let h = '<h3>損失の表（例。値は説明用）　' + H + '</h3><div class="tw"><table class="t"><tr><th>項目</th><th>値 [dB]</th><th>損失がかかる対象</th></tr>';
  for (const r of Z.lt.rows) h += '<tr><td>' + r.k + '</td><td>' + (r.k.indexOf('エクリプシング') === 0 ? '（式4.17 で計算）' : fx(r.db, 1)) + '</td><td>' + (r.tgt ? '目標のみ' : '目標とクラッタの両方') + '</td></tr>';
  h += '</table></div><h3>記号の対応（§4.6 と入門 第15回の式1.5）</h3><div class="tw"><table class="t"><tr><th>§4.6（式4.15・4.16）</th><th>入門 第15回（式1.5）</th><th>対応</th></tr>' +
    '<tr><td>SNR（1 つの CPI の処理後の値）</td><td>S/N にコヒーレント積分 n（E<sub>i</sub> = 1）を含めた値</td><td>入門 第16回の「処理後の S/N」</td></tr>' +
    '<tr><td>R<sub>o</sub></td><td>(S/N)<sub>1</sub> = 1 として解いた距離</td><td>S/N が 1 になる距離</td></tr>' +
    '<tr><td>P<sub>av</sub>、σ<sub>T</sub></td><td>P<sub>av</sub>、σ</td><td>同じ</td></tr>' +
    '<tr><td>G<sub>T</sub>·G<sub>R</sub>·λ² ÷ (4π)</td><td>G·A<sub>e</sub></td><td>G = 4π·A<sub>e</sub>/λ²（送受で同じアンテナ）</td></tr>' +
    '<tr><td>k·T<sub>s</sub>（T<sub>s</sub>：システム雑音温度）</td><td>k·T<sub>0</sub>·F<sub>n</sub></td><td>T<sub>s</sub> = T<sub>0</sub>·F<sub>n</sub> と仮定 ' + H + '</td></tr>' +
    '<tr><td>B<sub>n</sub>（ドップラフィルタの帯域幅）</td><td>f<sub>p</sub> ÷ n</td><td>CPI の長さ（n/f<sub>p</sub>）の逆数と仮定 ' + H + '</td></tr>' +
    '<tr><td>L<sub>T</sub>（目標にかかる損失）</td><td>L<sub>s</sub></td><td>§4.6 では伝搬の影響も損失に含める（式1.5 の F⁴ に相当）</td></tr>' +
    '<tr><td>N<sub>pdi</sub></td><td>ノンコヒーレント積分するパルス数（ステップ 5）</td><td>§4.6 では積分の単位が CPI</td></tr></table></div>';
  return h;
}
const ECL = {};
function eclCurves(N){ if (!ECL[N]){ const xs = xsDb(6, 30, 0.5), T = thrOf(1e-6, 1), y0 = [], y1 = [], y2 = [], a = db10(eclApprox(N)); for (const d of xs){ y0.push(pdNF(1, lin(d), T)); y1.push(eclPd(d, 1e-6, N)); y2.push(pdNF(1, lin(d - a), T)); } ECL[N] = {xs, y0, y1, y2, a}; } return ECL[N]; }
const ECLL = {};
const eclLossC = (pd, N) => { const k = pd + '/' + N; if (ECLL[k] === undefined) ECLL[k] = eclLoss(pd, 1e-6, N); return ECLL[k]; };
STEPS.push({short: '損失の積算', title: '損失の積算 — 1 項目ずつ dB で加算して距離に換算する', src: '§4.6 Radar Range Equation・Losses（p.4.39–4.44、式4.15〜4.17、図4.20・4.21）、式4.2 の記号（p.4.16）',
  q: '読み物の「損失の表」の 14 項目のうち、13 項目の値は与えられており、その和は 10.3 dB である。残りの「{{g-eclipsing|エクリプシング}}とレンジゲートの{{g-straddle-loss|ストラドル}}」を式4.17 で求める。IPP（パルス繰り返し周期）の中のレンジゲートは N = 10 個である。||(1) エクリプシングとストラドルの損失は何 dB か。||(2) 損失の合計 L<sub>T</sub> は何 dB か。||(3) 損失を含めない場合の R<sub>o</sub> は 449.5 km である。非変動目標を P<sub>d</sub> 0.9 で検出できる距離（必要 S/N は 13.12 dB）は何 km か。',
  ask: [{id: 'ecl', label: '(1) エクリプシングとストラドル', unit: 'dB', ans: db10(eclApprox(EX.ngate)), tol: 0.1, tolType: 'abs', hints: ['式4.17：損失 = 12N ÷ (7N − 6)（真数）。N = 10 を代入する。', '120 ÷ 64 = 1.875 倍。dB への換算は 10·log₁₀(1.875) である。']},
    {id: 'lt', label: '(2) 損失の合計 L<sub>T</sub>', unit: 'dB', ans: Z.lt.tot, tol: 0.1, tolType: 'abs', hints: ['dB で表した損失は、加算によって合計できる。', '10.3 + 2.73 を計算する。']},
    {id: 'r0', label: '(3) 探知距離（1 回の P<sub>d</sub> 0.9）', unit: 'km', ans: Z.r0 / 1000, tol: 0.02, tolType: 'rel', hints: ['S/N = (R<sub>o</sub>/R)⁴ であるから、dB の値を 40 で割ると距離の倍率が得られる。損失と必要 S/N を合わせた dB の分だけ、距離は R<sub>o</sub>（損失なし）より短くなる。', 'L<sub>T</sub> + 13.12 = 26.15 dB であり、10^(−26.15/40) = 0.2219 である。これを 449.5 km に掛ける。']}],
  solve: 'エクリプシングとストラドル = 12 × 10 ÷ (7 × 10 − 6) = 1.875 倍 → <b>2.73 dB</b>。||L<sub>T</sub> = 10.3 + 2.73 = <b>13.03 dB</b>。||損失を含めた R<sub>o</sub> = 449.5 × 10^(−13.03/40) = 212.3 km。探知距離 = 212.3 × 10^(−13.12/40) = <b>99.8 km</b>（まとめて 449.5 × 10^(−26.15/40) としても同じ）。||Swerling 1 の目標では必要 S/N が 21.14 dB であるから、探知距離は 212.3 × 10^(−21.14/40) = 62.9 km になる。',
  read: {
    what: 'ここまでで必要 S/N が求められた。次に求めるのは、実際に得られる S/N である。ハンドブックは S/N が 1 になる距離 {{g-ro|R<sub>o</sub>}} を先に求め、S/N = (R<sub>o</sub>/R)⁴ と表している。必要 S/N を代入して R について解くと、探知距離が得られる。||R<sub>o</sub> の式（式4.16）は、入門 第15回の式1.5 と同じ内容を、パルスドップラレーダで用いられる記号で書いたものである。記号の対応は下の表にまとめた。例のレーダは第15回の基準のレーダであり、損失を含めなければ、R<sub>o</sub> は第15回の式で計算した値と一致する。||損失は 1 項目ずつ dB で表して加算する。ハンドブックは 14 程度の項目を挙げ、そのうちどれが「{{g-target-losses|目標だけにかかる}}」かを区別している。クラッタの計算には、目標だけにかかる損失を含めないためである。||[[eclc|エクリプシングとストラドル]]の損失は、ほかの損失と性質が異なる。目標の遅延時間によって出力が 0 から最大まで変化するため、「平均で何 dB」と 1 つの数値で表せるのは、P<sub>d</sub> が 0.5 に近い場合に限られる。P<sub>d</sub> が高い場合は出力が小さくなる遅延時間の影響が大きくなり、損失は平均の値を大きく上回る。この関係は図で確認できる。',
    eq: 'SNR = (<i>R</i><sub>o</sub>/<i>R</i>)<sup>4</sup><br><i>R</i><sub>o</sub> = [ <i>P</i><sub>av</sub>·<i>G</i><sub>T</sub>·<i>G</i><sub>R</sub>·λ<sup>2</sup>·σ<sub>T</sub><br>　　÷ ( (4π)<sup>3</sup>·<i>k</i>·<i>T</i><sub>s</sub>·<i>B</i><sub>n</sub>·<i>L</i><sub>T</sub> ) ]<sup>1/4</sup>',
    sym: '式4.15・4.16 である。<i>R</i><sub>o</sub>：S/N が 1 になる距離 [m]。<i>P</i><sub>av</sub>：平均送信電力 [W]。<i>G</i><sub>T</sub>・<i>G</i><sub>R</sub>：送信利得・受信利得。λ：波長 [m]。σ<sub>T</sub>：目標のレーダ断面積 [m²]。<i>k</i>：ボルツマン定数。<i>T</i><sub>s</sub>：システム雑音温度 [K]。<i>B</i><sub>n</sub>：ドップラフィルタの帯域幅 [Hz]。<i>L</i><sub>T</sub>：目標にかかる損失（真数）。',
    tbl: null,
    cond: '目標がクラッタのないドップラ領域にあり、雑音制限の場合に成り立つ。||また、損失の項目が互いに独立であり、同じ損失を 2 回計上していないことが前提である。ハンドブックはすべての損失を計上すること、ただし重複して計上しないことに注意を促している（たとえば、受信系の損失を雑音指数に含めた場合は、損失の表には入れない）。',
    fail: '目標がサイドローブクラッタの領域にある場合は、R<sub>o</sub> を「信号がクラッタ + 雑音と等しくなる距離」と読み替える必要がある（p.4.48）。||式4.17 を高い P<sub>d</sub> に適用する場合も成り立たない。式4.17 はゲートの重なりがなく、パルス圧縮のない矩形パルスを仮定した、P<sub>d</sub> 50% 付近だけの近似である。',
    mis: '「損失は合計の dB だけが分かればよい」という理解は誤りである。どの損失が目標だけにかかるか、どの損失が P<sub>d</sub> によって変わるかによって、計算の進め方が変わる。計算書には合計ではなく 1 項目ずつ記載する。'},
  hosoku: ['損失の表の値（1 項目ずつ）は説明のために置いた値。項目の名称と目標だけにかかるかどうかの区別はハンドブックのとおり', 'k·T_s = k·T_0·F_n、B_n = f_p/n と置いて、式1.5 と対応づけたこと。記号の定義（式4.2 の下、p.4.16）の記載は T_s は「システム雑音温度」、B_n は「ドップラフィルタの帯域幅」のみ', '例のレーダは入門 第15回の基準のレーダ（平均 1 kW、有効開口面積 1.6 m²、波長 10 cm、雑音指数 3 dB）を 16 パルス（CPI 16 ms）で使うとした設定。エクリプシングの計算では、デューティ比 10%（N = 10）と仮定', '下の図（図4.21 に相当する図）は、p.4.41 の 4 段階の手順を、厳密な P_d の曲線で計算した結果。ゲートの重なりなし、最初のゲートは送信中のため受信できないと仮定'],
  memo: 'つまずきやすい点は、dB を 40 で割ること（距離は 4 乗根）と、損失なしの R_o と損失を含めた R_o の区別である。||声かけの例：「損失を 1 dB 減らすと、距離は何 % 延びるか（約 6%）」「この表でクラッタの計算に含めない項目はどれか。その合計は何 dB か」「P_d 0.9 のとき、エクリプシングの損失は式4.17 より何 dB 大きいか」',
  init: {ng: 10}, ctl: ['pd', 'ng', 'ladj'], fixed: [], fixT: FIXE.concat(['下の図：非変動目標、P_FA = 10⁻⁶']), plots: [{h: 250}],
  sol: {pd: 0.5},
  draw(P){
    const E = eclCurves(S.ng), le = eclLossC(S.pd, S.ng), lt = Z.lt.tot - db10(eclApprox(EX.ngate)) + E.a + S.ladj, ro = roOf(Object.assign({}, EX, {lt})), r = ro * Math.pow(10, -Z.s0 / 40) * 1, req = snrExact(S.pd, 1e-6, 1, 0);
    P[0].set({title: 'エクリプシングとストラドル：損失を含めない S/N と検出確率（N = ' + S.ng + ' ゲート）', xr: [6, 30], yr: [0, 1.05], xl: '損失を含めない場合の S/N [dB]', yl: '検出確率 P_d',
      series: [{name: '損失なし', color: 's1', x: E.xs, y: E.y0, w: 2}, {name: '遅延時間について平均（4 段階の手順）', color: 's2', x: E.xs, y: E.y1, w: 2.4}, {name: '式4.17 の分だけ移動した曲線', color: 'ref', x: E.xs, y: E.y2, dash: [5, 4], w: 1.5}],
      hl: [{y: S.pd, color: 'ref'}], pts: [{x: req, y: S.pd, color: 's1', r: 5}, {x: Math.min(30, req + le), y: S.pd, color: 's2', r: 6, label: '損失 ' + fx(le, 1) + ' dB', below: true}], marks: {eclc: {y0: S.pd - 0.04, y1: S.pd + 0.04, t: '同じ P_d での横方向の差が損失'}}, tipx: v => fx(v, 1) + ' dB', tipy: v => fx(v, 3)});
    return {tiles: [{k: 'エクリプシングとストラドル（式4.17）', v: fx(E.a, 2) + ' <small>dB</small>', s: 'N = ' + S.ng + '。P_d に依存しない'}, {k: '同じ損失（4 段階の手順）', v: fx(le, 2) + ' <small>dB</small>', s: 'P_d ' + fx(S.pd, 2) + ' の場合。式4.17 との差 ' + sg(le - E.a, 1) + ' dB'}, {k: '損失の合計 L_T', v: fx(lt, 2) + ' <small>dB</small>', s: '式4.17 を使った場合。R_o = ' + kmT(ro)}, {k: '探知距離（1 回の P_d 0.9）', v: kmT(r), s: '非変動目標。Swerling 1 では ' + kmT(ro * Math.pow(10, -Z.s1 / 40))}]};
  }});
STEPS[STEPS.length - 1].read.tbl = lossHtml();

/* 7 */
STEPS.push({short: '累積 (1) 考え方', title: '累積検出確率 (1) — 「1 回以上検出する」確率は「すべて見逃す」確率の余事象', src: '§4.6（p.4.47–4.48、式4.27、図4.22）',
  q: 'まず、確率の考え方だけを確認する。走査（フレーム）ごとの検出は独立とする。||(1) 1 回の走査の P<sub>d</sub> が毎回 0.3 の場合、5 回の走査のうち 1 回以上検出する確率はいくらか。||(2) 目標が接近し、1 回の走査の P<sub>d</sub> が 0.1、0.2、0.3 と上がっていく。この 3 回のうち 1 回以上検出する確率はいくらか。',
  ask: [{id: 'c5', label: '(1) 5 回のうち 1 回以上', unit: '', ans: Z.c5, tol: 0.005, tolType: 'abs', hints: ['「1 回以上検出する」= 1 −「5 回とも見逃す」である。1 回の走査で見逃す確率は 1 − 0.3 = 0.7 である。', '5 回とも見逃す確率 = 0.7⁵ = 0.168 である。']},
    {id: 'c3', label: '(2) 3 回のうち 1 回以上', unit: '', ans: Z.c3, tol: 0.005, tolType: 'abs', hints: ['式4.27 の 1 行目（積の形）は 1 − (1 − 0.1)(1 − 0.2)(1 − 0.3) である。', '0.9 × 0.8 × 0.7 = 0.504 である。']}],
  solve: '(1) 1 − 0.7⁵ = 1 − 0.168 = <b>0.832</b>。1 回ごとの確率は 0.3 であっても、5 回あれば 0.83 になる。||(2) 1 − 0.9 × 0.8 × 0.7 = 1 − 0.504 = <b>0.496</b>。||漸化式でも同じ結果になる。1 回目まで：0.1、2 回目まで：0.1 + 0.2 × (1 − 0.1) = 0.28、3 回目まで：0.28 + 0.3 × (1 − 0.28) = 0.496 となる。すなわち、「それまでに検出できていなかった場合（1 − 前回までの累積）に、今回検出する」確率を順に加算していく。',
  read: {
    what: '捜索の性能は「接近する目標をある距離までに 1 回以上検出する確率」で表すことが多い。これが{{g-cumulative-pd|累積検出確率}} P<sub>d,cum</sub> である。レーダは走査のたびに目標を照射するため、検出の機会は 1 回ではない。||「1 回以上検出する」確率は「すべて見逃す」確率を 1 から引いた値である。くじを何回か引いて、1 回でも当たる確率と同じ考え方である。走査ごとの P<sub>d</sub> が変化しても、「すべて見逃す」確率は各回の「見逃す」確率の積で表される。これが式4.27 の 1 行目である。||2 行目は同じ内容を、走査を 1 回加えるごとに更新する形（漸化式）で表したものである。3 回分を両方の形で計算した表を下に示す。||上の図は[[ssc|1 回の走査の P<sub>d</sub>]]（{{g-single-scan-pd|単一走査の検出確率}}）と[[cumc|累積の P<sub>d</sub>]] を距離に対して示したものである（ハンドブックの図4.22 に相当する図）。累積の曲線は 1 回の曲線よりはるかに遠い距離で立ち上がる。',
    eq: '<i>P</i><sub>d,cum</sub>[<i>k</i>] = 1 − Π<sub><i>i</i> = 1…<i>k</i></sub> ( 1 − <i>P</i><sub>d,ss</sub>[<i>i</i>] )<br>　　　　　= <i>P</i><sub>d,cum</sub>[<i>k</i>−1] + <i>P</i><sub>d,ss</sub>[<i>k</i>]·( 1 − <i>P</i><sub>d,cum</sub>[<i>k</i>−1] )',
    sym: '式4.27 である。<i>P</i><sub>d,cum</sub>[<i>k</i>]：k 回目の走査までの累積検出確率。<i>P</i><sub>d,ss</sub>[<i>i</i>]：i 回目の走査での 1 回の検出確率。Π は積の記号である。原本の 2 行目は最後が (1 − P<sub>d,cum</sub>[k]) と印刷されているように読めるが、1 行目と整合するのは [k−1] である。',
    tbl: null,
    cond: '目標が接近する場合に成り立つ（累積検出確率は接近する目標についてだけ定義される）。||走査ごとの検出が独立であることが前提である。雑音は走査ごとに独立である。目標の RCS 変動も、走査ごとに独立である必要がある（Swerling 1 を「走査ごとに独立」として使うことはこの前提に当たる）。||加算を始めるのは、1 回の P<sub>d</sub> が約 5% になる距離からである（ハンドブックの決め方）。',
    fail: '目標の RCS が多数の走査にわたってほとんど変化しない場合は成り立たない。RCS の小さい姿勢のまま接近する目標は、どの走査でも見逃しやすく、累積の P<sub>d</sub> は独立として計算した値より低くなる。||離隔する目標や、視線に直交して飛行する目標には適用できない。「ある距離までに」という表現が成り立たないためである。',
    mis: '「1 回の P<sub>d</sub> が 0.9 になる距離」と「累積の P<sub>d</sub> が 0.9 になる距離」は別の量である。この例では 63 km と 119 km であり、2 倍近く異なる。仕様書の「探知距離」がどちらを指すのかを、数値を見る前に確認する必要がある。'},
  hosoku: ['くじのたとえ', '上の図の条件：例のレーダ（R_o = 212.3 km）、Swerling 1（走査ごとに独立に変動）、P_FA = 10⁻⁶、N_pdi = 1。1 回の P_d は式4.24（この場合は厳密な式）。目標が接近する距離はスライダーで設定', '「よくある誤解」の 63 km と 119 km は、1 回の走査で 2.4 km 接近する場合（接近速度 600 m/s、フレーム時間 4 秒）。最初の走査の位置を一様に分布させて平均した値', '式4.27 の 2 行目の印刷についての注意'],
  memo: 'つまずきやすい点は、確率を単純に加算してしまうことである（0.1 + 0.2 + 0.3 = 0.6 としてしまう）。これは「両方で検出する場合」を 2 回数えている。||声かけの例：「1 回の P_d が 0.5 なら、何回で累積 0.9 を超えるか（4 回）」「走査の間隔を半分にすると、累積の曲線はどう変わるか」「仕様書に『探知距離 100 km』とだけ書かれていたら、何を確認するか」',
  init: {dr: 10}, ctl: ['dr'], fixed: [], fixT: FIXE.concat(['R_o = 212.3 km、Swerling 1、P_FA = 10⁻⁶']), plots: [{h: 270}],
  sol: {dr: 4},
  draw(P){
    const c = scanCurve(Z.ro, 1e-6, 1, 1, S.dr * 1000, 180e3, 30e3), xs = c.R.map(v => v / 1000), r1 = Z.r1 / 1000, rc = rCum(Z.ro, 1e-6, 1, 1, S.dr * 1000, 0.9) / 1000;
    P[0].set({title: '距離と検出確率（1 回の走査と累積）', xr: [30, 180], yr: [0, 1.05], xl: '目標距離 [km]（目標は右から左へ接近する）', yl: '検出確率',
      series: [{name: '1 回の走査', color: 's1', x: xs, y: c.ps, w: 2, mk: 2.5}, {name: '累積', color: 's2', x: xs, y: c.cu, w: 2.2, mk: 2.5}], hl: [{y: 0.9, color: 'ref'}, {y: 0.05, color: 'ref', label: '5%：ここから加算を開始', left: true}],
      vl: [{x: r1, color: 's1', label: '1 回で 0.9：' + fx(r1, 0) + ' km', row: 1}, {x: rc, color: 's2', label: '累積で 0.9：' + fx(rc, 0) + ' km', row: 3}], marks: {ssc: {t: '1 回の走査の P_d'}, cumc: {t: '累積の P_d'}}, tipx: v => fx(v, 0) + ' km', tipy: v => fx(v, 3)});
    return {tiles: [{k: '1 回の P_d が 0.9 になる距離', v: fx(r1, 1) + ' <small>km</small>'}, {k: '累積の P_d が 0.9 になる距離', v: fx(rc, 1) + ' <small>km</small>', s: '1 回の走査で ' + S.dr + ' km 接近する場合'}, {k: '2 つの距離の比', v: fx(rc / r1, 2) + ' <small>倍</small>'}]};
  }});
STEPS[STEPS.length - 1].read.tbl = (() => { const ps = [0.1, 0.2, 0.3]; let q = 1, c = 0, h = '<h3>式4.27 の 2 つの形（3 回分）</h3><div class="tw"><table class="t"><tr><th>走査</th><th>1 回の P<sub>d</sub></th><th>積の形：1 − Π(1 − P<sub>d</sub>)</th><th>漸化式：前回まで + P<sub>d</sub>·(1 − 前回まで)</th></tr>'; ps.forEach((p, i) => { const prev = c; q *= 1 - p; c = prev + p * (1 - prev); h += '<tr><td>' + (i + 1) + ' 回目</td><td>' + fx(p, 1) + '</td><td>1 − ' + ps.slice(0, i + 1).map(v => fx(1 - v, 1)).join(' × ') + ' = ' + fx(1 - q, 3) + '</td><td>' + fx(prev, 3) + ' + ' + fx(p, 1) + ' × ' + fx(1 - prev, 3) + ' = ' + fx(c, 3) + '</td></tr>'; }); return h + '</table></div>'; })();

/* 8 */
STEPS.push({short: '累積 (2) フレーム時間', title: '累積検出確率 (2) — フレーム時間には最適な長さがある', src: '§4.6（p.4.47、式4.27 とその説明）、式4.15・4.24',
  q: 'Swerling 1 の目標が直線上を接近する。レーダは目標が 120 km、110 km、100 km にあるときに 1 回ずつ照射した（それ以前には照射していないとする）。R<sub>o</sub> = 212.3 km、P<sub>FA</sub> = 10⁻⁶、N<sub>pdi</sub> = 1 とする。この条件では P<sub>d</sub> = P<sub>FA</sub><sup>1/(1+SNR)</sup> と書ける（ステップ 3）。||(1) 100 km での 1 回の P<sub>d</sub> はいくらか。||(2) 100 km までに 1 回以上検出する確率（累積の P<sub>d</sub>）はいくらか。',
  ask: [{id: 'p100', label: '(1) 100 km での 1 回の P<sub>d</sub>', unit: '', ans: Z.ps[2], tol: 0.01, tolType: 'abs', hints: ['S/N = (R<sub>o</sub>/R)⁴ = (212.3 ÷ 100)⁴ であり、P<sub>d</sub> = exp( ln(10⁻⁶) ÷ (1 + SNR) ) である。ln(10⁻⁶) = −13.82 を使う。', 'S/N = 20.31 倍であり、P<sub>d</sub> = exp(−13.82 ÷ 21.31) = exp(−0.648) である。']},
    {id: 'cum', label: '(2) 100 km までの累積の P<sub>d</sub>', unit: '', ans: Z.cum[2], tol: 0.01, tolType: 'abs', hints: ['120 km と 110 km の P<sub>d</sub> も同じ式で求める。S/N は 9.80 倍と 13.88 倍である。', '1 回の P<sub>d</sub> は 0.278、0.395、0.523 である。累積 = 1 − (1 − 0.278)(1 − 0.395)(1 − 0.523)。']}],
  solve: '100 km：S/N = (212.3/100)⁴ = 20.31 倍。P<sub>d</sub> = exp(−13.82 ÷ 21.31) = <b>0.523</b>。||120 km：S/N = 9.80、P<sub>d</sub> = 0.278。110 km：S/N = 13.88、P<sub>d</sub> = 0.395。||累積 = 1 − 0.722 × 0.605 × 0.477 = <b>0.792</b>。||1 回の P<sub>d</sub> は 0.52 であっても、その手前の 2 回を合わせると、100 km までに 0.79 の確率で検出できている。実際にはより遠い距離から照射しているため、累積の値はさらに高くなる。',
  read: {
    what: '累積検出確率は走査の間隔（{{g-frame-time|フレーム時間}}）によって変化する。ハンドブックはフレーム時間には最適な長さがあると述べている。||フレーム時間を短くすると、目標があまり接近しないうちに何回も照射できる。しかし、同じ時間内に多くの方向を捜索するため、1 つの方向に配分されるエネルギーが減少し、1 回の P<sub>d</sub> が低下する。||フレーム時間を長くすると、1 回の P<sub>d</sub> は上がる。しかし、次に照射するまでに目標が大きく接近するため、検出の機会が減少し、累積の効果が小さくなる。||下の図はフレーム時間を変えた場合の[[rcc|累積の P<sub>d</sub> が 0.9 になる距離]]を示す。曲線は上に凸の形になり、[[best|最大点]]がある。[[r1c|1 回の P<sub>d</sub> が 0.9 になる距離]]は、フレーム時間を延ばすほど長くなる。ただし、これはその距離まで接近されて初めて高い確率で検出できることを意味する。||この回の例では最大点はフレーム時間 40 秒程度にあり、曲線の変化は緩やかである。10〜100 秒の範囲では、距離は 1 割程度しか変わらない。実際のフレーム時間は、追尾の更新など、ほかの要求と合わせて決定される{H}。',
    eq: 'SNR = (<i>R</i><sub>o</sub>/<i>R</i>)<sup>4</sup>　　<i>R</i><sub>o</sub><sup>4</sup> ∝ <i>T</i><sub>F</sub><br>走査の間に接近する距離 = <i>v</i>·<i>T</i><sub>F</sub>',
    sym: '<i>T</i><sub>F</sub>：フレーム時間 [s]。<i>v</i>：目標の接近速度 [m/s]。∝ は「比例する」ことを表す。平均電力と捜索範囲が同じであれば、1 つの方向に配分されるエネルギーは <i>T</i><sub>F</sub> に比例する（入門 第15回 ステップ 8 の式1.6 で、再訪時間が分子にあることと同じ）。標準の条件は <i>T</i><sub>F</sub> = 4 秒で <i>R</i><sub>o</sub> = 212.3 km、<i>v</i> = 600 m/s である。',
    cond: '目標が一定の速度で直線上を接近し、走査ごとの検出が独立である場合に成り立つ（ステップ 7 の条件）。||また、フレーム時間を延ばした分のエネルギーを、すべて 1 回の判定の S/N に充てられることが前提である（コヒーレント積分を仮定した）。',
    fail: 'フレーム時間を延ばしても、コヒーレント積分ができる時間に限りがある場合は成り立たない。ノンコヒーレント積分では、積分損失（ステップ 4）の分だけ長いフレームの利点が減少し、最大点は短いほうへ移動する。||目標の RCS 変動が走査の間で独立でない場合（フレーム時間が短いほど、独立でなくなりやすい）は、短いフレームの利点が減少する。',
    mis: '「フレーム時間は短いほどよい（何回も観測できるため）」という理解も「長いほどよい（1 回の P<sub>d</sub> が上がるため）」という理解も一方の効果だけに着目している。これは同じ平均電力を「観測の回数」と「1 回あたりのエネルギー」にどう配分するかという問題である。'},
  hosoku: ['モデル：SNR = (R_o/R)⁴、目標は一定の速度（600 m/s）で接近。平均電力が同じであれば R_o⁴ がフレーム時間に比例。Swerling 1（走査ごとに独立）、P_FA = 10⁻⁶、N_pdi = 1。数値は説明用', '最初の走査の位置（目標が最初に照射される距離）は一様に分布するとして、累積の P_d を平均。走査の間隔が細かい場合は、積を積分で近似', '「最大点は 40 秒程度」「10〜100 秒の範囲では 1 割程度しか変わらない」は、このモデルでの値。ハンドブックの記載は、最適値があることのみ', '「実際のフレーム時間は、ほかの要求と合わせて決定される」という注意（入門 第13回、第17回 ステップ 5）'],
  memo: 'つまずきやすい点は、手計算が 3 回分だけであること（120 km より前は照射していないという仮定）である。感度の図は 1 回の P_d が 5% の距離からすべての走査を数えているため、値が異なる。||声かけの例：「フレーム時間を 4 秒から 16 秒にすると、R_o は何倍になるか（√2 倍）。走査の間に接近する距離はどうか」「目標の速度が 2 倍なら、最大点はどちらへ移動するか」',
  init: {}, ctl: ['ltf'], fixed: [], fixT: FIXE.concat(['フレーム時間 4 秒のとき R_o = 212.3 km', '目標：Swerling 1、接近速度 600 m/s']), plots: [{h: 240}, {h: 220}],
  sol: {ltf: 1.6},
  draw(P){
    const F = frameCached(Z.ro, 1e-6, 1, 1, EX.v, 0.9), tf = Math.pow(10, S.ltf), ro = roFrame(Z.ro, tf), dr = EX.v * tf, rc = rCum(ro, 1e-6, 1, 1, dr, 0.9) / 1000, r1 = ro * Math.pow(10, -Z.s1 / 40) / 1000; let bi = 0; F.ys.forEach((y, i) => { if (y > F.ys[bi]) bi = i; });
    P[0].set({title: 'フレーム時間と検出確率が 0.9 になる距離', xr: [0, 2.5], yr: [0, 200], xl: 'フレーム時間 [秒]', yl: '距離 [km]', xticks: [[0, '1'], [0.301, '2'], [0.699, '5'], [1, '10'], [1.301, '20'], [1.699, '50'], [2, '100'], [2.301, '200']],
      series: [{name: '累積の P_d が 0.9', color: 's2', x: F.xs, y: F.ys, w: 2.4}, {name: '1 回の P_d が 0.9', color: 's1', x: F.xs, y: F.xs.map(l => roFrame(Z.ro, Math.pow(10, l)) * Math.pow(10, -Z.s1 / 40) / 1000), w: 1.8}],
      vl: [{x: S.ltf, color: 'ref'}], pts: [{x: S.ltf, y: rc, color: 's2', r: 6, label: fx(rc, 0) + ' km'}, {x: S.ltf, y: r1, color: 's1', r: 5, label: fx(r1, 0) + ' km', below: true}],
      marks: {rcc: {t: '累積で 0.9 になる距離'}, r1c: {t: '1 回で 0.9 になる距離'}, best: {x0: F.xs[bi] - 0.12, x1: F.xs[bi] + 0.12, t: '最大点：約 ' + fx(Math.pow(10, F.xs[bi]), 0) + ' 秒'}}, tipx: v => fx(Math.pow(10, v), 1) + ' 秒', tipy: v => fx(v, 0) + ' km'});
    const c = scanCurve(ro, 1e-6, 1, 1, dr, Math.max(260e3, 1.3 * ro), 20e3), xs = c.R.map(v => v / 1000), many = c.R.length > 80;
    P[1].set({title: 'このフレーム時間での距離と検出確率', xr: [20, 260], yr: [0, 1.05], xl: '目標距離 [km]', yl: '検出確率', series: [{name: '1 回の走査', color: 's1', x: xs, y: c.ps, w: 2, mk: many ? 0 : 2.5}, {name: '累積（1 つの走査系列の例）', color: 's2', x: xs, y: c.cu, w: 2.2, mk: many ? 0 : 2.5}], hl: [{y: 0.9, color: 'ref'}], tipx: v => fx(v, 0) + ' km', tipy: v => fx(v, 3)});
    return {tiles: [{k: 'フレーム時間', v: fx(tf, tf < 10 ? 1 : 0) + ' <small>秒</small>', s: '走査の間に ' + fx(dr / 1000, 1) + ' km 接近'}, {k: 'R_o', v: kmT(ro), s: '4 秒のときの ' + fx(ro / Z.ro, 2) + ' 倍'}, {k: '累積の P_d が 0.9 になる距離', v: fx(rc, 1) + ' <small>km</small>', s: '最大点（' + fx(Math.pow(10, F.xs[bi]), 0) + ' 秒）では ' + fx(F.ys[bi], 0) + ' km'}, {k: '1 回の P_d が 0.9 になる距離', v: fx(r1, 1) + ' <small>km</small>'}]};
  }});

/* 9 */
function sens(s){      // どの前提が 1 段動くと、探知距離（1 回の Pd）が何 % 動くか
  const b = calc(s).r1, d = o => (calc(Object.assign({}, s, o)).r1 / b - 1) * 100, i = NS.indexOf(s.npdi);
  return [['平均電力 +1 dB', d({pavdb: s.pavdb + 1})], ['損失 +1 dB', d({ladj: s.ladj + 1})], ['P_FA を 1/10 に', d({x: s.x + 1})], ['P_d を +0.05', s.pd <= 0.94 ? d({pd: s.pd + 0.05}) : NaN], ['N_pdi を 2 倍に', i < NS.length - 1 ? d({npdi: NS[i + 1]}) : NaN], [s.sw === 0 ? 'Swerling 1 に' : '非変動に', d({sw: s.sw === 0 ? 1 : 0})]];
}
STEPS.push({short: '計算書を 1 枚作る', title: '計算書を 1 枚作る — 前提から探知距離まで', src: '§4.6 Range Performance（p.4.39–4.48、式4.15〜4.27）', free: true,
  read: {
    what: 'ここまでの計算を 1 枚の{{g-calc-sheet|計算書}}にまとめる。記載の順序は次のとおりである。<br>(1) 前提（レーダ、目標、誤警報の要求、検出確率）<br>(2) セルあたりの P<sub>FA</sub><br>(3) 必要 S/N（変動モデル、積分する CPI 数）<br>(4) 損失の合計と R<sub>o</sub><br>(5) 探知距離（1 回の P<sub>d</sub> で決める距離と、累積の P<sub>d</sub> で決める距離）||右の操作部で前提を変えると、計算書の値が変わる。上の図は距離と検出確率を示し、下の図は[[sensb|感度]]を示す。{{g-sensitivity|感度}}の図には前提を 1 段階ずつ変えた場合に探知距離が何 % 変化するかを並べている。||dB で表した量（電力、損失、必要 S/N）は、1 dB につき距離を約 6% 変化させる。距離が S/N の 4 乗根に比例するためである。これに対して、目標の変動モデルや検出確率の定め方は、それだけで数 dB、距離にして数十 % の変化を生じる。したがって、計算書で最初に確認すべき事項は、多くの場合「どの目標モデルでどの P<sub>d</sub> を、1 回の値で示すのか累積の値で示すのか」であり、電力や損失の 1 dB ではない。||他者の計算書を読むときは、最後の数値より先に前提の行を読むべきである。',
    eq: '<i>R</i> = <i>R</i><sub>o</sub> × 10<sup>−SNR<sub>reqd</sub>[dB] / 40</sup>',
    sym: '式4.15 を距離について解いた形である。<i>R</i>：探知距離。<i>R</i><sub>o</sub>：S/N が 1 になる距離（損失 <i>L</i><sub>T</sub> を含む。式4.16）。SNR<sub>reqd</sub>[dB]：必要 S/N（式4.23 または 4.25）。必要 S/N が 1 dB 増加すると、距離は 10<sup>−1/40</sup> = 0.944 倍になる。',
    cond: '各ステップに示した条件（雑音制限である、損失を重複して計上していない、目標が Swerling の型に従って変動する、走査ごとの検出が独立である、など）がすべて成り立つ場合に限り、この計算書の値を使用できる。',
    fail: 'クラッタや妨害が検出を制限する場合（入門 第2回・第3回・第12回・第14回）や、目標の RCS 変動がどの型にも当てはまらない場合は成り立たない。これらの場合、この計算書は出発点としての目安にとどまる。',
    mis: '「計算書の最後の数値（探知距離）が合っていれば十分である」という理解は誤りである。同じ「100 km」であっても、非変動目標の 1 回の P<sub>d</sub> 0.9 と、Swerling 1 の累積の P<sub>d</sub> 0.9 とでは、レーダに要求される S/N が 10 dB 以上異なる。数値は前提と組にして初めて意味をもつ。'},
  hosoku: ['計算書の項目の並べ方と、感度の図の示し方', '感度の図の「1 段階」は、この教材で決めた変化量（電力と損失は 1 dB、P_FA は 1/10、P_d は +0.05、N_pdi は 2 倍、変動モデルは「非変動」と Swerling 1 の入れ替え）', '累積の P_d で決める距離は、ステップ 8 のモデル（接近速度 600 m/s、R_o⁴ がフレーム時間に比例）による値。積分する CPI 数を増やしても、フレーム時間は変わらないと仮定', '「多くの場合、最初に確認すべき事項は…」という指針', '例の値はすべて説明用'],
  memo: '声かけの例：「この計算書の前提のうち、仕様で決まるものはどれか。設計で決めるものはどれか」「探知距離を 1 割延ばしたい。どの行を変えるか。何 dB 必要か」「同じ計算書を目標モデルだけを変えて 2 枚作ると、何が分かるか」',
  init: {sw: 1}, ctl: ['sw', 'pd', 'x', 'npdi', 'pavdb', 'ladj', 'ltf'], fixed: [], fixT: FIXE.concat(['損失の表はステップ 6 と同じ（合計 13.03 dB）', '接近速度 600 m/s']), plots: [{h: 230}, {h: 210}],
  mission: {t: 'Swerling 1 の目標を 1 回の P<sub>d</sub> 0.9 以上で検出できる距離を、80 km 以上にする。平均電力は増やさず、損失の見積もりも減らさないこと（積分する CPI 数などで工夫する）。', ok: r => S.sw === 1 && S.pd >= 0.9 - 1e-9 && S.pavdb <= 0 && S.ladj >= 0 && r.c.r1 >= 80e3}, sol: {npdi: 4},
  sheet(r){
    const c = r.c || calc(), pfa = c.pfa;
    return [{head: '前提（現在の設定）'},
      {k: '平均送信電力 P<sub>av</sub>', f: '所与', v: fx(EX.pav * lin(S.pavdb) / 1000, 2), u: 'kW'}, {k: '利得、波長、目標', f: '有効開口面積 1.6 m²、1 m²', v: '33.0 dB、10 cm', u: ''}, {k: '雑音 k·T<sub>s</sub>、帯域幅 B<sub>n</sub>', f: '雑音指数 3 dB、CPI 16 ms', v: sci(KT0 * lin(EX.fn), 2) + ' W/Hz、62.5', u: 'Hz'},
      {k: '目標の変動モデル', f: '仮定', v: SWN[S.sw], u: ''}, {k: '検出確率 P<sub>d</sub>', f: '要求', v: fx(S.pd, 2), u: ''}, {k: 'ノンコヒーレント積分する CPI 数 N<sub>pdi</sub>', f: '設計で決定', v: String(S.npdi), u: ''}, {k: 'フレーム時間、接近速度', f: '設計で決定／仮定', v: fx(c.tf, c.tf < 10 ? 1 : 0) + ' 秒、600', u: 'm/s'},
      {head: '誤警報'}, {k: 'セルあたりの P<sub>FA</sub>', f: '式4.18（誤警報時間とセル数から）', v: pfaTxt(S.x), u: ''},
      {head: '必要 S/N'}, {k: '必要 S/N（1 つの CPI あたり）', f: S.sw === 0 ? '式4.23' : '式4.25、n<sub>e</sub> = ' + neOf(S.sw, S.npdi), v: fx(c.req, 2), u: 'dB'},
      {head: '損失と探知距離'}, {k: '損失の合計 L<sub>T</sub>', f: '14 項目の和 + 見積もりの変更', v: fx(c.lt, 2), u: 'dB'}, {k: 'R<sub>o</sub>（フレーム時間 4 秒）', f: '式4.16', v: fx(c.ro / 1000, 1), u: 'km'},
      {k: '探知距離（1 回の P<sub>d</sub> ' + fx(S.pd, 2) + '）', f: '式4.15', v: fx(c.r1 / 1000, 1), u: 'km'}, {k: 'R<sub>o</sub>（現在のフレーム時間）', f: 'R<sub>o</sub><sup>4</sup> ∝ フレーム時間', v: fx(c.roF / 1000, 1), u: 'km'}, {k: '探知距離（累積の P<sub>d</sub> ' + fx(S.pd, 2) + '）', f: '式4.27', v: fx(c.rc / 1000, 1), u: 'km'}];
  },
  draw(P){
    const c = calc(), sc = scanCurve(c.roF, c.pfa, S.sw, S.npdi, c.dr, Math.max(300e3, 1.4 * c.roF), 10e3), xs = sc.R.map(v => v / 1000), many = sc.R.length > 80, xmax = Math.max(150, Math.ceil(1.3 * c.rc / 50000) * 50), r1F = c.r1F / 1000;
    P[0].set({title: '距離と検出確率（現在の設定。フレーム時間 ' + fx(c.tf, c.tf < 10 ? 1 : 0) + ' 秒）', xr: [0, xmax], yr: [0, 1.05], xl: '目標距離 [km]', yl: '検出確率', series: [{name: '1 回の走査', color: 's1', x: xs, y: sc.ps, w: 2, mk: many ? 0 : 2.5}, {name: '累積', color: 's2', x: xs, y: sc.cu, w: 2.2, mk: many ? 0 : 2.5}],
      hl: [{y: S.pd, color: 'ref'}], vl: [{x: r1F, color: 's1', label: '1 回：' + fx(r1F, 0) + ' km', row: 1}, {x: c.rc / 1000, color: 's2', label: '累積：' + fx(c.rc / 1000, 0) + ' km', row: 3}], tipx: v => fx(v, 0) + ' km', tipy: v => fx(v, 3)});
    const sn = sens(S), rects = [], texts = []; sn.forEach((q, i) => { if (!(q[1] === q[1])) { texts.push({s: '—', x: i + 1, y: 4, align: 'center'}); return; } const v = Math.max(-58, Math.min(58, q[1])); rects.push({x0: i + 0.7, x1: i + 1.3, y0: Math.min(0, v), y1: Math.max(0, v), color: v >= 0 ? 's3' : 's2', fill: 0.75, w: 0}); texts.push({s: sg(q[1], 1) + '%', x: i + 1, y: v >= 0 ? Math.min(58, v + 9) : Math.max(-50, v - 2), align: 'center'}); });
    P[1].set({title: '感度：前提を 1 段階変えた場合の探知距離（1 回の P_d）の変化', xr: [0.4, sn.length + 0.6], yr: [-60, 60], xticks: sn.map((q, i) => [i + 1, q[0]]), yl: '距離の変化 [%]', noHover: true, series: [], rects, texts, hl: [{y: 0, color: 'ref', dash: []}], marks: {sensb: {t: 'dB の量は 1 dB で約 6%'}}});
    return {c, tiles: [{k: '必要 S/N', v: fx(c.req, 2) + ' <small>dB</small>', s: SWN[S.sw] + '、P_d ' + fx(S.pd, 2) + '、N_pdi ' + S.npdi}, {k: '探知距離（1 回の P_d）', v: kmT(c.r1), s: 'フレーム時間 4 秒の R_o で'}, {k: '探知距離（累積の P_d）', v: kmT(c.rc), s: '現在のフレーム時間での値。1 回の P_d では ' + kmT(c.r1F)}, {k: '2 つの距離の比', v: fx(c.rc / c.r1F, 2) + ' <small>倍</small>'}]};
  },
  extra: () => checkTable(runChecks())});

bootM();
</script>
</body>
</html>
