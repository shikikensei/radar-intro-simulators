/* ============================================================
   第4回 自動検出とCFAR：ステップの定義
   ============================================================ */
function resetS(init){ const d = cloneDef(); for (const k in S) delete S[k]; Object.assign(S, d, {up: 0, pos: 60, ks: 10, sep: 1.5, det: 'ca', cnr: 0, t3: false}, init); }
const PRE = ['db', 'prob', {no: 3, step: 5, t: '距離や速度のマスごとに判定する、という考え方は、'}];
const SUPC = {'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻'};
const sup = n => String(n).split('').map(c => SUPC[c] || c).join('');
function fP(p){ if (!(p === p)) return '—'; if (p <= 0) return '0'; if (p >= 0.00995) return fx(p, 3); let e = Math.floor(Math.log10(p)), m = p / Math.pow(10, e); if (m >= 9.95){ m = 1; e++; } return fx(m, 1) + '×10' + sup(e); }
const fOne = p => p >= 0.1 ? fx(p * 100, 0) + '%' : '1/' + (1 / p >= 9950 ? fx(1 / p / 1e4, 1 / p >= 99500 ? 0 : 1) + ' 万' : fx(1 / p, 0));
const pfaOf = () => Math.pow(10, -S.pfa);
const CT = {
  pfa: {l: 'しきい値の高さ（ねらう誤警報確率）', min: 1, max: 8, step: 0.5, f: v => fP(Math.pow(10, -v)) + '（' + fOne(Math.pow(10, -v)) + '）', h: v => 'しきい値：雑音の平均 +' + fx(db10(thresholdFor(S.n, Math.pow(10, -v)) / S.n), 1) + ' dB'},
  snr: {l: '目標の強さ（1 パルスの S/N）', min: -5, max: 25, step: 0.5, f: v => dbx(v)},
  sw: {l: '目標のゆらぎ方', seg: [[0, 'ゆらぎなし'], [1, 'スキャンごとにゆらぐ（Swerling 1）']]},
  n: {l: '足し合わせるパルスの数 n', min: 1, max: 32, step: 1, f: v => fx(v, 0) + ' パルス'},
  M: {l: '「検出」とする回数 M（8 回のうち）', min: 1, max: 8, step: 1, f: v => '8 回中 ' + fx(v, 0) + ' 回以上'},
  m: {l: '参照セルの数', min: 2, max: 64, step: 2, f: v => fx(v, 0) + ' 個', h: v => '注目セルの前後に ' + v / 2 + ' 個ずつ'},
  g: {l: 'ガードセルの数（片側）', min: 0, max: 4, step: 1, f: v => fx(v, 0) + ' 個'},
  cnr: {l: 'クラッタの強さ（雑音との比）', min: 0, max: 30, step: 1, f: v => v > 0 ? dbx(v, 0) : 'なし'},
  edge: {l: 'クラッタの始まる位置', min: 40, max: 170, step: 1, f: v => 'セル ' + fx(v, 0)},
  up: {l: 'しきい値を全体に上げる量', min: 0, max: 30, step: 0.5, f: v => '+' + dbx(v)},
  pos: {l: '注目セルの位置', min: 0, max: 199, step: 1, f: v => 'セル ' + fx(v, 0)},
  cfar: {l: 'しきい値の決め方', seg: [['ca', 'セル平均'], ['cens', '大きい 2 個を除く'], ['min', '平均が小さい側'], ['log', '対数ビデオ']]},
  det: {l: 'しきい値の種類', seg: [['fixed', '固定'], ['ca', 'セル平均 CFAR']]},
  ks: {l: 'スキャンの回数（時間）', min: 0, max: 60, step: 1, f: v => fx(v, 0) + ' 回目'},
  sep: {l: '2 つの目標の間隔', min: 0.5, max: 4, step: 0.25, f: v => 'パルス幅の ' + fx(v, 2) + ' 倍'},
  s2: {l: '近くの強い目標の強さ', min: 0, max: 40, step: 1, f: v => dbx(v, 0)}
};
const CAX = {xl: '距離セルの番号（左が近く、右が遠く）', yl: '受信の強さ [dB]（雑音の平均 = 0）', tipx: v => 'セル ' + Math.round(v), tipy: v => fx(v, 1) + ' dB'};
function profCfg(sc, d, ev, o){        // 距離方向の波形・しきい値・検出の印
  o = o || {}; const n = sc.n, y = new Float64Array(NC), t = new Float64Array(NC), pts = []; for (let c = 0; c < NC; c++){ y[c] = db10(d.Y[c + MARG] / n); if (ev.thr) t[c] = db10(ev.thr[c] / n); }
  const series = [{name: '受信の強さ', color: 's1', x0: 0, dx: 1, y, w: 1.4}]; if (ev.thr) series.push({name: o.thrName || 'しきい値', color: 's2', x0: 0, dx: 1, y: t, w: 2.2}); for (const s of (o.more || [])) series.push(s);
  for (let c = 0; c < NC; c++) if (ev.hits[c] && !ev.isT[c]) pts.push({x: c, y: y[c], color: 'ng', shape: 'x', r: 3.5});
  for (const tg of sc.tg) pts.push(ev.hits[tg.cell] ? {x: tg.cell, y: y[tg.cell], color: 'ok', r: 5.5, label: '目標' + tg.id} : {x: tg.cell, y: y[tg.cell], color: 'ref', hollow: true, r: 6.5, label: '目標' + tg.id + '（見逃し）'});
  const bands = (o.bands || []).slice(); if (sc.C > 0) bands.push({x0: sc.edge - 0.5, x1: NC, color: 'bandn', label: 'クラッタのある区間'});
  return Object.assign({title: o.title, xr: o.xr || [0, NC - 1], yr: [-15, o.ymax || 30], series, pts, bands, vl: o.vl, notes: o.notes, marks: o.marks}, CAX);
}
const LEG = '●＝正しい検出、○＝見逃し、✕＝誤警報';
const STEPS = [];

/* 1 */
STEPS.push({short: '自動検出とは', title: '自動検出とは — しきい値で「目標あり／なし」を決める', src: '7.1 Introduction（p.7.1）、7.2 Automatic Detection（p.7.1–7.3）、False-Alarm Control（p.7.11）',
  q: 'しきい値を下げると、弱い目標の見逃しは減る。そのとき、誤警報（目標がないのに「あり」と判定すること）はどうなる？',
  ch: ['減る', '変わらない', '増える'], ans: 2,
  why: 'しきい値を下げると、雑音だけのセルも、たまたま大きくなったときにしきい値を超えやすくなります。見逃しと誤警報は、片方を減らすともう片方が増える関係です。そこでレーダでは、「誤警報の割合を決めたうえで、できるだけ多く見つける」という考え方をとります。',
  read: {
    ana: '火災報知器の感度を上げると、小さな火事も見逃しませんが、料理の湯気でも鳴ってしまいます。感度を下げると誤報は減りますが、本当の火事に気づくのが遅れます。「どこで鳴らすか」を決める線が、しきい値です。',
    what: '自動検出（automatic detection）は、受信信号を距離などのセルに区切り、セルごとに「目標がある」か「雑音だけ」かを計算機が決める処理です。基本は、受信の強さを[[thr|しきい値（threshold）]]と比べることです。||誤りは 2 種類あります。目標がないのに検出する[[fa|誤警報]]と、目標があるのに検出しない[[miss|見逃し]]です。誤警報の起きる確率を誤警報確率（Pfa）、目標を正しく検出する確率を探知確率（Pd）と呼びます。',
    eq: '受信の強さ ＞ しきい値　→　「目標あり」と判定',
    sym: '受信の強さ：そのセルの検波後の出力（何パルスか足し合わせることもある）。しきい値：ねらう誤警報確率から決める値。誤警報が多すぎると、後ろにつながる追尾の処理があふれてしまいます。',
    mis: '「しきい値を超えたら、そこに目標がある」とは限りません。雑音だけでも、ある確率でしきい値を超えます。検出は、確率で考える判定です。'},
  hosoku: ['火災報知器のたとえ', '図の印は乱数で作った 1 スキャン分のデータに対する結果であること', 'クラッタなし・目標 2 つの場面設定'],
  memo: 'つまずきやすい点：誤警報「確率」と、1 スキャンあたりの誤警報の「個数」（= 確率 × セル数）の違い。||声かけの例：「セルが 200 個で Pfa が 1/100 なら、誤警報は平均何個？」「別のデータにすると ✕ の位置は変わる。なぜ？」',
  init: {pfa: 1, snr: 13, t2: true, t2off: 20, s2: 11, n: 1}, ctl: ['pfa'], fixed: ['snr'], fixT: ['もう 1 つの目標の強さ 11 dB', '距離セルの数 200 個'], plots: [{h: 280}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}], do: 'スライダーを動かして確かめよう（' + LEG + '）',
  mission: {t: 'このスキャンで、誤警報を 1 個以下にしつつ、2 つの目標を両方とも検出できるしきい値を見つけよう。', ok: r => r.ev.nFa <= 1 && r.ev.nMiss === 0}, sol: {pfa: 3},
  draw(P){
    const sc = scenario(S), d = genScan(sc, S.seed), ev = evalDet(sc, d, 'fixed'), Tdb = db10(thresholdFor(1, sc.pfa));
    P[0].set(profCfg(sc, d, ev, {title: '距離ごとの受信の強さと、しきい値による判定（1 スキャン分）', marks: {thr: {y0: Tdb - 1.5, y1: Tdb + 1.5, t: 'しきい値'}, fa: {y0: Tdb, y1: 30, t: 'しきい値を超えた雑音＝誤警報'}, miss: {x0: 55, x1: 85, y0: -15, y1: Tdb, t: 'しきい値に届かない目標＝見逃し'}}}));
    return {ev, msHint: '誤警報 ' + ev.nFa + ' 個・見逃し ' + ev.nMiss + ' 個', tiles: [{k: 'このスキャンの誤警報', v: ev.nFa + ' <small>個</small>', s: '平均では 200 セル × ' + fP(sc.pfa) + ' = ' + fx(200 * sc.pfa, 200 * sc.pfa < 10 ? 1 : 0) + ' 個'}, {k: 'このスキャンの目標', v: '検出 ' + ev.nDet + '・見逃し ' + ev.nMiss}, {k: 'しきい値', v: '+' + fx(Tdb, 1) + ' <small>dB</small>', s: '雑音の平均の ' + ratioTxt(Tdb)}]};
  }});

/* 2 */
STEPS.push({short: '振幅の分布', title: '雑音と目標の振幅の分布 — しきい値の右側の面積が、確率になる', src: '7.1（p.7.1）、Optimal Detector（p.7.2–7.3）、式7.10（p.7.8）、レイリー分布の式（p.7.11）',
  q: '「雑音だけ」のときの振幅の分布で、しきい値より右側の部分の面積は、何を表す？',
  ch: ['探知確率', '誤警報確率', 'S/N'], ans: 1,
  why: '雑音だけなのにしきい値を超えるのが誤警報です。だから、雑音の分布のうち、しきい値より右側の面積が誤警報確率になります。同じように、「目標＋雑音」の分布の右側の面積が探知確率です。',
  read: {
    ana: 'クラスの身長の分布を考えます。「170 cm 以上の人」の割合は、分布のグラフで 170 cm より右側の面積です。線を右にずらせば割合は減り、左にずらせば増えます。',
    what: '雑音だけのとき、検波後の振幅は[[noise|レイリー分布]]になります。目標があると、分布は右へ動きます（ゆらがない目標では[[sig|ライス分布]]）。S/N が大きいほど、2 つの分布は離れます。||2 つの分布は重なっているので、しきい値をどこに置いても、誤警報と見逃しの両方を 0 にはできません。[[tail|しきい値より右側の面積]]が、それぞれの確率です。',
    eq: '<i>T</i> = σ·√( −2·ln <i>P</i><sub>fa</sub> )',
    sym: '<i>T</i>：しきい値（振幅）。σ：雑音の強さを表す量（I 成分・Q 成分それぞれの標準偏差）。ln：自然対数。<i>P</i><sub>fa</sub>：誤警報確率。P<sub>fa</sub> = 1/1000 なら T = 3.72σ。',
    mis: '「誤警報確率を 10 分の 1 にするには、しきい値を大きく上げる必要がある」と思いがちですが、実際はわずかです（1/1000 → 1/1 万で 3.72σ → 4.29σ）。ただし、そのわずかな差で探知確率は確実に下がります。'},
  hosoku: ['身長の分布のたとえ', '式7.10 はハンドブックでは 2 値積分の第 1 しきい値の式として出てくること', '1 パルス（積分なし）で説明していること'],
  memo: 'つまずきやすい点：面積＝確率、という読み方。色を塗った部分を指さして確認。||声かけの例：「しきい値を右に動かすと、2 つの面積はそれぞれどうなる？」「2 つの分布の重なりを減らすには、何を変えればいい？（S/N、または次々回の積分）」',
  init: {pfa: 1.5, snr: 10, n: 1}, ctl: ['pfa'], fixed: ['snr'], plots: [{h: 280}],
  mission: {t: '誤警報確率を 1/1000 以下に保ったまま、探知確率が 0.8 以上になるしきい値を見つけよう。', ok: r => pfaOf() <= 1.0001e-3 && r.pd >= 0.8}, sol: {pfa: 3},
  draw(P){
    const pfa = pfaOf(), T = -Math.log(pfa), Ta = Math.sqrt(2 * T), s = lin(S.snr), Q = x => pd1(0, s, x), pd = Q(T), xmax = 9, NX = 270, xs = [], fn = [], ft = [], tx = [], tn = [], tt = [];
    for (let k = 0; k <= NX; k++){ const x = k * xmax / NX, Pw = x * x / 2, h = 1e-4 * (1 + Pw), lo = Math.max(0, Pw - h), a = x * Math.exp(-x * x / 2), b = x * (Q(lo) - Q(Pw + h)) / (Pw + h - lo); xs.push(x); fn.push(a); ft.push(b); if (x >= Ta){ tx.push(x); tn.push(a); tt.push(b); } }
    P[0].set({title: '振幅の分布としきい値（1 パルス）', xr: [0, xmax], yr: [0, 0.7], xl: '検波後の振幅（雑音の σ を 1 とする）', yl: '出やすさ（確率密度）', series: [{x: tx, y: tt, color: 's2', fill: 0.25, w: 0.01, noLegend: true, noTip: true}, {x: tx, y: tn, color: 's1', fill: 0.5, w: 0.01, noLegend: true, noTip: true}, {name: '雑音だけ', color: 's1', x: xs, y: fn, w: 2.2}, {name: '目標＋雑音（S/N ' + fx(S.snr, 0) + ' dB）', color: 's2', x: xs, y: ft, w: 2.2}],
      vl: [{x: Ta, label: 'しきい値 ' + fx(Ta, 2) + 'σ', color: 'text2', w: 1.5, dash: [5, 3]}], notes: [{x: Math.sqrt(2 * s) + 0.6, y: 0.2, t: 'この面積が探知確率 ' + fx(pd, 2), dx: 30, dy: -50}],
      marks: {noise: {x0: 0, x1: 3.5, t: '雑音だけの分布'}, sig: {x0: Math.sqrt(2 * s) - 2.2, x1: Math.sqrt(2 * s) + 2.5, t: '目標＋雑音の分布'}, tail: {x0: Ta, x1: xmax, t: 'しきい値より右側'}}, tipx: v => '振幅 ' + fx(v, 2), tipy: v => fx(v, 3)});
    return {pd, tiles: [{k: '誤警報確率（雑音の分布の右側の面積）', v: fP(pfa), s: fOne(pfa)}, {k: '探知確率（目標＋雑音の右側の面積）', v: fx(pd, 3)}, {k: 'しきい値', v: fx(Ta, 2) + ' <small>σ</small>', s: '電力では雑音の平均 +' + fx(db10(T), 1) + ' dB'}]};
  }});

/* 3 */
STEPS.push({short: 'S/N と探知確率', title: 'S/N と探知確率 — 目標の「ゆらぎ」で、必要な S/N が変わる', src: '7.1 Introduction（p.7.1）、Optimal Detector（p.7.3）、図7.5（p.7.6）',
  q: '目標のエコーの強さが、スキャンごとにゆらぐとする（平均の S/N は同じ）。探知確率 0.9 を得るのに必要な S/N は、ゆらがない目標と比べてどうなる？',
  ch: ['小さくてすむ', '同じ', '大きい S/N が必要'], ans: 2,
  why: 'ゆらぐ目標は、たまたま弱く見えるスキャンがあります。高い探知確率（0.9 など）を得るには、その「弱いとき」でもしきい値を超える必要があるので、平均の S/N に大きな余裕が要ります。逆に低い探知確率では、たまたま強く見える分だけ有利になります。',
  read: {
    ana: '遠くの灯台の光が、いつも同じ明るさなら、ある明るさ以上で必ず見えます。もし光がちらちら揺れていると、平均の明るさは同じでも、暗い瞬間には見えません。「10 回中 9 回見える」ためには、もっと明るい灯台が必要です。',
    what: '誤警報確率を決めると、探知確率は S/N で決まります。この関係は、強さが一定の目標と、ゆらぐ目標で形が違います。航空機のような目標は、向きがわずかに変わるだけでエコーの強さが大きく変わります。||図の 2 本の[[curve|曲線]]を比べてください。ゆらがない目標は立ち上がりが急です。ゆらぐ目標（Swerling 1 と呼ばれるモデル）はなだらかで、[[p9|探知確率 0.9]] に届くには、ずっと大きな S/N が必要です。',
    eq: '<i>P</i><sub>D</sub> = <i>P</i><sub>fa</sub><sup> 1 / (1 + S/N)</sup>',
    sym: '<i>P</i><sub>D</sub>：探知確率。<i>P</i><sub>fa</sub>：誤警報確率。S/N：平均の信号対雑音比（dB ではなく比）。{H}これは 1 パルス・Swerling 1 の場合に成り立つ、一般に知られた式です。ハンドブックのこの部分には、この式そのものは書かれていません。',
    mis: '「S/N が 10 dB あれば必ず見つかる」わけではありません。探知確率は、S/N・誤警報確率・目標のゆらぎ方の 3 つで決まります。 さらに深く：必要な S/N を自分で計算するには、<a href="m01_detection.html">中級 第1回 検出の計算</a>へ。'},
  hosoku: ['灯台のたとえ', 'Swerling モデルの定義（スキャンごとに変わる、電力が指数分布）', '式 Pd = Pfa^(1/(1+S/N))（1 パルス・Swerling 1 の一般に知られた式）', '全パルス同じ強さとして計算していること（ハンドブックの図7.5 はアンテナの走査による変化を含む）'],
  memo: 'つまずきやすい点：横軸が dB（対数）であること。3 dB 右へ行くと S/N は 2 倍。||声かけの例：「探知確率 0.5 のところでは、2 本の曲線の差はどのくらい？ 0.9 では？」「誤警報確率をもっと小さくすると、曲線はどちらへ動くと思う？」',
  init: {pfa: 3, snr: 8, sw: 0, n: 1}, ctl: ['snr', 'sw'], fixed: ['pfa'], plots: [{h: 290}],
  mission: {t: 'スキャンごとにゆらぐ目標（Swerling 1）で、探知確率が 0.9 以上になる S/N を見つけよう。', ok: r => S.sw === 1 && r.pd >= 0.9}, sol: {sw: 1, snr: 18.5},
  draw(P){
    const pfa = pfaOf(), T = thresholdFor(1, pfa), xs = [], y0 = [], y1 = []; for (let d = -5; d <= 25.01; d += 0.25){ xs.push(d); y0.push(pdNF(1, lin(d), T)); y1.push(Math.pow(pfa, 1 / (1 + lin(d)))); }
    const f = sw => sw ? Math.pow(pfa, 1 / (1 + lin(S.snr))) : pdNF(1, lin(S.snr), T), pd = f(S.sw);
    P[0].set({title: '探知確率と S/N（誤警報確率 ' + fP(pfa) + '、1 パルス）', xr: [-5, 25], yr: [0, 1], xl: '目標の S/N [dB]（右ほど強い目標）', yl: '探知確率', series: [{name: 'ゆらぎなし', color: 's1', x: xs, y: y0, w: S.sw === 0 ? 3 : 1.6}, {name: 'スキャンごとにゆらぐ（Swerling 1）', color: 's2', x: xs, y: y1, w: S.sw === 1 ? 3 : 1.6}], hl: [{y: 0.9, label: '探知確率 0.9', left: true}],
      pts: [{x: S.snr, y: pd, color: S.sw ? 's2' : 's1', r: 6, label: fx(pd, 2), left: pd > 0.7}], marks: {curve: {t: '2 本の曲線'}, p9: {y0: 0.86, y1: 0.94, t: '探知確率 0.9'}}, tipx: v => 'S/N ' + fx(v, 1) + ' dB', tipy: v => fx(v, 3)});
    return {pd, tiles: [{k: 'いまの探知確率', v: fx(pd, 3), s: S.sw ? 'ゆらぐ目標' : 'ゆらがない目標'}, {k: '同じ S/N で、もう一方のモデルなら', v: fx(f(1 - S.sw), 3)}, {k: 'S/N', v: dbx(S.snr)}]};
  }});

/* 4 */
const pdN = n => pdFixed(0, n, lin(S.snr), thresholdFor(n, pfaOf()));
STEPS.push({short: '積分', title: '積分 — 何パルスか足し合わせて、弱い目標を見えるようにする', src: 'Practical Detectors（p.7.3–7.6、式7.5、図7.3〜7.5）',
  q: '1 パルスでは雑音に埋もれてしまう弱い目標。8 パルス分の受信の強さを足し合わせてから判定すると、探知確率はどうなる？（誤警報確率は同じにそろえる）',
  ch: ['上がる', '変わらない（雑音も一緒に足されるから）', '下がる'], ans: 0,
  why: '足し合わせると、目標の成分は毎回積み上がります。雑音も足されますが、大きいときと小さいときが平均されて、でこぼこが目立たなくなります。そのため、しきい値を平均の近くまで下げられ、弱い目標でも超えられるようになります。',
  read: {
    ana: 'サイコロを 1 回振って「6 が出やすいサイコロかどうか」を見抜くのは無理ですが、100 回振れば、偏りがはっきり分かります。1 回ごとのばらつきは、回数を重ねると平均されて小さくなるからです。',
    what: 'アンテナが目標を横切る間には、何発ものパルスが当たります。その受信の強さを足し合わせることを積分（integration）と呼びます。代表的な方法が移動窓積分器（moving-window integrator）で、直近 n パルスの和を、1 パルスごとに更新します。||上の図は 1 つの距離セルをパルスごとに見たもの、下の図は[[win|移動窓の出力]]です。足し合わせるパルスを増やすと、雑音のでこぼこが小さくなり、[[tgt4|目標のいる区間]]がしきい値を超えるようになります。',
    eq: '<i>S</i><sub>i</sub> = <i>S</i><sub>i−1</sub> + <i>x</i><sub>i</sub> − <i>x</i><sub>i−n</sub>',
    sym: '<i>S</i><sub>i</sub>：<i>i</i> 番目のパルスまでの、直近 <i>n</i> パルスの和。<i>x</i><sub>i</sub>：<i>i</i> 番目のパルスの受信の強さ。新しい値を足し、<i>n</i> 個前の値を引くだけで更新できます。',
    mis: '「n パルス足せば、n 倍弱い目標まで見える」わけではありません。検波した後で足す積分（非コヒーレント積分）の効果は、n 倍より小さくなります。'},
  hosoku: ['サイコロのたとえ', '目標が n パルスの間だけ同じ強さで見えるとした場面設定（ビームの形は平ら）', '雑音のでこぼこが平均されるという説明'],
  memo: 'つまずきやすい点：下の図は「平均」で描いているので、雑音の高さ（0 dB）は変わらず、でこぼこだけが小さくなる。||声かけの例：「n を 4 倍にすると、しきい値は何 dB 下がった？」「移動窓の弱点は何だろう？（強い干渉パルス 1 発。次のステップ）」',
  init: {snr: 3, n: 1, pfa: 3}, ctl: ['n'], fixed: ['snr', 'pfa'], plots: [{h: 150}, {h: 190}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: '探知確率が 0.9 以上になる、いちばん少ないパルス数を見つけよう。', ok: r => r.pd >= 0.9 && (S.n === 1 || pdN(S.n - 1) < 0.9)}, sol: {n: 12},
  draw(P){
    const n = S.n, T = thresholdFor(n, pfaOf()), seq = pulseSeq({n, snr: S.snr, sw: 0}, S.seed), mov = movingSum(seq.x, n), xdb = new Float64Array(NPS), ydb = new Float64Array(NPS - n + 1), pts = [], Tdb = db10(T / n), pd = pdN(n);
    for (let i = 0; i < NPS; i++) xdb[i] = db10(seq.x[i]); for (let i = n - 1; i < NPS; i++){ ydb[i - n + 1] = db10(mov[i] / n); if (mov[i] > T) pts.push(i >= seq.p0 && i <= seq.p0 + 2 * n - 2 ? {x: i, y: ydb[i - n + 1], color: 'ok', r: 3.5} : {x: i, y: ydb[i - n + 1], color: 'ng', shape: 'x', r: 3}); }
    const band = [{x0: seq.p0 - 0.5, x1: seq.p0 + n - 0.5, color: 'band3', label: '目標がいる間'}];
    P[0].set({title: '1 つの距離セルの、パルスごとの受信の強さ', xr: [-1, NPS], yr: [-20, 20], xl: '', yl: '強さ [dB]', series: [{name: '各パルス', color: 's1', x0: 0, dx: 1, y: xdb, stem: true, base: -20, mk: 2, w: 1.2}], bands: band, marks: {tgt4: {x0: seq.p0 - 0.5, x1: seq.p0 + n - 0.5, t: '目標のいる区間'}}, noHover: true});
    P[1].set({title: '移動窓の出力（直近 ' + n + ' パルスの平均）としきい値', xr: [-1, NPS], yr: [-8, 14], xl: 'パルスの番号（時間の順）', yl: '強さ [dB]（雑音の平均 = 0）', series: [{name: '移動窓の出力', color: 's1', x0: n - 1, dx: 1, y: ydb, w: 1.8}], hl: [{y: Tdb, label: 'しきい値 +' + fx(Tdb, 1) + ' dB', color: 's2', dash: [6, 3]}], pts, bands: [{x0: seq.p0 - 0.5, x1: seq.p0 + n - 0.5, color: 'band3'}], marks: {win: {t: '移動窓の出力'}}, tipx: v => 'パルス ' + Math.round(v), tipy: v => fx(v, 1) + ' dB'});
    return {pd, tiles: [{k: '探知確率（理論）', v: fx(pd, 3), s: n + ' パルスの積分'}, {k: 'しきい値', v: '+' + fx(Tdb, 1) + ' <small>dB</small>', s: '雑音の平均の ' + ratioTxt(Tdb)}, {k: '1 パルスだけなら', v: fx(pdN(1), 3), s: 'S/N ' + fx(S.snr, 0) + ' dB の目標'}]};
  }});

/* 5 */
const pdB = M => pdBinary(0, 8, M, lin(S.snr), binP0(8, M, pfaOf()));
STEPS.push({short: '2 値積分', title: '2 値積分（M-out-of-N）— 強さを足す代わりに、回数を数える', src: 'Binary Integrator（p.7.7–7.9、式7.9・7.10）、Batch Processor（p.7.10–7.11）、Summary（p.7.20–7.21）',
  q: '8 パルスのうち 1 発だけ、目標ではない非常に強い干渉パルスが混ざった。だまされて誤警報を出しにくいのは、どちらの方式？',
  ch: ['8 パルスの強さを足す方式（移動窓）', 'しきい値を超えた回数を数える方式（2 値積分）', 'どちらも同じ'], ans: 1,
  why: '強さを足す方式では、1 発が極端に大きいと、それだけで和がしきい値を超えてしまいます。回数を数える方式では、どんなに大きくても「1 回」としか数えないので、M 回に届かず、だまされません。',
  read: {
    ana: '多数決を考えます。8 人の審査員のうち 5 人以上が「合格」と言えば合格、というルールなら、1 人が飛び抜けて大きな声で「合格！」と叫んでも、結果は変わりません。声の大きさではなく、人数で決めるからです。',
    what: '2 値積分（binary integration）は、パルスごとに[[t1|第 1 のしきい値]]と比べて 0 か 1 にし、直近 N パルスのうち 1 が[[cnt|M 個以上]]あれば検出とします。「N 回中 M 回」方式とも呼びます。||強さの情報を捨てるので、移動窓より感度は少し落ちます。その代わり、作りやすく、1 発だけの強い干渉にだまされず、雑音の分布が想定と違う場合にも強い、という利点があります。パルスが 2〜4 個と少ないときは、この方式がすすめられています。',
    eq: '<i>M</i> ≈ 1.5·√<i>N</i>',
    sym: '<i>M</i>：「検出」とするのに必要な回数（第 2 のしきい値）。<i>N</i>：数える対象のパルスの数。N = 8 なら M ≈ 4.2。この目安で選ぶと、最も良い M との差は小さい（ハンドブックでは 0.2 dB 以内）とされています。',
    mis: '「M は小さいほど見つけやすい」とは限りません。M を小さくすると、誤警報確率を保つために第 1 のしきい値を高くする必要があり、かえって探知確率が下がります。'},
  hosoku: ['多数決のたとえ', '干渉パルスを 1 発（+30 dB）入れた場面設定', '探知確率の計算（二項分布）'],
  memo: 'つまずきやすい点：しきい値が 2 つあること（パルスごとの第 1、回数の第 2）。M を変えると第 1 のしきい値も一緒に動く。||声かけの例：「M = 1 と M = 8 は、それぞれどんな弱点がある？」「上の図の赤い線（第 1 のしきい値）は、M を増やすとなぜ下がる？」',
  init: {snr: 6, n: 8, M: 1, pfa: 3}, ctl: ['M'], fixed: ['snr', 'pfa'], plots: [{h: 160}, {h: 150}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: '探知確率がいちばん高くなる M を見つけよう（式の目安 1.5·√8 ≈ 4.2 と比べてみよう）。', ok: r => r.best === S.M}, sol: {M: 4},
  draw(P){
    const M = S.M, pfa = pfaOf(), p0 = binP0(8, M, pfa), T1 = -Math.log(p0), T = thresholdFor(8, pfa), seq = pulseSeq({n: 8, snr: S.snr, sw: 0, spike: true}, S.seed), cnt = movingCount(seq.x, 8, T1), mov = movingSum(seq.x, 8), lo = [], lx = [], hi = [], hx = [], pts = [];
    for (let i = 0; i < NPS; i++){ const v = db10(seq.x[i]); if (seq.x[i] > T1){ hx.push(i); hi.push(v); } else { lx.push(i); lo.push(v); } }
    let fooled = false, best = 1; for (let i = 7; i < NPS; i++){ if (cnt[i] >= M) pts.push(i >= seq.p0 && i <= seq.p0 + 14 ? {x: i, y: cnt[i], color: 'ok', r: 3.5} : {x: i, y: cnt[i], color: 'ng', shape: 'x', r: 3}); if (mov[i] > T && i >= seq.spikeAt && i < seq.spikeAt + 8) fooled = true; }
    for (let k = 2; k <= 8; k++) if (pdB(k) > pdB(best)) best = k;
    P[0].set({title: 'パルスごとの受信の強さと、第 1 のしきい値', xr: [-1, NPS], yr: [-20, 40], xl: '', yl: '強さ [dB]', series: [{name: '0（しきい値以下）', color: 'ref', x: lx, y: lo, stem: true, base: -20, mk: 2, w: 1.2}, {name: '1（しきい値を超えた）', color: 's2', x: hx, y: hi, stem: true, base: -20, mk: 2.4, w: 1.6}],
      hl: [{y: db10(T1), label: '第 1 のしきい値', color: 's2', dash: [6, 3]}], bands: [{x0: seq.p0 - 0.5, x1: seq.p0 + 7.5, color: 'band3', label: '目標がいる間'}], notes: [{x: seq.spikeAt, y: 30, t: '干渉パルス（1 発だけ）', dx: 30, dy: 10}], marks: {t1: {y0: db10(T1) - 3, y1: db10(T1) + 3, t: '第 1 のしきい値'}}, noHover: true});
    P[1].set({title: '直近 8 パルスのうち、1 だった回数', xr: [-1, NPS], yr: [0, 8.6], xl: 'パルスの番号（時間の順）', yl: '回数', series: [{name: '1 の回数', color: 's2', x0: 0, dx: 1, y: cnt, w: 1.8}], hl: [{y: M, label: '検出とする回数 M = ' + M, color: 's1', dash: [6, 3]}], pts, bands: [{x0: seq.p0 - 0.5, x1: seq.p0 + 7.5, color: 'band3'}], marks: {cnt: {y0: M - 0.4, y1: 8.4, t: 'M 個以上'}}, tipx: v => 'パルス ' + Math.round(v), tipy: v => fx(v, 0) + ' 回'});
    return {best, tiles: [{k: '探知確率（2 値積分、理論）', v: fx(pdB(M), 3), s: '8 回中 ' + M + ' 回以上'}, {k: '1 パルスが「1」になる確率（雑音だけ）', v: fP(p0), s: '全体の誤警報確率を ' + fP(pfa) + ' にする値'}, {k: '強さを足す方式なら（同じデータ）', v: fooled ? '干渉で誤警報' : '誤警報なし', s: '探知確率は ' + fx(pdFixed(0, 8, lin(S.snr), T), 3)}]};
  }});

/* 6 */
STEPS.push({short: '固定しきい値の問題', title: '固定しきい値の問題 — 背景の強さが場所で変わると、破綻する', src: '7.2 Automatic Detection（p.7.2）、False-Alarm Control（p.7.11）',
  q: '雑音に合わせて決めたしきい値のまま、雑音の約 30 倍（15 dB）強いクラッタが残っている区間を見ると、どうなる？',
  ch: ['何も起きない', 'その区間が誤警報だらけになる', 'その区間の目標が見やすくなる'], ans: 1,
  why: 'しきい値は「雑音だけなら、めったに超えない高さ」に決めてあります。背景が 30 倍強い区間では、ほとんどのセルがその高さを超えてしまい、誤警報だらけになります。かといって全体のしきい値を上げると、クラッタのない場所の弱い目標まで見逃します。',
  read: {
    ana: '静かな部屋に合わせて「この大きさ以上の音がしたら知らせる」と決めた装置を、工事現場に持っていくと、ずっと鳴りっぱなしになります。鳴らないように設定を上げると、今度は静かな部屋の小さな物音に気づけなくなります。',
    what: 'ここまでは、雑音の強さがどのセルでも同じ、という前提でした。実際には、陸地・海面・雨などの[[cl6|クラッタ]]が残る場所では、背景がずっと強くなります。固定のしきい値のままでは、膨大な誤警報が出て、後ろにつながる追尾の処理があふれます。||[[thr6|しきい値]]を全体に上げれば誤警報は止まりますが、クラッタのない場所の感度まで下がります。必要なのは、場所ごとに背景の強さに合わせたしきい値です。',
    eq: '<i>P</i><sub>fa</sub>（クラッタの中）= <i>P</i><sub>fa</sub>（雑音だけ）<sup> 1 / (1 + C/N)</sup>',
    sym: 'C/N：クラッタと雑音の電力の比（dB ではなく比）。{H}この式は、1 パルス・背景がレイリー分布の場合に導ける関係です。C/N が 15 dB（約 32 倍）なら、1/1000 が約 0.81 に跳ね上がります。',
    mis: '「誤警報が多いなら、しきい値を上げればよい」は、半分だけ正解です。誤警報は止まりますが、全体の感度が、いちばん背景の強い場所に合わせて下がってしまいます。'},
  hosoku: ['工事現場のたとえ', 'クラッタを「一定の強さの区間で、雑音と同じ分布、セルごとに独立」としたモデル', 'クラッタの中の誤警報確率の式'],
  memo: 'つまずきやすい点：クラッタの区間で起きているのは「目標の検出」ではなく誤警報であること。||声かけの例：「しきい値を 15 dB 上げたとき、雑音の中の目標1 の探知確率はいくつになった？」「場所ごとに違うしきい値を使うには、何が分かればいい？（次のステップ）」',
  init: {cnr: 15, edge: 120, t3: true, s3: 30, snr: 12, pfa: 3, up: 0}, ctl: ['up'], fixed: ['cnr'], plots: [{h: 290}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}], do: 'スライダーを動かして確かめよう（' + LEG + '）',
  mission: {t: 'クラッタの区間の誤警報を 2 個以下にしよう。そのとき、雑音の中にいる目標1 がどうなったかも確かめよう。', ok: r => r.faC <= 2}, sol: {up: 17},
  draw(P){
    const sc = scenario(S), d = genScan(sc, S.seed), ev = evalDet(sc, d, 'fixed'), th = theory(sc, 'fixed'), Tdb = db10(ev.thr[0]); let faC = 0; for (let c = sc.edge; c < NC; c++) if (ev.hits[c] && !ev.isT[c]) faC++;
    P[0].set(profCfg(sc, d, ev, {title: '固定しきい値による判定（1 スキャン分）', ymax: 45, thrName: 'しきい値（どこでも同じ）', marks: {cl6: {x0: sc.edge, x1: NC - 1, t: 'クラッタ'}, thr6: {y0: Tdb - 1.5, y1: Tdb + 1.5, t: 'しきい値'}}}));
    return {faC, msHint: 'クラッタの区間の誤警報 ' + faC + ' 個', tiles: [{k: 'クラッタの区間の誤警報（このスキャン）', v: faC + ' <small>個</small>', s: '誤警報確率（理論）' + fP(th.pfa[1])}, {k: '雑音の中の目標1 の探知確率（理論）', v: fx(th.pd[0], 3), s: ev.hits[sc.tg[0].cell] ? 'このスキャンでは検出' : 'このスキャンでは見逃し'}, {k: 'しきい値', v: '+' + fx(Tdb, 1) + ' <small>dB</small>', s: '雑音の平均の ' + ratioTxt(Tdb)}]};
  }});

/* 7 */
STEPS.push({short: 'セル平均 CFAR', title: 'セル平均 CFAR — 周りのセルから背景の強さを測って、しきい値を決める', src: 'Adaptive Thresholding（p.7.11–7.13、図7.12・7.13、式7.12）',
  q: 'セル平均 CFAR は、注目するセルの周りのセルの平均から、しきい値を作る。背景が 30 倍強いクラッタの区間に入ると、しきい値はどうなる？',
  ch: ['変わらない', '背景と一緒に上がる', '下がる'], ans: 1,
  why: 'しきい値は「周りのセルの平均 × 一定の係数」です。背景が強い場所では、周りのセルの平均が大きくなるので、しきい値も同じ割合で上がります。そのため、背景の強さによらず、誤警報確率がほぼ一定に保たれます。',
  read: {
    ana: 'にぎやかな場所でも静かな場所でも、人は「周りの音より目立って大きい音」に気づきます。周りがうるさければ、気づく基準が自然に上がります。セル平均 CFAR は、この「周りと比べる」判定を、計算で行います。',
    what: 'セル平均 CFAR（cell-averaging CFAR）は、[[cut|注目セル]]の前後にある[[ref|参照セル（reference cells）]]の平均から背景の強さを推定し、それに係数を掛けてしきい値にします。CFAR は「一定誤警報率」の略です。||前提は、参照セルの背景が注目セルと同じ強さであることです。注目セルのすぐ隣は、目標のエコーがもれて入るのを避けるため、参照に使いません（ガードセル）。「動かす」を押して、窓が滑っていく様子を見てください。',
    eq: 'しきい値 = α ×（参照セルの平均）',
    sym: 'α：ねらう誤警報確率と参照セルの数から決まる係数（背景の強さにはよらない）。参照セルの平均：注目セルの前後の参照セルの、受信の強さの平均。{H}1 パルス・参照セル m 個のとき、α = m·(P<sub>fa</sub><sup>−1/m</sup> − 1)。',
    mis: '「CFAR はクラッタを消す」のではありません。しきい値をクラッタの上に持ち上げるだけです。クラッタより弱い目標は、CFAR でも検出できません。'},
  hosoku: ['にぎやかな場所のたとえ', '「ガードセル」という呼び名と、もれ込みを避けるという説明（ハンドブックの式7.12・図7.13 でも両隣の 1 セルは参照から外れている）', '係数 α の式', '2 乗検波（電力）で計算していること'],
  memo: 'つまずきやすい点：しきい値の線は、セルごとに別々に計算した値をつないだもの。||声かけの例：「注目セルをクラッタの境目に置くと、しきい値はどうなっている？」「目標3 が検出できるのは、クラッタより何 dB 強いから？」',
  init: {cnr: 15, edge: 120, t3: true, s3: 30, snr: 12, pfa: 3, pos: 40, m: 16, g: 1}, ctl: ['pos'], fixed: ['m', 'cnr'], plots: [{h: 250}, {h: 160}], do: 'スライダーを動かして確かめよう（' + LEG + '）',
  acts: [{t: '▶ 動かす', play: {k: 'pos', min: 0, max: 199, step: 1, ms: 70}}, {t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: '注目セルを、クラッタの中にいる目標3（セル 145）に合わせて、検出されることを確かめよう。', ok: r => S.pos === 145 && r.hit}, sol: {pos: 145},
  draw(P){
    const sc = scenario(S), d = genScan(sc, S.seed), ev = evalDet(sc, d, 'ca'), pos = S.pos, h = sc.m / 2, g = sc.g, w = h + g + 4, xr = [], yr_ = [], xg = [], yg = [], val = c => db10(d.Y[c + MARG]);
    for (let c = pos - w; c <= pos + w; c++){ if (c + MARG < 0 || c + MARG >= NT) continue; const a = Math.abs(c - pos); if (a > g && a <= g + h){ xr.push(c); yr_.push(val(c)); } else if (a){ xg.push(c); yg.push(val(c)); } }
    const est = db10(ev.est[pos]), thr = db10(ev.thr[pos]), hit = !!ev.hits[pos];
    P[0].set(profCfg(sc, d, ev, {title: 'セル平均 CFAR のしきい値と判定（1 スキャン分）', ymax: 45, thrName: 'しきい値（セルごとに決まる）', bands: [{x0: pos - g - h - 0.5, x1: pos - g - 0.5, color: 'band'}, {x0: pos + g + 0.5, x1: pos + g + h + 0.5, color: 'band'}], vl: [{x: pos, label: '注目セル', color: 'text2'}],
      marks: {cut: {x0: pos - 1, x1: pos + 1, t: '注目セル'}, ref: {x0: pos - g - h, x1: pos + g + h, t: '参照セル（前後 ' + h + ' 個ずつ）'}}}));
    P[1].set({title: '注目セルのまわりを拡大', xr: [pos - w - 0.7, pos + w + 0.7], yr: [-15, 45], xl: '距離セルの番号', yl: '強さ [dB]', noHover: true, series: [{name: '参照セル', color: 's1', x: xr, y: yr_, stem: true, base: -15, mk: 3, w: 2}, {name: 'ガードセル・窓の外', color: 'ref', x: xg, y: yg, stem: true, base: -15, mk: 2.5, w: 1.5}, {name: '注目セル', color: 's2', x: [pos], y: [val(pos)], stem: true, base: -15, mk: 4.5, w: 3}],
      hl: [{y: est, label: '参照セルの平均', color: 's1', left: true}, {y: thr, label: 'しきい値 = 平均 +' + fx(thr - est, 1) + ' dB', color: 's2', dash: [6, 3]}]});
    return {hit, tiles: [{k: '参照セルの平均（背景の推定）', v: fx(est, 1) + ' <small>dB</small>'}, {k: 'しきい値', v: fx(thr, 1) + ' <small>dB</small>', s: '平均の ' + ratioTxt(thr - est) + '（係数 α）'}, {k: '注目セル ' + pos + ' の判定', v: hit ? '検出' : '検出なし', s: '強さ ' + fx(val(pos), 1) + ' dB'}]};
  }});

/* 8 */
const _l8 = new Map();
function loss8(n, m){ const k = n + '/' + m; let v = _l8.get(k); if (v === undefined){ v = cfarLoss(0, n, m, 1e-6, 0.9); _l8.set(k, v); } return v; }
STEPS.push({short: 'CFAR 損失', title: 'CFAR 損失 — 背景を「推定」する分だけ、感度が少し下がる', src: 'Adaptive Thresholding（p.7.12、表7.1）',
  q: '参照セルの数を減らすと、同じ探知確率を得るのに必要な S/N はどうなる？',
  ch: ['小さくなる', '変わらない', '大きくなる（損失が増える）'], ans: 2,
  why: '参照セルが少ないと、背景の強さの推定がスキャンごとに大きくばらつきます。たまたま低く見積もったときに誤警報が増えないよう、係数を大きめにする必要があり、その分だけ目標が見つけにくくなります。これが CFAR 損失です。',
  read: {
    ana: 'クラスの平均点を知りたいとき、3 人だけに聞いた平均は、聞く相手によって大きく変わります。30 人に聞けば、ほぼ正しい値になります。あてにならない平均をもとに合格ラインを決めるなら、安全のために余裕を大きく取るしかありません。',
    what: 'CFAR のしきい値は、有限個の参照セルから推定した背景の強さで決めます。推定がばらつく分、背景の強さが正確に分かっている場合より、しきい値を高めにしなければなりません。同じ探知確率を得るために余分に必要な S/N が、[[loss|CFAR 損失（CFAR loss）]]です。||参照セルが多いほど、また足し合わせるパルスが多いほど、損失は小さくなります。図の[[tbl|白い丸]]はハンドブックの表の値です。目安は、損失が 1 dB 未満になるだけの参照セルを使うことです。',
    eq: 'CFAR 損失 [dB] =（CFAR での所要 S/N）−（背景が既知のときの所要 S/N）',
    sym: '所要 S/N：決めた誤警報確率と探知確率（図では 10⁻⁶ と 0.9）を得るのに必要な S/N [dB]。ハンドブックの表7.1 の例：1 パルスで参照セル 10 個なら 3.5 dB、10 パルスで 10 個なら 0.7 dB。',
    mis: '「参照セルは多いほど良い」とは限りません。窓が長くなると、背景の強さが途中で変わったり、別の目標が入り込んだりして、「背景は一様」という前提が崩れます（次のステップ）。'},
  hosoku: ['平均点のたとえ', '損失の計算方法（ゆらぎなし・2 乗検波・セル平均として、所要 S/N の差を計算）'],
  memo: 'つまずきやすい点：損失は「誤警報確率を守るための保険料」であること。||声かけの例：「1 パルスで損失 1 dB 未満にするには、参照セルは何個くらい要る？」「参照セルを 64 個にしたら、窓の長さは距離で何 m になる？（セルの幅しだい）」',
  init: {m: 2, n: 10, pfa: 6}, ctl: ['m'], fixed: ['pfa', 'n'], fixT: ['探知確率 0.9'], plots: [{h: 290}],
  mission: {t: '10 パルスを足し合わせる場合に、CFAR 損失が 1 dB 未満になる、いちばん少ない参照セルの数を見つけよう。', ok: r => r.L < 1 && (S.m <= 2 || loss8(10, S.m - 2) >= 1)}, sol: {m: 8},
  draw(P){
    const ML = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 48, 64], ser = [], pts = [], cols = {1: 's2', 10: 's1'};
    for (const nn of [1, 10]){ const x = [], y = []; for (const mm of ML){ if (nn === 1 && mm < 2) continue; x.push(Math.log2(mm)); y.push(loss8(nn, mm)); } ser.push({name: nn + ' パルス', color: cols[nn], x, y, w: nn === 10 ? 2.6 : 1.6}); for (const mm of [1, 2, 3, 5, 10]) if (TAB71[nn][mm] !== undefined) pts.push({x: Math.log2(mm), y: TAB71[nn][mm], color: cols[nn], hollow: true, r: 4.5, clipY: true}); }
    const L = loss8(10, S.m); pts.push({x: Math.log2(S.m), y: L, color: 's1', r: 6.5, label: fx(L, 2) + ' dB', clipY: true});
    P[0].set({title: 'CFAR 損失と参照セルの数（誤警報確率 10⁻⁶、探知確率 0.9）', xr: [-0.2, 6.2], yr: [0, 12], xl: '参照セルの数', yl: 'CFAR 損失 [dB]（余分に必要な S/N）', xticks: [[0, '1'], [1, '2'], [2, '4'], [3, '8'], [4, '16'], [5, '32'], [6, '64']], series: ser, hl: [{y: 1, label: '目安：1 dB', left: false}], pts,
      marks: {loss: {x0: Math.log2(S.m) - 0.3, x1: Math.log2(S.m) + 0.3, y0: 0, y1: Math.min(11.5, L + 1), t: 'CFAR 損失'}, tbl: {t: '白い丸＝ハンドブックの表7.1 の値'}}, tipx: v => '参照セル ' + fx(Math.pow(2, v), 0) + ' 個', tipy: v => fx(v, 2) + ' dB'});
    return {L, tiles: [{k: 'CFAR 損失（10 パルス、参照セル ' + S.m + ' 個）', v: fx(L, 2) + ' <small>dB</small>', s: '必要な S/N が電力で ' + ratioTxt(L)}, {k: '1 パルスだけの場合', v: fx(loss8(1, S.m), 1) + ' <small>dB</small>', s: '同じ参照セル数で'}]};
  }});

/* 9 */
const _m9 = {key: ''};
function mc9(){ const key = JSON.stringify(S); if (_m9.key !== key){ _m9.key = key; const acc = mcNew(scenario(S), [S.cfar]); mcRun(acc, 400); _m9.pd = acc.det[S.cfar][0] / 400; } return _m9.pd; }
STEPS.push({short: '苦手な場面と対策', title: 'CFAR が苦手な場面と対策 — 参照セルが「一様」でないとき', src: 'Target Suppression（p.7.16–7.17、式7.16）、Nonparametric Detectors（p.7.17–7.18）、Target Resolution（p.7.19–7.20、表7.2）',
  q: '見つけたい目標のすぐ近く（参照セルの中）に、もっと強い別の目標がある。セル平均 CFAR では、弱い方の目標はどうなる？',
  ch: ['変わらず検出できる', '検出されにくくなる', 'かえって検出しやすくなる'], ans: 1,
  why: '強い目標が参照セルに入ると、「周りの平均」が実際の背景より大きく見積もられます。その結果しきい値が持ち上がり、弱い方の目標が届かなくなります。これを目標の抑圧（マスキング）と呼びます。',
  read: {
    ana: 'クラスの平均点で合格ラインを決めるとき、1 人だけ飛び抜けた高得点の人がいると、平均が引き上げられて、ラインが不当に高くなります。「いちばん高い 2 人を除いて平均する」などの工夫で、影響を減らせます。',
    what: 'セル平均 CFAR は、参照セルが注目セルと同じ強さの背景だけ、という前提に立っています。参照セルに[[big|別の目標]]が入ると、[[up9|しきい値が持ち上がり]]、目標が抑圧（target suppression）されます。クラッタの境目でも、同じように前提が崩れます。||対策の考え方は 2 つです。(1) 大きな値をしきい値の計算から除く（大きいものから何個かを除いて平均する、前後のうち平均の小さい側だけを使う）。(2) 対数をとるなどして、大きな値の影響を小さくする（対数ビデオ）。どれも、代わりに損失が少し増えます。',
    eq: '<i>M</i><sub>log</sub> = 1.65·<i>M</i><sub>lin</sub> − 0.65',
    sym: '<i>M</i><sub>log</sub>：対数ビデオの CFAR で必要な参照セルの数。<i>M</i><sub>lin</sub>：同じ損失になる、ふつう（リニア）の CFAR の参照セルの数。対数ビデオは大きな値に強い代わりに、参照セルが約 1.65 倍必要です。',
    mis: '「工夫した CFAR にすれば、どんな場面でも大丈夫」ではありません。除ける個数より多くの目標が入れば効きませんし、どの方式も一様な背景での損失は、セル平均より少し大きくなります。'},
  hosoku: ['平均点から高得点者を除くたとえ', '各方式の係数の求め方（一様な雑音で誤警報確率が設計値になるように決めている）', '探知確率を 400 回の試行で数えていること'],
  memo: 'つまずきやすい点：しきい値の線が、強い目標の「両脇」で持ち上がること（強い目標が参照セルに入る位置）。||声かけの例：「強い目標が 3 つ並んでいたら、『大きい 2 個を除く』はどうなる？」「順位を使う検出器（ハンドブックでは約 2 dB の損失）は、どんな考え方だろう？」',
  init: {snr: 13, t2: true, t2off: 4, s2: 25, cfar: 'ca', pfa: 3, m: 16, g: 1}, ctl: ['cfar'], fixed: ['m'], plots: [{h: 290}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}], do: '方式を切り替えて確かめよう（' + LEG + '）',
  mission: {t: '強い目標の隣にいる目標1 の探知確率（400 回の試行）が、0.5 以上になる方式を選ぼう。', ok: r => r.pd >= 0.5}, sol: {cfar: 'cens'},
  draw(P){
    const sc = scenario(S), d = genScan(sc, S.seed), evC = evalDet(sc, d, 'ca'), ev = S.cfar === 'ca' ? evC : evalDet(sc, d, S.cfar), more = [], pd = mc9();
    if (S.cfar !== 'ca'){ const t = new Float64Array(NC); for (let c = 0; c < NC; c++) t[c] = db10(evC.thr[c]); more.push({name: 'セル平均のしきい値（比較）', color: 'ref', x0: 0, dx: 1, y: t, w: 1.4, dash: [5, 3]}); }
    const cfg = profCfg(sc, d, ev, {title: 'しきい値と判定（目標1 はセル 60、強い目標2 はセル 64）', xr: [30, 100], ymax: 40, thrName: 'しきい値（' + CFARN[S.cfar] + '）', more, marks: {big: {x0: 63, x1: 65, t: '強い別の目標'}, up9: {x0: 52, x1: 76, y0: 8, y1: 30, t: 'しきい値が持ち上がる'}}});
    cfg.pts.forEach(p => { if (p.label && p.x === 60) p.left = true; }); P[0].set(cfg);
    return {pd, msHint: '探知確率 ' + fx(pd, 2), tiles: [{k: '目標1 の探知確率（400 回の試行）', v: fx(pd, 2), s: '強い目標がなければ約 ' + fx(pdCA(0, 1, S.m, lin(S.snr), alphaCA(1, S.m, pfaOf())), 2) + '（セル平均の理論値）'}, {k: 'このスキャンの目標1', v: ev.hits[60] ? '検出' : '見逃し'}, {k: '方式', v: CFARN[S.cfar]}]};
  }});

/* 10 */
const CMB0 = 15, _cm = {key: ''};
function cmSim(){            // クラッタマップ：スキャン 0〜60。目標A は動く（1 スキャンに 1.5 セル）、目標B はスキャン 15 からセル 60 に止まっている
  const key = JSON.stringify([S.pfa, S.snr, S.cnr, S.edge, S.seed]); if (_cm.key === key) return _cm.v;
  const K = 0.875, pfa = pfaOf(), A = cmA(K, 1, pfa), rnd = mulberry32(S.seed * 9973 + 271), s = lin(S.snr), Cc = S.cnr > 0 ? lin(S.cnr) : 0, lev = new Float64Array(NT), map = new Float64Array(NT), Ys = [], Ths = [], cellA = [];
  for (let i = 0; i < NT; i++) lev[i] = 1 + (Cc > 0 && i - MARG >= S.edge ? Cc : 0); for (const c of [30, 100]) lev[c + MARG] += 100;
  const scan = tg => { const Y = new Float64Array(NT); for (let i = 0; i < NT; i++) Y[i] = -lev[i] * Math.log(1 - rnd()); for (const c of tg){ const i = c + MARG, r = Math.sqrt(-lev[i] * Math.log(1 - rnd())), u = 2 * Math.PI * rnd(), re = Math.sqrt(s) + r * Math.cos(u), im = r * Math.sin(u); Y[i] = re * re + im * im; } return Y; };
  for (let k = 0; k < 80; k++){ const Y = scan([]); for (let i = 0; i < NT; i++) map[i] = K * map[i] + Y[i]; }
  let firstMiss = -1;
  for (let k = 0; k <= 60; k++){ const ca = Math.round(12 + 1.5 * k), tg = [ca]; if (k >= CMB0) tg.push(60); const Y = scan(tg), th = new Float64Array(NT); for (let i = 0; i < NT; i++){ th[i] = A * map[i]; map[i] = K * map[i] + Y[i]; } if (k >= CMB0 && firstMiss < 0 && !(Y[60 + MARG] > th[60 + MARG])) firstMiss = k; Ys.push(Y); Ths.push(th); cellA.push(ca); }
  _cm.key = key; _cm.v = {A, K, pfa, Cc, lev, Ys, Ths, cellA, firstMiss}; return _cm.v;
}
STEPS.push({short: 'クラッタマップ', title: 'クラッタマップ — 同じセルの「過去のスキャン」から、しきい値を決める', src: '7.2（p.7.2）、False-Alarm Control（p.7.11）、Clutter Mapping（p.7.18–7.19、式7.17・7.18）',
  q: 'クラッタマップは、セルごとに過去のスキャンの平均を覚えて、しきい値にする。あるときから同じ場所にずっと止まっている目標は、その後どうなる？',
  ch: ['ずっと検出され続ける', '最初は検出されるが、すぐに検出されなくなる', 'だんだん強く検出される'], ans: 1,
  why: '止まっている目標のエコーは、毎スキャン同じセルに入るので、マップの値を押し上げます。すると、しきい値が目標の強さの上まで上がり、検出されなくなります（この例では、現れた次のスキャンから）。動いている目標は、毎回別のセルに入るので、取り込まれません。',
  read: {
    ana: '毎日通る道の景色は、見慣れると気にとまらなくなります。ある日、新しい看板が立つと最初は目に入りますが、数日たつと、それも景色の一部になって気にならなくなります。一方、道を横切る猫は、毎回違う場所にいるので、いつも目にとまります。',
    what: 'クラッタマップ（clutter map）は、セルごとに過去のスキャンの受信の強さを平均して記憶し、それに係数を掛けたものを[[mapthr|しきい値]]にします。CFAR が「周りのセル」を見るのに対し、クラッタマップは「同じセルの過去」を見ます。||そのため、背景が場所ごとに大きく違っても、時間的に変わらなければ正しく働きます。図のセル 30 と 100 には、建物のような強い[[pc|点状のクラッタ]]がありますが、誤警報になりません。レーダが動かず、周波数が一定のときに有効です。',
    eq: '<i>S</i><sub>i</sub> = <i>K</i>·<i>S</i><sub>i−1</sub> + <i>X</i><sub>i</sub>　　しきい値 = <i>A</i>·<i>S</i><sub>i−1</sub>',
    sym: '<i>S</i><sub>i</sub>：<i>i</i> 回目のスキャン後のマップの値。<i>X</i><sub>i</sub>：<i>i</i> 回目のスキャンの受信の強さ。<i>K</i>：1 より少し小さい係数（7/8 なら、過去およそ 8 スキャンの平均にあたる）。<i>A</i>：誤警報確率で決まる係数。',
    mis: '「クラッタマップがあれば、クラッタの中の目標も見える」わけではありません。見えるのは、クラッタより強い目標か、クラッタのないセルを通る目標です。クラッタそのものを消す処理ではありません。'},
  hosoku: ['見慣れた景色のたとえ', '止まっている目標がマップに取り込まれるという実験（目標B）と、点状クラッタを置いた場面設定', '係数 A の求め方', '1 スキャン 1 サンプル（積分なし）・K = 7/8 で計算していること'],
  memo: 'つまずきやすい点：下の図の横軸は「時間（スキャンの回数）」。上の図とは軸が違う。||声かけの例：「目標B が現れた直後の数スキャンは検出できている。なぜ？」「第2回のステップ10 のクラッタマップと、同じ点・違う点は？」',
  init: {snr: 12, cnr: 15, edge: 120, pfa: 3, ks: 10}, ctl: ['ks'], fixed: ['snr', 'cnr', 'pfa'], fixT: ['マップの重み K = 7/8（約 8 スキャン分の平均）'], plots: [{h: 230}, {h: 170}], do: 'スライダーを動かして確かめよう（' + LEG + '）',
  acts: [{t: '▶ 再生', play: {k: 'ks', min: 0, max: 60, step: 1, ms: 260, once: true}}, {t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: '止まっている目標B は、スキャン 15 に現れる。初めて見逃されるスキャンを探して、スライダーをその回に合わせよう。', ok: r => S.ks === r.firstMiss}, sol: {},
  draw(P){
    const v = cmSim(), k = S.ks, Y = v.Ys[k], th = v.Ths[k], sc = {n: 1, tg: [{id: 'A', cell: v.cellA[k]}].concat(k >= CMB0 ? [{id: 'B', cell: 60}] : []), C: v.Cc, edge: S.edge}, hits = new Uint8Array(NC), isT = new Uint8Array(NC), thr = new Float64Array(NC);
    for (const t of sc.tg) isT[t.cell] = 1; for (let c = 0; c < NC; c++){ thr[c] = th[c + MARG]; hits[c] = Y[c + MARG] > thr[c] ? 1 : 0; }
    P[0].set(profCfg(sc, {Y}, {thr, hits, isT}, {title: 'スキャン ' + k + ' 回目：受信の強さと、クラッタマップによるしきい値', ymax: 40, thrName: 'しきい値（セルごとの過去の平均から）', marks: {mapthr: {t: 'しきい値'}, pc: {x0: 28, x1: 32, t: '点状のクラッタ'}}}));
    const hx = [], hv = [], ht = []; for (let j = 0; j <= 60; j++){ hx.push(j); hv.push(db10(v.Ys[j][60 + MARG])); ht.push(db10(v.Ths[j][60 + MARG])); }
    P[1].set({title: '目標B のセル（セル 60）を、スキャンごとに見たもの', xr: [0, 60], yr: [-12, 28], xl: 'スキャンの回数（時間の順）', yl: '強さ [dB]', series: [{name: 'このセルの受信の強さ', color: 's1', x: hx, y: hv, w: 1.3, mk: 2.4}, {name: 'しきい値', color: 's2', x: hx, y: ht, w: 2}], vl: [{x: CMB0, label: '目標B が現れる'}, {x: k, label: 'いま', color: 'text2', dash: [2, 2]}], tipx: x => Math.round(x) + ' 回目', tipy: y => fx(y, 1) + ' dB'});
    return {firstMiss: v.firstMiss, tiles: [{k: 'いまのスキャンの目標B', v: k < CMB0 ? 'まだいない' : hits[60] ? '検出' : '見逃し', s: 'セル 60 に止まっている'}, {k: 'いまのスキャンの目標A', v: hits[v.cellA[k]] ? '検出' : '見逃し', s: 'セル ' + v.cellA[k] + '（動いている）'}, {k: 'マップが平均しているスキャン数', v: '約 8 <small>回分</small>', s: 'K = 7/8'}]};
  }});
STEPS[STEPS.length - 1].solFn = () => ({ks: cmSim().firstMiss});

/* 11 */
const _mg = new Map();
function mergeCurve(){ const key = String(S.pfa); let c = _mg.get(key); if (c) return c; const T = thresholdFor(1, pfaOf()), x = [], two = []; for (let sp = 0.5; sp <= 4.001; sp += 0.25){ x.push(sp); two.push(mergeProb(sp, 100, 100, T, 600, 9000).two); } c = {x, two}; _mg.set(key, c); return c; }
STEPS.push({short: '発展：プロット抽出', title: '発展 — 検出をまとめる（プロット抽出）と、2 つの目標の見分け', src: 'Target Resolution（p.7.19–7.21、表7.2、図7.22）、式7.11（p.7.11）、p.7.22',
  q: '同じ強さの 2 つの目標が、パルス幅の 1.5 倍だけ離れている。「隣り合った検出は 1 つにまとめる」処理をすると、多くの場合どうなる？',
  ch: ['2 つの目標として出力される', '1 つの目標にまとまって出力される', 'どちらも出力されない'], ans: 1,
  why: '2 つのエコーのすそが重なり、間のセルもしきい値を超えるので、検出がひと続きになります。ひと続きの検出は 1 つにまとめるので、1 つの目標として出力されます。ハンドブックでは、2 つに分かれる確率が 0.9 を超えるのは、間隔がパルス幅の 2.5 倍になってからとされています。',
  read: {
    ana: '夜の道路を遠くから見ると、車のヘッドライトは 2 つの光が 1 つににじんで見えます。近づいて 2 つの光の間に暗いすき間が見えたとき、初めて「2 つある」と分かります。',
    what: '1 つの目標は、ふつう隣り合う複数のセルでしきい値を超えます。そのまま出力すると 1 つの目標が何個もの検出になるので、[[plot|隣り合う検出をまとめて 1 つ]]にし、その[[cen|重心]]を目標の位置とします。||この処理は、1 つの目標を 2 つに割らないように作ります。その結果、近くにいる 2 つの目標は 1 つにまとまりやすくなり、距離の分解能は悪くなります。なお、ドップラ処理をするレーダでは、CPI 1 回分の出力を「1 パルス」とみなせば、ここまでの検出の話がそのまま使えます。',
    eq: '重心 = Σ（強さ × 位置） / Σ（強さ）',
    sym: 'Σ：まとめた検出のセルすべてについて足す、という意味。強さの大きいセルほど、位置の計算に大きく効きます。{H}ハンドブックには、方位について同じ形の式（式7.11）が書かれています。距離方向の重心は、それにならった計算です。',
    mis: '「分解能は波形（帯域）だけで決まる」わけではありません。検出をまとめる処理のしかたでも変わります。第1回で学んだ c/(2B) は、まとめる処理をする前の話です。'},
  hosoku: ['ヘッドライトのたとえ', 'パルスの形・サンプル間隔・位相差・固定しきい値などの簡単なモデル（ハンドブックの図7.22 は、対数ビデオで平均の小さい側の参照セルを使う検出器の結果）', '距離方向の重心の計算'],
  memo: 'つまずきやすい点：2 つの目標のエコーは、位相差によって強め合ったり打ち消し合ったりする。だから同じ間隔でも、分かれるときと分かれないときがある。||声かけの例：「間隔 2 倍のとき、何回に 1 回くらい分かれる？」「目標がもっと強かったら、分かれやすくなる？ なりにくくなる？」',
  init: {sep: 1.5, pfa: 4}, ctl: ['sep'], fixed: ['pfa'], fixT: ['2 つの目標の強さ どちらも S/N 20 dB（電力 100 倍）'], plots: [{h: 210}, {h: 190}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: '2 つの目標が、9 割以上の確率で 2 つに分かれて出力される、いちばん小さい間隔を見つけよう。', ok: r => r.p2 >= 0.9 && r.pPrev < 0.9}, sol: {sep: 2.5},
  draw(P){
    const T = thresholdFor(1, pfaOf()), tg = mergeTargets(S.sep, 100, 100), Pw = mergeScan({tg}, S.seed + 31), plots = extractPlots(Pw, T), X = i => (i - NM / 2) / SPC, y = new Float64Array(NM), c = mergeCurve(), ix = Math.round((S.sep - 0.5) / 0.25), p2 = c.two[ix], pPrev = ix > 0 ? c.two[ix - 1] : 0;
    for (let i = 0; i < NM; i++) y[i] = db10(Pw[i]); const near = plots.filter(q => q.c >= tg[0].pos - 3 && q.c <= tg[1].pos + 3);
    P[0].set({title: '距離ごとの受信の強さと、まとめた検出（緑の帯）', xr: [-8, 8], yr: [-15, 32], xl: '距離（パルス幅を 1 とする）', yl: '強さ [dB]（雑音 = 0）', series: [{name: '受信の強さ', color: 's1', x0: X(0), dx: 1 / SPC, y, w: 1.5, mk: 2.2}], hl: [{y: db10(T), label: 'しきい値', color: 's2', dash: [6, 3]}],
      bands: plots.map(q => ({x0: X(q.i0 - 0.5), x1: X(q.i1 + 0.5), color: 'band3'})), vl: tg.map(t => ({x: X(t.pos), color: 'text2', dash: [3, 3]})), pts: plots.map(q => ({x: X(q.c), y: db10(T), color: 's3', r: 5.5})), notes: [{x: 0, y: 28, t: near.length >= 2 ? '2 つに分かれた' : '1 つにまとまった', dx: 60, dy: 0}],
      marks: {plot: {x0: near.length ? X(near[0].i0 - 0.5) : -1, x1: near.length ? X(near[near.length - 1].i1 + 0.5) : 1, t: 'まとめた検出'}, cen: {x0: near.length ? X(near[0].c) - 0.3 : -0.3, x1: near.length ? X(near[0].c) + 0.3 : 0.3, y0: db10(T) - 4, y1: db10(T) + 4, t: '重心'}}, tipx: v => fx(v, 2), tipy: v => fx(v, 1) + ' dB'});
    P[1].set({title: '2 つに分かれて出力される割合（各 600 回の試行）', xr: [0.5, 4], yr: [0, 1.05], xl: '2 つの目標の間隔（パルス幅を 1 とする）', yl: '2 つに分かれる割合', series: [{name: '2 つに分かれる割合', color: 's1', x: c.x, y: c.two, w: 2, mk: 2.8}], hl: [{y: 0.9, label: '0.9', left: true}], vl: [{x: S.sep, label: 'いまの間隔', color: 'text2', dash: [2, 2]}], pts: [{x: S.sep, y: p2, color: 's1', r: 6, label: fx(p2, 2), left: S.sep > 3}], tipx: v => '間隔 ' + fx(v, 2), tipy: v => fx(v, 2)});
    return {p2, pPrev, tiles: [{k: 'このデータでの出力', v: near.length + ' <small>個の目標</small>', s: '本当は 2 個'}, {k: '2 つに分かれる割合（この間隔）', v: fx(p2, 2), s: '600 回の試行'}]};
  }});

/* 12 */
const _mc = {key: '', acc: null};
function mcKey(){ return JSON.stringify([S.det, S.pfa, S.snr, S.sw, S.n, S.m, S.g, S.cnr, S.edge]); }
function mcGet(){ const k = mcKey(); if (_mc.key !== k){ _mc.key = k; _mc.acc = mcNew(scenario(S), [S.det]); } return _mc.acc; }
function checkTable4(){
  const R = runChecks(), lab = {ok: '<span class="ok">一致</span>', info: '<span class="info">差あり</span>', ng: '<span class="ng">不一致</span>'}, sb = t => String(t).replace(/P_D/g, 'P<sub>D</sub>').replace(/P_fa/g, 'P<sub>fa</sub>').replace(/P_N/g, 'P<sub>N</sub>');
  let h = '<h3>ハンドブックの値との照合</h3><p class="sym">「差あり」は、条件の違いなどで差があるものです（理由は備考）。</p><div class="tw"><table class="t"><tr><th>項目</th><th>ハンドブック（基準）</th><th>このシミュレータ</th><th>判定</th><th>備考</th></tr>';
  for (const r of R) h += '<tr><td>' + sb(r.item) + '</td><td>' + sb(r.ref) + '</td><td>' + sb(r.calc) + '</td><td>' + lab[r.st] + '</td><td><small>' + r.note + '</small></td></tr>';
  return h + '</table></div>';
}
STEPS.push({short: '自由実験', title: '自由実験とまとめ — 試行を繰り返して、確率を確かめる', src: '第7章 7.1 Introduction、7.2 Automatic Detection（p.7.1–7.22）', free: true,
  q: '試行を 1,000 回から 11,000 回に増やす。実測した探知確率の「95% 区間」の幅は、およそどうなる？',
  ch: ['ほとんど変わらない', 'およそ 1/3 になる', 'およそ 1/11 になる'], ans: 1,
  why: '{H}割合のばらつきは、試行回数の平方根に反比例します。回数を 11 倍にすると、幅は 1/√11、およそ 1/3 になります。誤警報確率のような小さい確率を確かめるには、それだけ多くの試行が必要です。', do: '全部のパラメータを自由に動かせます。「試行」を押すと、乱数を変えたスキャンを繰り返して確率を数えます（' + LEG + '）',
  read: {
    ana: 'コインを 10 回投げて表が 7 回出ても、「表の出る確率は 0.7」とは言い切れません。1,000 回、10,000 回と投げるほど、割合は本当の確率に近づきます。探知確率と誤警報確率も、同じように試行を重ねて確かめます。',
    eq: '<i>P</i><sub>D</sub>（実測）=（検出した回数）/（試行の回数）',
    sym: '試行の回数：乱数を変えてスキャンを繰り返した回数。検出した回数：そのうち、目標のセルがしきい値を超えた回数。{H}実測の値には試行回数に応じたばらつきがあり、95% 信頼区間で表します。',
    what: '検出の流れをまとめます。検波 → 何パルスか足し合わせる（積分）→ 背景に合わせたしきい値（CFAR・クラッタマップ）と比べる → 隣り合う検出をまとめる → 追尾へ。||覚えておきたい関係は 4 つです。(1) 誤警報と見逃しは、片方を減らすともう片方が増える。(2) 足し合わせると、弱い目標でも見つけやすくなる。(3) CFAR は、周りのセルから背景を推定してしきい値を決める。推定の分だけ損失がある。(4) 参照セルが一様でないと、CFAR は誤警報や見逃しを起こす。',
    mis: '1 スキャンの結果だけで「見つかる・見つからない」を判断しないでください。確率は、何度も試行して初めて分かります。「試行」ボタンで数えた値には、試行回数に応じたばらつき（95% 信頼区間）があります。'},
  hosoku: ['コイン投げのたとえ', '実測の確率の式と、ばらつきが試行回数の平方根に反比例すること', 'まとめの 4 つの関係の整理のしかた', 'モンテカルロ試行と 95% 信頼区間（ウィルソンの方法）'],
  memo: '声かけの例：「試行 1,000 回で数えた誤警報確率は、ねらった値とぴったり一致する？ しないのはなぜ？」「固定しきい値とセル平均 CFAR で、クラッタの区間の誤警報確率を比べてみよう」',
  init: {det: 'ca', cnr: 15, edge: 120, t3: true, s3: 30, snr: 10, pfa: 3, n: 1, m: 16, g: 1, sw: 0}, ctl: ['det', 'pfa', 'snr', 'sw', 'n', 'm', 'cnr', 'edge'], fixed: [], plots: [{h: 270}],
  acts: [{t: '試行 +1,000 回', f: () => { mcRun(mcGet(), 1000); }}, {t: '試行 +10,000 回', f: () => { mcRun(mcGet(), 10000); }}, {t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: 'セル平均 CFAR で、雑音の中の目標1 の探知確率が 0.9 以上になる設定を作り、1,000 回以上の試行で確かめよう。雑音だけの領域の誤警報確率が、ねらった値の 2 倍以内であることも確かめよう。', ok: r => S.det === 'ca' && r.N >= 1000 && r.pd1 >= 0.9 && r.pfaN <= 2 * pfaOf()}, sol: {snr: 16}, solClicks: [0],
  extra: checkTable4,
  draw(P){
    const sc = scenario(S), d = genScan(sc, S.seed), ev = evalDet(sc, d, S.det), acc = mcGet(), N = acc.trials, th = theory(sc, S.det), k1 = acc.det[S.det][0], kf = acc.fa[S.det][0], nf = acc.ncls[0] * N, w1 = wilson(k1, N), wf = wilson(kf, nf), kc = acc.fa[S.det][1], nc = acc.ncls[1] * N;
    P[0].set(profCfg(sc, d, ev, {title: (S.det === 'ca' ? 'セル平均 CFAR' : '固定しきい値') + 'による判定（1 スキャン分）', ymax: Math.max(35, S.cnr + 25), thrName: 'しきい値'}));
    return {N, pd1: N ? k1 / N : 0, pfaN: nf ? kf / nf : 1, msHint: N ? '試行 ' + N + ' 回' : 'まだ試行していない', tiles: [
      {k: '目標1 の探知確率：理論', v: fx(th.pd[0], 3), s: N ? '試行 ' + fx(k1 / N, 3) + '（95% 区間 ' + fx(w1[0], 3) + '〜' + fx(w1[1], 3) + '、' + N + ' 回）' : '「試行」を押すと数えます'},
      {k: '誤警報確率（雑音だけの領域）：ねらい', v: fP(th.pfa[0]), s: N ? '試行 ' + fP(kf / nf) + '（95% 区間 ' + fP(wf[0]) + '〜' + fP(wf[1]) + '）' : ''},
      sc.C > 0 ? {k: '誤警報確率（クラッタの内側）：理論', v: fP(th.pfa[1]), s: N && nc ? '試行 ' + fP(kc / nc) : ''} : null,
      {k: 'このスキャン', v: '検出 ' + ev.nDet + '・見逃し ' + ev.nMiss, s: '誤警報 ' + ev.nFa + ' 個'}]};
  }});
boot();
</script>
</body>
</html>
