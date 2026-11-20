/* ============================================================
   第4回 自動検出とCFAR：ステップの定義
   ============================================================ */
function resetS(init){ const d = cloneDef(); for (const k in S) delete S[k]; Object.assign(S, d, {up: 0, pos: 60, ks: 10, sep: 1.5, det: 'ca', cnr: 0, t3: false}, init); }
const PRE = ['db', 'prob', {no: 3, step: 5, t: '距離や速度のセルごとに判定するという考え方：'}];
const SUPC = {'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻'};
const sup = n => String(n).split('').map(c => SUPC[c] || c).join('');
function fP(p){ if (!(p === p)) return '—'; if (p <= 0) return '0'; if (p >= 0.00995) return fx(p, 3); let e = Math.floor(Math.log10(p)), m = p / Math.pow(10, e); if (m >= 9.95){ m = 1; e++; } return fx(m, 1) + '×10' + sup(e); }
const fOne = p => p >= 0.1 ? fx(p * 100, 0) + '%' : '1/' + (1 / p >= 9950 ? fx(1 / p / 1e4, 1 / p >= 99500 ? 0 : 1) + ' 万' : fx(1 / p, 0));
const pfaOf = () => Math.pow(10, -S.pfa);
const CT = {
  pfa: {l: 'しきい値のレベル（誤警報確率の設計値）', min: 1, max: 8, step: 0.5, f: v => fP(Math.pow(10, -v)) + '（' + fOne(Math.pow(10, -v)) + '）', h: v => 'しきい値：雑音の平均 +' + fx(db10(thresholdFor(S.n, Math.pow(10, -v)) / S.n), 1) + ' dB'},
  snr: {l: '目標の強度（1 パルスの S/N）', min: -5, max: 25, step: 0.5, f: v => dbx(v)},
  sw: {l: '目標の RCS 変動', seg: [[0, '非変動'], [1, 'スキャンごとに変動（Swerling 1）']]},
  n: {l: '積分するパルス数 n', min: 1, max: 32, step: 1, f: v => fx(v, 0) + ' パルス'},
  M: {l: '「検出」とする回数 M（8 回のうち）', min: 1, max: 8, step: 1, f: v => '8 回中 ' + fx(v, 0) + ' 回以上'},
  m: {l: '参照セルの数', min: 2, max: 64, step: 2, f: v => fx(v, 0) + ' 個', h: v => '注目セルの前後に ' + v / 2 + ' 個ずつ'},
  g: {l: 'ガードセルの数（片側）', min: 0, max: 4, step: 1, f: v => fx(v, 0) + ' 個'},
  cnr: {l: 'クラッタの強度（雑音との比）', min: 0, max: 30, step: 1, f: v => v > 0 ? dbx(v, 0) : 'なし'},
  edge: {l: 'クラッタが始まる位置', min: 40, max: 170, step: 1, f: v => 'セル ' + fx(v, 0)},
  up: {l: 'しきい値を全体に上げる量', min: 0, max: 30, step: 0.5, f: v => '+' + dbx(v)},
  pos: {l: '注目セルの位置', min: 0, max: 199, step: 1, f: v => 'セル ' + fx(v, 0)},
  cfar: {l: 'しきい値の決定方法', seg: [['ca', 'セル平均'], ['cens', '大きい 2 個を除外'], ['min', '平均が小さい側を使用'], ['log', '対数ビデオ']]},
  det: {l: 'しきい値の種類', seg: [['fixed', '固定'], ['ca', 'セル平均 CFAR']]},
  ks: {l: 'スキャンの回数（時間）', min: 0, max: 60, step: 1, f: v => fx(v, 0) + ' 回目'},
  sep: {l: '2 つの目標の間隔', min: 0.5, max: 4, step: 0.25, f: v => 'パルス幅の ' + fx(v, 2) + ' 倍'},
  s2: {l: '近くの強い目標の強度', min: 0, max: 40, step: 1, f: v => dbx(v, 0)}
};
const CAX = {xl: '距離セルの番号（左が近距離、右が遠距離）', yl: '受信強度 [dB]（雑音の平均 = 0）', tipx: v => 'セル ' + Math.round(v), tipy: v => fx(v, 1) + ' dB'};
function profCfg(sc, d, ev, o){        // 距離方向の波形・しきい値・検出の印
  o = o || {}; const n = sc.n, y = new Float64Array(NC), t = new Float64Array(NC), pts = []; for (let c = 0; c < NC; c++){ y[c] = db10(d.Y[c + MARG] / n); if (ev.thr) t[c] = db10(ev.thr[c] / n); }
  const series = [{name: '受信強度', color: 's1', x0: 0, dx: 1, y, w: 1.4}]; if (ev.thr) series.push({name: o.thrName || 'しきい値', color: 's2', x0: 0, dx: 1, y: t, w: 2.2}); for (const s of (o.more || [])) series.push(s);
  for (let c = 0; c < NC; c++) if (ev.hits[c] && !ev.isT[c]) pts.push({x: c, y: y[c], color: 'ng', shape: 'x', r: 3.5});
  for (const tg of sc.tg) pts.push(ev.hits[tg.cell] ? {x: tg.cell, y: y[tg.cell], color: 'ok', r: 5.5, label: '目標' + tg.id} : {x: tg.cell, y: y[tg.cell], color: 'ref', hollow: true, r: 6.5, label: '目標' + tg.id + '（見逃し）'});
  const bands = (o.bands || []).slice(); if (sc.C > 0) bands.push({x0: sc.edge - 0.5, x1: NC, color: 'bandn', label: 'クラッタのある区間'});
  return Object.assign({title: o.title, xr: o.xr || [0, NC - 1], yr: [-15, o.ymax || 30], series, pts, bands, vl: o.vl, notes: o.notes, marks: o.marks}, CAX);
}
const LEG = '●＝正しい検出、○＝見逃し、✕＝誤警報';
const STEPS = [];

/* 1 */
STEPS.push({short: '自動検出とは', title: '自動検出とは — しきい値によって「目標あり／なし」を判定する', src: '7.1 Introduction（p.7.1）、7.2 Automatic Detection（p.7.1–7.3）、False-Alarm Control（p.7.11）',
  q: 'しきい値を下げると、弱い目標の見逃しは減ります。その場合、誤警報（目標がないにもかかわらず「あり」と判定すること）はどうなりますか。',
  ch: ['減る', '変わらない', '増える'], ans: 2,
  why: 'しきい値を下げると、雑音だけのセルも偶然大きな値になった場合にしきい値を超えやすくなります。見逃しと誤警報は一方を減らすと他方が増える関係にあります。そこでレーダでは「誤警報の割合を決めたうえで、できるだけ多くの目標を検出する」という考え方を採ります。',
  read: {
    ana: '火災報知器の感度を上げると、小さな火災も見逃しませんが、調理の湯気でも作動します。感度を下げると誤報は減りますが、実際の火災の検知が遅れます。作動させるレベルを決める線が、しきい値です。',
    what: '自動検出（automatic detection）は、受信信号を距離などのセルに区切り、セルごとに「目標がある」か「雑音だけ」かを計算機が判定する処理です。基本は受信強度を[[thr|ある基準の値]]と比較することであり、この値を{{g-threshold|しきい値}}（threshold）と呼びます。||誤りには 2 種類あります。目標がないにもかかわらず検出する[[fa|誤警報]]と、目標があるにもかかわらず検出しない[[miss|見逃し]]です。誤警報が生じる確率を{{g-probability-of-false-alarm|誤警報確率}}（Pfa）、目標を正しく検出する確率を{{g-probability-of-detection|検出確率}}（Pd）と呼びます。',
    eq: '受信強度 ＞ しきい値　→　「目標あり」と判定',
    sym: '受信強度：そのセルの検波（受信信号から振幅を取り出す処理）後の出力（複数のパルスを積分することもある）。しきい値：誤警報確率の設計値から決める値。誤警報が多すぎると、後段の追尾処理の負荷が過大になります。',
    mis: '「しきい値を超えれば、そこに目標がある」という理解は誤りです。雑音だけでもある確率でしきい値を超えます。検出は確率で考える判定です。'},
  hosoku: ['火災報知器のたとえ', '図の印は乱数で生成した 1 スキャン分のデータに対する結果であること', 'クラッタなし・目標 2 つの場面の設定'],
  memo: 'つまずきやすい点は、誤警報「確率」と、1 スキャンあたりの誤警報の「個数」（= 確率 × セル数）の違いです。||声かけの例：「セルが 200 個で Pfa が 1/100 の場合、誤警報は平均何個ですか」「別のデータにすると ✕ の位置が変わります。それはなぜですか」',
  init: {pfa: 1, snr: 13, t2: true, t2off: 20, s2: 11, n: 1}, ctl: ['pfa'], fixed: ['snr'], fixT: ['もう 1 つの目標の強度 11 dB', '距離セルの数 200 個'], plots: [{h: 280}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}], do: 'スライダーを動かして確かめましょう（' + LEG + '）',
  mission: {t: 'このスキャンで誤警報を 1 個以下にし、かつ 2 つの目標を両方とも検出できるしきい値を見つけましょう。', ok: r => r.ev.nFa <= 1 && r.ev.nMiss === 0}, sol: {pfa: 3},
  draw(P){
    const sc = scenario(S), d = genScan(sc, S.seed), ev = evalDet(sc, d, 'fixed'), Tdb = db10(thresholdFor(1, sc.pfa));
    P[0].set(profCfg(sc, d, ev, {title: '距離ごとの受信強度と、しきい値による判定（1 スキャン分）', marks: {thr: {y0: Tdb - 1.5, y1: Tdb + 1.5, t: 'しきい値'}, fa: {y0: Tdb, y1: 30, t: 'しきい値を超えた雑音＝誤警報'}, miss: {x0: 55, x1: 85, y0: -15, y1: Tdb, t: 'しきい値に達しない目標＝見逃し'}}}));
    return {ev, msHint: '誤警報 ' + ev.nFa + ' 個・見逃し ' + ev.nMiss + ' 個', tiles: [{k: 'このスキャンの誤警報', v: ev.nFa + ' <small>個</small>', s: '平均では 200 セル × ' + fP(sc.pfa) + ' = ' + fx(200 * sc.pfa, 200 * sc.pfa < 10 ? 1 : 0) + ' 個'}, {k: 'このスキャンの目標', v: '検出 ' + ev.nDet + '・見逃し ' + ev.nMiss}, {k: 'しきい値', v: '+' + fx(Tdb, 1) + ' <small>dB</small>', s: '雑音の平均の ' + ratioTxt(Tdb)}]};
  }});

/* 2 */
STEPS.push({short: '振幅の分布', title: '雑音と目標の振幅の分布 — しきい値の右側の面積が、確率になる', src: '7.1（p.7.1）、Optimal Detector（p.7.2–7.3）、式7.10（p.7.8）、レイリー分布の式（p.7.11）',
  q: '「雑音だけ」の場合の振幅の分布で、しきい値より右側の部分の面積は、何を表しますか。',
  ch: ['検出確率', '誤警報確率', 'S/N'], ans: 1,
  why: '雑音だけであるにもかかわらずしきい値を超えることが、誤警報です。このため、雑音の分布のうち、しきい値より右側の面積が誤警報確率になります。同様に、「目標＋雑音」の分布の右側の面積が検出確率です。',
  read: {
    ana: 'クラスの身長の分布を考えます。「170 cm 以上の人」の割合は分布のグラフで 170 cm より右側の面積です。線を右に移せば割合は減り、左に移せば増えます。',
    what: '雑音だけの場合、検波後の振幅は[[noise|レイリー分布]]（原点から立ち上がり、右側に長く裾を引く分布）に従います。目標があると、分布は右へ移ります（非変動目標では[[sig|ライス分布]]）。S/N が大きいほど、2 つの分布は離れます。||2 つの分布は重なっているため、しきい値をどこに設定しても、誤警報と見逃しの両方を 0 にすることはできません。[[tail|しきい値より右側の面積]]が、それぞれの確率です。',
    eq: '<i>T</i> = σ·√( −2·ln <i>P</i><sub>fa</sub> )',
    sym: '<i>T</i>：しきい値（振幅）。σ：雑音の大きさを表す量（I 成分・Q 成分それぞれの標準偏差）。ln：自然対数。<i>P</i><sub>fa</sub>：誤警報確率。P<sub>fa</sub> = 1/1000 の場合は T = 3.72σ です。',
    mis: '「誤警報確率を 10 分の 1 にするには、しきい値を大きく上げる必要がある」という理解は誤りです。実際にはわずかな変更で済みます（1/1000 → 1/1 万で 3.72σ → 4.29σ）。ただし、そのわずかな差によって、検出確率は確実に低下します。'},
  hosoku: ['身長の分布のたとえ', '式7.10 はハンドブックでは 2 値積分の第 1 しきい値の式として記載されていること', '1 パルス（積分なし）で説明していること'],
  memo: 'つまずきやすい点は、「面積＝確率」という読み方です。色を付けた部分を指して確認します。||声かけの例：「しきい値を右に移すと、2 つの面積はそれぞれどうなりますか」「2 つの分布の重なりを減らすには、何を変えればよいですか（S/N、または後のステップで扱う積分）」',
  init: {pfa: 1.5, snr: 10, n: 1}, ctl: ['pfa'], fixed: ['snr'], plots: [{h: 280}],
  mission: {t: '誤警報確率を 1/1000 以下に保ったまま、検出確率が 0.8 以上になるしきい値を見つけましょう。', ok: r => pfaOf() <= 1.0001e-3 && r.pd >= 0.8}, sol: {pfa: 3},
  draw(P){
    const pfa = pfaOf(), T = -Math.log(pfa), Ta = Math.sqrt(2 * T), s = lin(S.snr), Q = x => pd1(0, s, x), pd = Q(T), xmax = 9, NX = 270, xs = [], fn = [], ft = [], tx = [], tn = [], tt = [];
    for (let k = 0; k <= NX; k++){ const x = k * xmax / NX, Pw = x * x / 2, h = 1e-4 * (1 + Pw), lo = Math.max(0, Pw - h), a = x * Math.exp(-x * x / 2), b = x * (Q(lo) - Q(Pw + h)) / (Pw + h - lo); xs.push(x); fn.push(a); ft.push(b); if (x >= Ta){ tx.push(x); tn.push(a); tt.push(b); } }
    P[0].set({title: '振幅の分布としきい値（1 パルス）', xr: [0, xmax], yr: [0, 0.7], xl: '検波後の振幅（雑音の σ を 1 とする）', yl: '確率密度', series: [{x: tx, y: tt, color: 's2', fill: 0.25, w: 0.01, noLegend: true, noTip: true}, {x: tx, y: tn, color: 's1', fill: 0.5, w: 0.01, noLegend: true, noTip: true}, {name: '雑音だけ', color: 's1', x: xs, y: fn, w: 2.2}, {name: '目標＋雑音（S/N ' + fx(S.snr, 0) + ' dB）', color: 's2', x: xs, y: ft, w: 2.2}],
      vl: [{x: Ta, label: 'しきい値 ' + fx(Ta, 2) + 'σ', color: 'text2', w: 1.5, dash: [5, 3]}], notes: [{x: Math.sqrt(2 * s) + 0.6, y: 0.2, t: 'この面積が検出確率 ' + fx(pd, 2), dx: 30, dy: -50}],
      marks: {noise: {x0: 0, x1: 3.5, t: '雑音だけの分布'}, sig: {x0: Math.sqrt(2 * s) - 2.2, x1: Math.sqrt(2 * s) + 2.5, t: '目標＋雑音の分布'}, tail: {x0: Ta, x1: xmax, t: 'しきい値より右側'}}, tipx: v => '振幅 ' + fx(v, 2), tipy: v => fx(v, 3)});
    return {pd, tiles: [{k: '誤警報確率（雑音の分布の右側の面積）', v: fP(pfa), s: fOne(pfa)}, {k: '検出確率（目標＋雑音の右側の面積）', v: fx(pd, 3)}, {k: 'しきい値', v: fx(Ta, 2) + ' <small>σ</small>', s: '電力で雑音の平均 +' + fx(db10(T), 1) + ' dB'}]};
  }});

/* 3 */
STEPS.push({short: 'S/N と検出確率', title: 'S/N と検出確率 — 目標の RCS 変動によって、必要 S/N が変わる', src: '7.1 Introduction（p.7.1）、Optimal Detector（p.7.3）、図7.5（p.7.6）',
  q: '目標のエコーの強度が、スキャンごとに変動するとします（平均の S/N は同じ）。検出確率 0.9 を得るために必要な S/N は、非変動目標と比べてどうなりますか。',
  ch: ['小さくて済む', '同じ', '大きい S/N が必要'], ans: 2,
  why: '変動目標ではエコーが弱くなるスキャンがあります。高い検出確率（0.9 など）を得るには、その場合でもしきい値を超える必要があるため、平均の S/N に大きな余裕が必要です。逆に、低い検出確率ではエコーが強くなるスキャンがある分だけ有利になります。',
  read: {
    ana: '遠くの灯台の光が常に同じ明るさであれば、ある明るさ以上で必ず見えます。光の明るさが変動していると、平均の明るさは同じでも、暗い瞬間には見えません。「10 回中 9 回見える」ためにはより明るい灯台が必要です。',
    what: '誤警報確率を決めると、検出確率は S/N で決まります。この関係は強度が一定の目標（非変動目標）と変動目標とで形が異なります。航空機のような目標は、姿勢がわずかに変わるだけで、エコーの強度が大きく変わります。||図の 2 本の[[curve|曲線]]を比較してください。非変動目標は立ち上がりが急です。変動目標（{{g-swerling-models|Swerling 1}} と呼ばれるモデル）は緩やかであり、[[p9|検出確率 0.9]] に達するには、はるかに大きな S/N が必要です。',
    eq: '<i>P</i><sub>D</sub> = <i>P</i><sub>fa</sub><sup> 1 / (1 + S/N)</sup>',
    sym: '<i>P</i><sub>D</sub>：検出確率。<i>P</i><sub>fa</sub>：誤警報確率。S/N：平均の信号対雑音比（dB ではなく比）。{H}これは 1 パルス・Swerling 1 の場合に成り立つ、一般に知られた式です。ハンドブックのこの部分には、この式そのものの記載はありません。',
    mis: '「S/N が 10 dB あれば必ず検出できる」という理解は誤りです。検出確率は S/N・誤警報確率・目標の RCS 変動の 3 つで決まります。 さらに深く：必要 S/N を計算する方法は、<a href="m01_detection.html">中級 第1回 検出の計算</a>で扱います。'},
  hosoku: ['灯台のたとえ', 'Swerling モデルの定義（スキャンごとに変動し、電力が指数分布に従う）', '式 Pd = Pfa^(1/(1+S/N))（1 パルス・Swerling 1 の一般に知られた式）', 'すべてのパルスが同じ強度であるとして計算していること（ハンドブックの図7.5 はアンテナの走査による変化を含む）'],
  memo: 'つまずきやすい点は、横軸が dB（対数）であることです。3 dB 右へ移ると、S/N は 2 倍になります。||声かけの例：「検出確率 0.5 の位置では、2 本の曲線の差はどの程度ですか。0.9 ではどうですか」「誤警報確率をさらに小さくすると、曲線はどちらへ移ると思いますか」',
  init: {pfa: 3, snr: 8, sw: 0, n: 1}, ctl: ['snr', 'sw'], fixed: ['pfa'], plots: [{h: 290}],
  mission: {t: 'スキャンごとに変動する目標（Swerling 1）で、検出確率が 0.9 以上になる S/N を見つけましょう。', ok: r => S.sw === 1 && r.pd >= 0.9}, sol: {sw: 1, snr: 18.5},
  draw(P){
    const pfa = pfaOf(), T = thresholdFor(1, pfa), xs = [], y0 = [], y1 = []; for (let d = -5; d <= 25.01; d += 0.25){ xs.push(d); y0.push(pdNF(1, lin(d), T)); y1.push(Math.pow(pfa, 1 / (1 + lin(d)))); }
    const f = sw => sw ? Math.pow(pfa, 1 / (1 + lin(S.snr))) : pdNF(1, lin(S.snr), T), pd = f(S.sw);
    P[0].set({title: '検出確率と S/N（誤警報確率 ' + fP(pfa) + '、1 パルス）', xr: [-5, 25], yr: [0, 1], xl: '目標の S/N [dB]（右ほど強い目標）', yl: '検出確率', series: [{name: '非変動', color: 's1', x: xs, y: y0, w: S.sw === 0 ? 3 : 1.6}, {name: 'スキャンごとに変動（Swerling 1）', color: 's2', x: xs, y: y1, w: S.sw === 1 ? 3 : 1.6}], hl: [{y: 0.9, label: '検出確率 0.9', left: true}],
      pts: [{x: S.snr, y: pd, color: S.sw ? 's2' : 's1', r: 6, label: fx(pd, 2), left: pd > 0.7}], marks: {curve: {t: '2 本の曲線'}, p9: {y0: 0.86, y1: 0.94, t: '検出確率 0.9'}}, tipx: v => 'S/N ' + fx(v, 1) + ' dB', tipy: v => fx(v, 3)});
    return {pd, tiles: [{k: '現在の検出確率', v: fx(pd, 3), s: S.sw ? '変動目標' : '非変動目標'}, {k: '同じ S/N でもう一方のモデルの場合', v: fx(f(1 - S.sw), 3)}, {k: 'S/N', v: dbx(S.snr)}]};
  }});

/* 4 */
const pdN = n => pdFixed(0, n, lin(S.snr), thresholdFor(n, pfaOf()));
STEPS.push({short: '積分', title: '積分 — 複数のパルスを加算して、弱い目標を検出できるようにする', src: 'Practical Detectors（p.7.3–7.6、式7.5、図7.3〜7.5）',
  q: '1 パルスでは雑音に埋もれる弱い目標があります。8 パルス分の受信強度を加算してから判定すると、検出確率はどうなりますか（誤警報確率は同じにそろえます）。',
  ch: ['上がる', '変わらない（雑音も同時に加算されるため）', '下がる'], ans: 0,
  why: '加算すると、目標の成分は毎回積み上がります。雑音も加算されますが、大きい値と小さい値が平均されて、変動が小さくなります。このため、しきい値を平均の近くまで下げることができ、弱い目標でもしきい値を超えられるようになります。',
  read: {
    ana: 'サイコロを 1 回振って「6 が出やすいサイコロであるかどうか」を判断することはできませんが、100 回振れば、偏りが明確に分かります。1 回ごとのばらつきは、回数を重ねると平均されて小さくなるためです。',
    what: 'アンテナのビームが目標を通過する間には、多数のパルスが当たります。その受信強度を加算することを{{g-integration|積分}}（integration）と呼びます。代表的な方法が{{g-moving-window-integrator|移動窓積分器}}（moving-window integrator）であり、直近 n パルスの和を、1 パルスごとに更新します。||上の図は 1 つの距離セルをパルスごとに表示したもの、下の図は[[win|移動窓の出力]]です。積分するパルス数を増やすと、雑音の変動が小さくなり、[[tgt4|目標のある区間]]がしきい値を超えるようになります。',
    eq: '<i>S</i><sub>i</sub> = <i>S</i><sub>i−1</sub> + <i>x</i><sub>i</sub> − <i>x</i><sub>i−n</sub>',
    sym: '<i>S</i><sub>i</sub>：<i>i</i> 番目のパルスまでの、直近 <i>n</i> パルスの和。<i>x</i><sub>i</sub>：<i>i</i> 番目のパルスの受信強度。新しい値を加算し、<i>n</i> 個前の値を減算するだけで更新できます。',
    mis: '「n パルスを加算すれば、n 倍弱い目標まで検出できる」という理解は誤りです。検波後に加算する積分（ノンコヒーレント積分）の効果は n 倍より小さくなります。'},
  hosoku: ['サイコロのたとえ', '目標が n パルスの間だけ同じ強度で観測されるとした場面の設定（ビームの形は平坦）', '雑音の変動が平均されるという説明'],
  memo: 'つまずきやすい点は、下の図が「平均」で表示されているため、雑音のレベル（0 dB）は変わらず、変動だけが小さくなることです。||声かけの例：「n を 4 倍にすると、しきい値は何 dB 下がりましたか」「移動窓の弱点は何ですか（強い干渉パルス 1 発。次のステップ）」',
  init: {snr: 3, n: 1, pfa: 3}, ctl: ['n'], fixed: ['snr', 'pfa'], plots: [{h: 150}, {h: 190}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: '検出確率が 0.9 以上になる、最小のパルス数を見つけましょう。', ok: r => r.pd >= 0.9 && (S.n === 1 || pdN(S.n - 1) < 0.9)}, sol: {n: 12},
  draw(P){
    const n = S.n, T = thresholdFor(n, pfaOf()), seq = pulseSeq({n, snr: S.snr, sw: 0}, S.seed), mov = movingSum(seq.x, n), xdb = new Float64Array(NPS), ydb = new Float64Array(NPS - n + 1), pts = [], Tdb = db10(T / n), pd = pdN(n);
    for (let i = 0; i < NPS; i++) xdb[i] = db10(seq.x[i]); for (let i = n - 1; i < NPS; i++){ ydb[i - n + 1] = db10(mov[i] / n); if (mov[i] > T) pts.push(i >= seq.p0 && i <= seq.p0 + 2 * n - 2 ? {x: i, y: ydb[i - n + 1], color: 'ok', r: 3.5} : {x: i, y: ydb[i - n + 1], color: 'ng', shape: 'x', r: 3}); }
    const band = [{x0: seq.p0 - 0.5, x1: seq.p0 + n - 0.5, color: 'band3', label: '目標がある間'}];
    P[0].set({title: '1 つの距離セルの、パルスごとの受信強度', xr: [-1, NPS], yr: [-20, 20], xl: '', yl: '強度 [dB]', series: [{name: '各パルス', color: 's1', x0: 0, dx: 1, y: xdb, stem: true, base: -20, mk: 2, w: 1.2}], bands: band, marks: {tgt4: {x0: seq.p0 - 0.5, x1: seq.p0 + n - 0.5, t: '目標のある区間'}}, noHover: true});
    P[1].set({title: '移動窓の出力（直近 ' + n + ' パルスの平均）としきい値', xr: [-1, NPS], yr: [-8, 14], xl: 'パルスの番号（時間の順）', yl: '強度 [dB]（雑音の平均 = 0）', series: [{name: '移動窓の出力', color: 's1', x0: n - 1, dx: 1, y: ydb, w: 1.8}], hl: [{y: Tdb, label: 'しきい値 +' + fx(Tdb, 1) + ' dB', color: 's2', dash: [6, 3]}], pts, bands: [{x0: seq.p0 - 0.5, x1: seq.p0 + n - 0.5, color: 'band3'}], marks: {win: {t: '移動窓の出力'}}, tipx: v => 'パルス ' + Math.round(v), tipy: v => fx(v, 1) + ' dB'});
    return {pd, tiles: [{k: '検出確率（理論値）', v: fx(pd, 3), s: n + ' パルスの積分'}, {k: 'しきい値', v: '+' + fx(Tdb, 1) + ' <small>dB</small>', s: '雑音の平均の ' + ratioTxt(Tdb)}, {k: '1 パルスだけの場合', v: fx(pdN(1), 3), s: 'S/N ' + fx(S.snr, 0) + ' dB の目標'}]};
  }});

/* 5 */
const pdB = M => pdBinary(0, 8, M, lin(S.snr), binP0(8, M, pfaOf()));
STEPS.push({short: '2 値積分', title: '2 値積分（M-out-of-N）— 強度を加算する代わりに、回数を数える', src: 'Binary Integrator（p.7.7–7.9、式7.9・7.10）、Batch Processor（p.7.10–7.11）、Summary（p.7.20–7.21）',
  q: '8 パルスのうち 1 発だけ、目標ではない極めて強い干渉パルスが混入しました。これによる誤警報が生じにくいのは、どちらの方式ですか。',
  ch: ['8 パルスの強度を加算する方式（移動窓）', 'しきい値を超えた回数を数える方式（2 値積分）', 'どちらも同じ'], ans: 1,
  why: '強度を加算する方式では、1 発が極端に大きいと、それだけで和がしきい値を超えます。回数を数える方式では、どれほど大きくても「1 回」としか数えないため、M 回に達せず、誤警報になりません。',
  read: {
    ana: '多数決を考えます。8 人の審査員のうち 5 人以上が「合格」と言えば合格、という規則であれば、1 人が特に大きな声で「合格」と叫んでも、結果は変わりません。声の大きさではなく、人数で決めるためです。',
    what: '{{g-binary-integration|2 値積分}}（binary integration）は、パルスごとに[[t1|第 1 のしきい値]]と比較して 0 か 1 にし、直近 N パルスのうち 1 が[[cnt|M 個以上]]あれば検出とします。「N 回中 M 回」方式とも呼びます。||強度の情報を使わないため、移動窓より感度はわずかに低下します。その代わり、実装が容易であること・1 発だけの強い干渉の影響を受けにくいこと・雑音の分布が想定と異なる場合にも性能が低下しにくいことが利点です。パルスが 2〜4 個と少ない場合は、この方式が推奨されています。',
    eq: '<i>M</i> ≈ 1.5·√<i>N</i>',
    sym: '<i>M</i>：「検出」とするために必要な回数（第 2 のしきい値）。<i>N</i>：数える対象のパルス数。N = 8 の場合は M ≈ 4.2 です。この目安で選ぶと、最適な M との差は小さい（ハンドブックでは 0.2 dB 以内）とされています。',
    mis: '「M は小さいほど検出しやすい」という理解は誤りです。M を小さくすると、誤警報確率を保つために第 1 のしきい値を高くする必要があり、かえって検出確率が低下します。'},
  hosoku: ['多数決のたとえ', '干渉パルスを 1 発（+30 dB）加えた場面の設定', '検出確率の計算（二項分布）'],
  memo: 'つまずきやすい点は、しきい値が 2 つあることです（パルスごとの第 1、回数の第 2）。M を変えると、第 1 のしきい値もともに変わります。||声かけの例：「M = 1 と M = 8 には、それぞれどのような弱点がありますか」「上の図の赤い線（第 1 のしきい値）は、M を増やすとなぜ下がるのですか」',
  init: {snr: 6, n: 8, M: 1, pfa: 3}, ctl: ['M'], fixed: ['snr', 'pfa'], plots: [{h: 160}, {h: 150}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: '検出確率が最大になる M を見つけましょう（式の目安 1.5·√8 ≈ 4.2 と比較しましょう）。', ok: r => r.best === S.M}, sol: {M: 4},
  draw(P){
    const M = S.M, pfa = pfaOf(), p0 = binP0(8, M, pfa), T1 = -Math.log(p0), T = thresholdFor(8, pfa), seq = pulseSeq({n: 8, snr: S.snr, sw: 0, spike: true}, S.seed), cnt = movingCount(seq.x, 8, T1), mov = movingSum(seq.x, 8), lo = [], lx = [], hi = [], hx = [], pts = [];
    for (let i = 0; i < NPS; i++){ const v = db10(seq.x[i]); if (seq.x[i] > T1){ hx.push(i); hi.push(v); } else { lx.push(i); lo.push(v); } }
    let fooled = false, best = 1; for (let i = 7; i < NPS; i++){ if (cnt[i] >= M) pts.push(i >= seq.p0 && i <= seq.p0 + 14 ? {x: i, y: cnt[i], color: 'ok', r: 3.5} : {x: i, y: cnt[i], color: 'ng', shape: 'x', r: 3}); if (mov[i] > T && i >= seq.spikeAt && i < seq.spikeAt + 8) fooled = true; }
    for (let k = 2; k <= 8; k++) if (pdB(k) > pdB(best)) best = k;
    P[0].set({title: 'パルスごとの受信強度と、第 1 のしきい値', xr: [-1, NPS], yr: [-20, 40], xl: '', yl: '強度 [dB]', series: [{name: '0（しきい値以下）', color: 'ref', x: lx, y: lo, stem: true, base: -20, mk: 2, w: 1.2}, {name: '1（しきい値を超えた）', color: 's2', x: hx, y: hi, stem: true, base: -20, mk: 2.4, w: 1.6}],
      hl: [{y: db10(T1), label: '第 1 のしきい値', color: 's2', dash: [6, 3]}], bands: [{x0: seq.p0 - 0.5, x1: seq.p0 + 7.5, color: 'band3', label: '目標がある間'}], notes: [{x: seq.spikeAt, y: 30, t: '干渉パルス（1 発だけ）', dx: 30, dy: 10}], marks: {t1: {y0: db10(T1) - 3, y1: db10(T1) + 3, t: '第 1 のしきい値'}}, noHover: true});
    P[1].set({title: '直近 8 パルスのうち、1 であった回数', xr: [-1, NPS], yr: [0, 8.6], xl: 'パルスの番号（時間の順）', yl: '回数', series: [{name: '1 の回数', color: 's2', x0: 0, dx: 1, y: cnt, w: 1.8}], hl: [{y: M, label: '検出とする回数 M = ' + M, color: 's1', dash: [6, 3]}], pts, bands: [{x0: seq.p0 - 0.5, x1: seq.p0 + 7.5, color: 'band3'}], marks: {cnt: {y0: M - 0.4, y1: 8.4, t: 'M 個以上'}}, tipx: v => 'パルス ' + Math.round(v), tipy: v => fx(v, 0) + ' 回'});
    return {best, tiles: [{k: '検出確率（2 値積分、理論値）', v: fx(pdB(M), 3), s: '8 回中 ' + M + ' 回以上'}, {k: '1 パルスが「1」になる確率（雑音だけ）', v: fP(p0), s: '全体の誤警報確率を ' + fP(pfa) + ' にする値'}, {k: '強度を加算する方式の場合（同じデータ）', v: fooled ? '干渉で誤警報' : '誤警報なし', s: '検出確率は ' + fx(pdFixed(0, 8, lin(S.snr), T), 3)}]};
  }});

/* 6 */
STEPS.push({short: '固定しきい値の問題点', title: '固定しきい値の問題点 — 背景の強度が場所によって変わると、機能しなくなる', src: '7.2 Automatic Detection（p.7.2）、False-Alarm Control（p.7.11）',
  q: '雑音に合わせて決めたしきい値のまま、雑音の約 30 倍（15 dB）強いクラッタが残留している区間を観測すると、どうなりますか。',
  ch: ['何も起きない', 'その区間で誤警報が多発する', 'その区間の目標が検出しやすくなる'], ans: 1,
  why: 'しきい値は「雑音だけであれば、まれにしか超えないレベル」に設定してあります。背景が 30 倍強い区間では、ほとんどのセルがそのレベルを超え、誤警報が多発します。一方、全体のしきい値を上げると、クラッタのない場所の弱い目標まで見逃します。',
  read: {
    ana: '静かな部屋に合わせて「この大きさ以上の音がしたら知らせる」と設定した装置を工事現場に持ち込むと、鳴り続けることになります。鳴らないように設定を上げると、今度は静かな部屋の小さな物音を検知できなくなります。',
    what: 'ここまでは雑音の強度がどのセルでも同じである、という前提でした。実際には陸地・海面・雨などの[[cl6|クラッタ]]が残留する場所では、背景がはるかに強くなります。固定のしきい値のままでは、膨大な誤警報が生じて、後段の追尾処理の負荷が過大になります。||[[thr6|しきい値]]を全体に上げれば誤警報はなくなりますが、クラッタのない場所の感度まで低下します。必要なのは、場所ごとに背景の強度に合わせたしきい値です。',
    eq: '<i>P</i><sub>fa</sub>（クラッタの中）= <i>P</i><sub>fa</sub>（雑音だけ）<sup> 1 / (1 + C/N)</sup>',
    sym: 'C/N：クラッタと雑音の電力比（dB ではなく比）。{H}この式は 1 パルス・背景がレイリー分布の場合に導かれる関係です。C/N が 15 dB（約 32 倍）の場合、1/1000 が約 0.81 まで増加します。',
    mis: '「誤警報が多ければ、しきい値を上げればよい」という考え方は半分だけ正しいと言えます。誤警報はなくなりますが、全体の感度が背景の最も強い場所に合わせて低下します。'},
  hosoku: ['工事現場のたとえ', 'クラッタを「一定の強度の区間であり、雑音と同じ分布でセルごとに独立」としたモデル', 'クラッタの中の誤警報確率の式'],
  memo: 'つまずきやすい点は、クラッタの区間で生じているのが「目標の検出」ではなく誤警報であることです。||声かけの例：「しきい値を 15 dB 上げると、雑音の中の目標1 の検出確率はいくらになりましたか」「場所ごとに異なるしきい値を使うには、何が分かればよいですか（次のステップ）」',
  init: {cnr: 15, edge: 120, t3: true, s3: 30, snr: 12, pfa: 3, up: 0}, ctl: ['up'], fixed: ['cnr'], plots: [{h: 290}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}], do: 'スライダーを動かして確かめましょう（' + LEG + '）',
  mission: {t: 'クラッタの区間の誤警報を 2 個以下にしましょう。その場合に雑音の中にある目標1 がどうなったかも確かめましょう。', ok: r => r.faC <= 2}, sol: {up: 17},
  draw(P){
    const sc = scenario(S), d = genScan(sc, S.seed), ev = evalDet(sc, d, 'fixed'), th = theory(sc, 'fixed'), Tdb = db10(ev.thr[0]); let faC = 0; for (let c = sc.edge; c < NC; c++) if (ev.hits[c] && !ev.isT[c]) faC++;
    P[0].set(profCfg(sc, d, ev, {title: '固定しきい値による判定（1 スキャン分）', ymax: 45, thrName: 'しきい値（すべてのセルで同じ）', marks: {cl6: {x0: sc.edge, x1: NC - 1, t: 'クラッタ'}, thr6: {y0: Tdb - 1.5, y1: Tdb + 1.5, t: 'しきい値'}}}));
    return {faC, msHint: 'クラッタの区間の誤警報 ' + faC + ' 個', tiles: [{k: 'クラッタの区間の誤警報（このスキャン）', v: faC + ' <small>個</small>', s: '誤警報確率（理論値）' + fP(th.pfa[1])}, {k: '雑音の中の目標1 の検出確率（理論値）', v: fx(th.pd[0], 3), s: ev.hits[sc.tg[0].cell] ? 'このスキャンでは検出' : 'このスキャンでは見逃し'}, {k: 'しきい値', v: '+' + fx(Tdb, 1) + ' <small>dB</small>', s: '雑音の平均の ' + ratioTxt(Tdb)}]};
  }});

/* 7 */
STEPS.push({short: 'セル平均 CFAR', title: 'セル平均 CFAR — 周囲のセルから背景の強度を推定して、しきい値を決める', src: 'Adaptive Thresholding（p.7.11–7.13、図7.12・7.13、式7.12）',
  q: 'セル平均 CFAR は、注目セルの周囲のセルの平均から、しきい値を求めます。背景が 30 倍強いクラッタの区間に入ると、しきい値はどうなりますか。',
  ch: ['変わらない', '背景とともに上がる', '下がる'], ans: 1,
  why: 'しきい値は「周囲のセルの平均 × 一定の係数」です。背景が強い場所では、周囲のセルの平均が大きくなるため、しきい値も同じ割合で上がります。このため、背景の強度によらず、誤警報確率がほぼ一定に保たれます。',
  read: {
    ana: '騒がしい場所でも静かな場所でも、人は「周囲の音より際立って大きい音」に気付きます。周囲が騒がしければ、気付く基準が自然に上がります。セル平均 CFAR は、この「周囲と比較する」判定を計算によって行います。',
    what: '{{g-cell-averaging-cfar|セル平均 CFAR}}（cell-averaging CFAR）は、[[cut|注目セル]]の前後にあるセルの平均から背景の強度を推定し、それに係数を掛けてしきい値にします。平均に使う[[ref|これらのセル]]を{{g-reference-cells|参照セル}}（reference cells）と呼びます。{{g-cfar|CFAR}} は「一定誤警報率」の略です。||前提は参照セルの背景が注目セルと同じ強度であることです。注目セルに隣接するセルは、目標のエコーの漏れ込みを避けるため、参照セルに使いません（ガードセル）。「動かす」を押して、窓が移動していく様子を確かめてください。',
    eq: 'しきい値 = α ×（参照セルの平均）',
    sym: 'α：誤警報確率の設計値と参照セルの数から決まる係数（背景の強度にはよらない）。参照セルの平均：注目セルの前後の参照セルの、受信強度の平均。{H}1 パルス・参照セル m 個の場合、α = m·(P<sub>fa</sub><sup>−1/m</sup> − 1) です。',
    mis: '「CFAR はクラッタを除去する」という理解は誤りです。しきい値をクラッタより上に上げるだけです。クラッタより弱い目標は、CFAR でも検出できません。'},
  hosoku: ['騒がしい場所のたとえ', '「ガードセル」という名称と漏れ込みを避けるという説明（ハンドブックの式7.12・図7.13 でも、両隣の 1 セルは参照セルから除かれている）', '係数 α の式', '2 乗検波（電力）で計算していること'],
  memo: 'つまずきやすい点は、しきい値の線がセルごとに別々に計算した値をつないだものであることです。||声かけの例：「注目セルをクラッタの境界に置くと、しきい値はどうなっていますか」「目標3 を検出できるのは、クラッタより何 dB 強いためですか」',
  init: {cnr: 15, edge: 120, t3: true, s3: 30, snr: 12, pfa: 3, pos: 40, m: 16, g: 1}, ctl: ['pos'], fixed: ['m', 'cnr'], plots: [{h: 250}, {h: 160}], do: 'スライダーを動かして確かめましょう（' + LEG + '）',
  acts: [{t: '▶ 動かす', play: {k: 'pos', min: 0, max: 199, step: 1, ms: 70}}, {t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: '注目セルをクラッタの中にある目標3（セル 145）に合わせて、検出されることを確かめましょう。', ok: r => S.pos === 145 && r.hit}, sol: {pos: 145},
  draw(P){
    const sc = scenario(S), d = genScan(sc, S.seed), ev = evalDet(sc, d, 'ca'), pos = S.pos, h = sc.m / 2, g = sc.g, w = h + g + 4, xr = [], yr_ = [], xg = [], yg = [], val = c => db10(d.Y[c + MARG]);
    for (let c = pos - w; c <= pos + w; c++){ if (c + MARG < 0 || c + MARG >= NT) continue; const a = Math.abs(c - pos); if (a > g && a <= g + h){ xr.push(c); yr_.push(val(c)); } else if (a){ xg.push(c); yg.push(val(c)); } }
    const est = db10(ev.est[pos]), thr = db10(ev.thr[pos]), hit = !!ev.hits[pos];
    P[0].set(profCfg(sc, d, ev, {title: 'セル平均 CFAR のしきい値と判定（1 スキャン分）', ymax: 45, thrName: 'しきい値（セルごとに決定）', bands: [{x0: pos - g - h - 0.5, x1: pos - g - 0.5, color: 'band'}, {x0: pos + g + 0.5, x1: pos + g + h + 0.5, color: 'band'}], vl: [{x: pos, label: '注目セル', color: 'text2', row: 1}],
      marks: {cut: {x0: pos - 1, x1: pos + 1, t: '注目セル'}, ref: {x0: pos - g - h, x1: pos + g + h, t: '参照セル（前後 ' + h + ' 個ずつ）'}}}));
    P[1].set({title: '注目セルの周囲を拡大', xr: [pos - w - 0.7, pos + w + 0.7], yr: [-15, 45], xl: '距離セルの番号', yl: '強度 [dB]', noHover: true, series: [{name: '参照セル', color: 's1', x: xr, y: yr_, stem: true, base: -15, mk: 3, w: 2}, {name: 'ガードセル・窓の外', color: 'ref', x: xg, y: yg, stem: true, base: -15, mk: 2.5, w: 1.5}, {name: '注目セル', color: 's2', x: [pos], y: [val(pos)], stem: true, base: -15, mk: 4.5, w: 3}],
      hl: [{y: est, label: '参照セルの平均', color: 's1', left: true}, {y: thr, label: 'しきい値 = 平均 +' + fx(thr - est, 1) + ' dB', color: 's2', dash: [6, 3]}]});
    return {hit, tiles: [{k: '参照セルの平均（背景の推定値）', v: fx(est, 1) + ' <small>dB</small>'}, {k: 'しきい値', v: fx(thr, 1) + ' <small>dB</small>', s: '平均の ' + ratioTxt(thr - est) + '（係数 α）'}, {k: '注目セル ' + pos + ' の判定', v: hit ? '検出' : '検出なし', s: '強度 ' + fx(val(pos), 1) + ' dB'}]};
  }});

/* 8 */
const _l8 = new Map();
function loss8(n, m){ const k = n + '/' + m; let v = _l8.get(k); if (v === undefined){ v = cfarLoss(0, n, m, 1e-6, 0.9); _l8.set(k, v); } return v; }
STEPS.push({short: 'CFAR 損失', title: 'CFAR 損失 — 背景を推定する分だけ、感度がわずかに低下する', src: 'Adaptive Thresholding（p.7.12、表7.1）',
  q: '参照セルの数を減らすと、同じ検出確率を得るために必要な S/N はどうなりますか。',
  ch: ['小さくなる', '変わらない', '大きくなる（損失が増える）'], ans: 2,
  why: '参照セルが少ないと、背景の強度の推定値が、スキャンごとに大きくばらつきます。推定値が偶然低くなった場合に誤警報が増えないように、係数を大きめにする必要があり、その分だけ目標を検出しにくくなります。これが CFAR 損失です。',
  read: {
    ana: 'クラスの平均点を知りたいとき、3 人だけに聞いた平均は、聞く相手によって大きく変わります。30 人に聞けば、ほぼ正しい値になります。信頼性の低い平均をもとにして合格の基準を決める場合は、安全のために余裕を大きく取るほかありません。',
    what: 'CFAR のしきい値は、有限個の参照セルから推定した背景の強度によって決まります。推定値がばらつく分だけ、背景の強度が正確に分かっている場合より、しきい値を高めにしなければなりません。同じ検出確率を得るために[[loss|余分に必要な S/N]] を{{g-cfar-loss|CFAR 損失}}（CFAR loss）と呼びます。||参照セルが多いほど、また積分するパルス数が多いほど、損失は小さくなります。図の[[tbl|中抜きの丸]]はハンドブックの表の値です。目安は損失が 1 dB 未満になる数の参照セルを使うことです。',
    eq: 'CFAR 損失 [dB] =（CFAR での必要 S/N）−（背景が既知の場合の必要 S/N）',
    sym: '必要 S/N：決めた誤警報確率と検出確率（図では 10⁻⁶ と 0.9）を得るために必要な S/N [dB]。ハンドブックの表7.1 の例では、1 パルスで参照セル 10 個の場合に 3.5 dB、10 パルスで 10 個の場合に 0.7 dB です。',
    mis: '「参照セルは多いほどよい」という理解は誤りです。窓が長くなると、背景の強度が途中で変化したり、別の目標が入ったりして、「背景は一様である」という前提が成り立たなくなります（次のステップ）。'},
  hosoku: ['平均点のたとえ', '損失の計算方法（非変動目標・2 乗検波・セル平均として、必要 S/N の差を計算）'],
  memo: 'つまずきやすい点は、損失が「誤警報確率を保つための代償」であることです。||声かけの例：「1 パルスで損失を 1 dB 未満にするには、参照セルは何個程度必要ですか」「参照セルを 64 個にすると、窓の長さは距離で何 m になりますか（セルの幅によります）」',
  init: {m: 2, n: 10, pfa: 6}, ctl: ['m'], fixed: ['pfa', 'n'], fixT: ['検出確率 0.9'], plots: [{h: 290}],
  mission: {t: '10 パルスを積分する場合に、CFAR 損失が 1 dB 未満になる、最小の参照セルの数を見つけましょう。', ok: r => r.L < 1 && (S.m <= 2 || loss8(10, S.m - 2) >= 1)}, sol: {m: 8},
  draw(P){
    const ML = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 48, 64], ser = [], pts = [], cols = {1: 's2', 10: 's1'};
    for (const nn of [1, 10]){ const x = [], y = []; for (const mm of ML){ if (nn === 1 && mm < 2) continue; x.push(Math.log2(mm)); y.push(loss8(nn, mm)); } ser.push({name: nn + ' パルス', color: cols[nn], x, y, w: nn === 10 ? 2.6 : 1.6}); for (const mm of [1, 2, 3, 5, 10]) if (TAB71[nn][mm] !== undefined) pts.push({x: Math.log2(mm), y: TAB71[nn][mm], color: cols[nn], hollow: true, r: 4.5, clipY: true}); }
    const L = loss8(10, S.m); pts.push({x: Math.log2(S.m), y: L, color: 's1', r: 6.5, label: fx(L, 2) + ' dB', clipY: true});
    P[0].set({title: 'CFAR 損失と参照セルの数（誤警報確率 10⁻⁶、検出確率 0.9）', xr: [-0.2, 6.2], yr: [0, 12], xl: '参照セルの数', yl: 'CFAR 損失 [dB]（余分に必要な S/N）', xticks: [[0, '1'], [1, '2'], [2, '4'], [3, '8'], [4, '16'], [5, '32'], [6, '64']], series: ser, hl: [{y: 1, label: '目安：1 dB', left: false}], pts,
      marks: {loss: {x0: Math.log2(S.m) - 0.3, x1: Math.log2(S.m) + 0.3, y0: 0, y1: Math.min(11.5, L + 1), t: 'CFAR 損失'}, tbl: {t: '中抜きの丸＝ハンドブックの表7.1 の値'}}, tipx: v => '参照セル ' + fx(Math.pow(2, v), 0) + ' 個', tipy: v => fx(v, 2) + ' dB'});
    return {L, tiles: [{k: 'CFAR 損失（10 パルス、参照セル ' + S.m + ' 個）', v: fx(L, 2) + ' <small>dB</small>', s: '必要 S/N が電力で ' + ratioTxt(L)}, {k: '1 パルスだけの場合', v: fx(loss8(1, S.m), 1) + ' <small>dB</small>', s: '同じ参照セル数で'}]};
  }});

/* 9 */
const _m9 = {key: ''};
function mc9(){ const key = JSON.stringify(S); if (_m9.key !== key){ _m9.key = key; const acc = mcNew(scenario(S), [S.cfar]); mcRun(acc, 400); _m9.pd = acc.det[S.cfar][0] / 400; } return _m9.pd; }
STEPS.push({short: 'CFAR に適さない場面と対策', title: 'CFAR に適さない場面と対策 — 参照セルが「一様」でない場合', src: 'Target Suppression（p.7.16–7.17、式7.16）、Nonparametric Detectors（p.7.17–7.18）、Target Resolution（p.7.19–7.20、表7.2）',
  q: '検出したい目標のすぐ近く（参照セルの中）に、より強い別の目標があります。セル平均 CFAR では、弱いほうの目標はどうなりますか。',
  ch: ['変わらずに検出できる', '検出されにくくなる', 'かえって検出しやすくなる'], ans: 1,
  why: '強い目標が参照セルに入ると、「周囲の平均」が実際の背景より大きく推定されます。その結果、しきい値が上がり、弱いほうの目標がしきい値に達しなくなります。これを目標の抑圧（マスキング）と呼びます。',
  read: {
    ana: 'クラスの平均点で合格の基準を決めるとき、1 人だけ特に高得点の人がいると、平均が上がって、基準が不当に高くなります。「最も高い 2 人を除いて平均する」などの方法で影響を低減できます。',
    what: 'セル平均 CFAR は、参照セルが注目セルと同じ強度の背景だけからなる、という前提に基づいています。参照セルに[[big|別の目標]]が入ると、[[up9|しきい値が上がり]]、目標が抑圧（target suppression）されます。クラッタの境界でも、同様に前提が成り立たなくなります。||対策の考え方は 2 つあります。<br>(1) 大きな値をしきい値の計算から除く（大きいものから数個を除いて平均する、前後のうち平均の小さい側だけを使う）<br>(2) 対数を取るなどして、大きな値の影響を小さくする（対数ビデオ）<br>ただし、いずれの方法も一様な背景での損失がわずかに増えます。',
    eq: '<i>M</i><sub>log</sub> = 1.65·<i>M</i><sub>lin</sub> − 0.65',
    sym: '<i>M</i><sub>log</sub>：対数ビデオの CFAR で必要な参照セルの数。<i>M</i><sub>lin</sub>：同じ損失になる、通常（リニア）の CFAR の参照セルの数。対数ビデオは大きな値の影響を受けにくい代わりに、参照セルが約 1.65 倍必要です。',
    mis: '「工夫した CFAR であれば、どのような場面にも対応できる」という理解は誤りです。除外できる個数より多くの目標が入れば効果がなく、どの方式も一様な背景での損失はセル平均よりわずかに大きくなります。'},
  hosoku: ['平均点から高得点者を除くたとえ', '各方式の係数の求め方（一様な雑音で誤警報確率が設計値になるように決めている）', '検出確率を 400 回の試行で数えていること'],
  memo: 'つまずきやすい点は、しきい値の線が強い目標の「両側」で上がることです（強い目標が参照セルに入る位置）。||声かけの例：「強い目標が 3 つ並んでいる場合、『大きい 2 個を除外』する方式はどうなりますか」「順位を使う検出器（ハンドブックでは約 2 dB の損失）は、どのような考え方ですか」',
  init: {snr: 13, t2: true, t2off: 4, s2: 25, cfar: 'ca', pfa: 3, m: 16, g: 1}, ctl: ['cfar'], fixed: ['m'], plots: [{h: 290}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}], do: '方式を切り替えて確かめましょう（' + LEG + '）',
  mission: {t: '強い目標の隣にある目標1 の検出確率（400 回の試行）が、0.5 以上になる方式を選びましょう。', ok: r => r.pd >= 0.5}, sol: {cfar: 'cens'},
  draw(P){
    const sc = scenario(S), d = genScan(sc, S.seed), evC = evalDet(sc, d, 'ca'), ev = S.cfar === 'ca' ? evC : evalDet(sc, d, S.cfar), more = [], pd = mc9();
    if (S.cfar !== 'ca'){ const t = new Float64Array(NC); for (let c = 0; c < NC; c++) t[c] = db10(evC.thr[c]); more.push({name: 'セル平均のしきい値（比較）', color: 'ref', x0: 0, dx: 1, y: t, w: 1.4, dash: [5, 3]}); }
    const cfg = profCfg(sc, d, ev, {title: 'しきい値と判定（目標1 はセル 60、強い目標2 はセル 64）', xr: [30, 100], ymax: 40, thrName: 'しきい値（' + CFARN[S.cfar] + '）', more, marks: {big: {x0: 63, x1: 65, t: '強い別の目標'}, up9: {x0: 52, x1: 76, y0: 8, y1: 30, t: 'しきい値が上がる'}}});
    cfg.pts.forEach(p => { if (p.label && p.x === 60) p.left = true; }); P[0].set(cfg);
    return {pd, msHint: '検出確率 ' + fx(pd, 2), tiles: [{k: '目標1 の検出確率（400 回の試行）', v: fx(pd, 2), s: '強い目標がなければ約 ' + fx(pdCA(0, 1, S.m, lin(S.snr), alphaCA(1, S.m, pfaOf())), 2) + '（セル平均の理論値）'}, {k: 'このスキャンの目標1', v: ev.hits[60] ? '検出' : '見逃し'}, {k: '方式', v: CFARN[S.cfar]}]};
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
  q: 'クラッタマップはセルごとに過去のスキャンの平均を記憶して、しきい値にします。ある時点から同じ場所に静止し続けている目標は、その後どうなりますか。',
  ch: ['検出され続ける', '最初は検出されるが、まもなく検出されなくなる', 'しだいに強く検出される'], ans: 1,
  why: '静止している目標のエコーは、毎スキャン同じセルに入るため、マップの値を上げます。これによって、しきい値が目標の強度より上まで上がり、検出されなくなります（この例では現れた次のスキャンから）。運動している目標は、毎回別のセルに入るため、マップに記憶されません。',
  read: {
    ana: '毎日通る道の景色は、見慣れると意識されなくなります。ある日、新しい看板が立つと最初は目に入りますが、数日後にはそれも景色の一部になって意識されなくなります。一方、道を横切る猫は毎回異なる場所にいるため、常に目に入ります。',
    what: '{{g-clutter-map|クラッタマップ}}（clutter map）は、セルごとに過去のスキャンの受信強度を平均して記憶し、それに係数を掛けたものを[[mapthr|しきい値]]にします。CFAR が「周囲のセル」を参照するのに対して、クラッタマップは「同じセルの過去」を参照します。||このため、背景が場所ごとに大きく異なっていても、時間的に変化しなければ正しく機能します。図のセル 30 と 100 には、建物のような強い[[pc|点状のクラッタ]]がありますが、誤警報になりません。レーダが移動せず、周波数が一定である場合に有効です。',
    eq: '<i>S</i><sub>i</sub> = <i>K</i>·<i>S</i><sub>i−1</sub> + <i>X</i><sub>i</sub>　　しきい値 = <i>A</i>·<i>S</i><sub>i−1</sub>',
    sym: '<i>S</i><sub>i</sub>：<i>i</i> 回目のスキャン後のマップの値。<i>X</i><sub>i</sub>：<i>i</i> 回目のスキャンの受信強度。<i>K</i>：1 よりわずかに小さい係数（7/8 の場合は約 8 スキャン分の過去の平均に当たる）。<i>A</i>：誤警報確率で決まる係数。',
    mis: '「クラッタマップがあれば、クラッタの中の目標も検出できる」という理解は誤りです。検出できるのは、クラッタより強い目標か、クラッタのないセルを通過する目標です。クラッタそのものを除去する処理ではありません。'},
  hosoku: ['見慣れた景色のたとえ', '静止している目標がマップに記憶されるという実験（目標B）と、点状のクラッタを置いた場面の設定', '係数 A の求め方', '1 スキャン 1 サンプル（積分なし）・K = 7/8 で計算していること'],
  memo: 'つまずきやすい点は、下の図の横軸が「時間（スキャンの回数）」であることです。上の図とは軸が異なります。||声かけの例：「目標B が現れた直後のスキャンでは検出できています。それはなぜですか」「第2回のステップ 10 のクラッタマップと、同じ点・異なる点は何ですか」',
  init: {snr: 12, cnr: 15, edge: 120, pfa: 3, ks: 10}, ctl: ['ks'], fixed: ['snr', 'cnr', 'pfa'], fixT: ['マップの係数 K = 7/8（約 8 スキャン分の平均）'], plots: [{h: 230}, {h: 170}], do: 'スライダーを動かして確かめましょう（' + LEG + '）',
  acts: [{t: '▶ 再生', play: {k: 'ks', min: 0, max: 60, step: 1, ms: 260, once: true}}, {t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: '静止している目標B は、スキャン 15 に現れます。最初に見逃されるスキャンを探して、スライダーをその回に合わせましょう。', ok: r => S.ks === r.firstMiss}, sol: {},
  draw(P){
    const v = cmSim(), k = S.ks, Y = v.Ys[k], th = v.Ths[k], sc = {n: 1, tg: [{id: 'A', cell: v.cellA[k]}].concat(k >= CMB0 ? [{id: 'B', cell: 60}] : []), C: v.Cc, edge: S.edge}, hits = new Uint8Array(NC), isT = new Uint8Array(NC), thr = new Float64Array(NC);
    for (const t of sc.tg) isT[t.cell] = 1; for (let c = 0; c < NC; c++){ thr[c] = th[c + MARG]; hits[c] = Y[c + MARG] > thr[c] ? 1 : 0; }
    P[0].set(profCfg(sc, {Y}, {thr, hits, isT}, {title: 'スキャン ' + k + ' 回目：受信強度とクラッタマップによるしきい値', ymax: 40, thrName: 'しきい値（セルごとの過去の平均から）', marks: {mapthr: {t: 'しきい値'}, pc: {x0: 28, x1: 32, t: '点状のクラッタ'}}}));
    const hx = [], hv = [], ht = []; for (let j = 0; j <= 60; j++){ hx.push(j); hv.push(db10(v.Ys[j][60 + MARG])); ht.push(db10(v.Ths[j][60 + MARG])); }
    P[1].set({title: '目標B のセル（セル 60）の、スキャンごとの値', xr: [0, 60], yr: [-12, 28], xl: 'スキャンの回数（時間の順）', yl: '強度 [dB]', series: [{name: 'このセルの受信強度', color: 's1', x: hx, y: hv, w: 1.3, mk: 2.4}, {name: 'しきい値', color: 's2', x: hx, y: ht, w: 2}], vl: [{x: CMB0, label: '目標B が現れる'}, {x: k, label: '現在', color: 'text2', dash: [2, 2]}], tipx: x => Math.round(x) + ' 回目', tipy: y => fx(y, 1) + ' dB'});
    return {firstMiss: v.firstMiss, tiles: [{k: '現在のスキャンの目標B', v: k < CMB0 ? 'まだ現れていない' : hits[60] ? '検出' : '見逃し', s: 'セル 60 に静止'}, {k: '現在のスキャンの目標A', v: hits[v.cellA[k]] ? '検出' : '見逃し', s: 'セル ' + v.cellA[k] + '（運動している）'}, {k: 'マップが平均しているスキャン数', v: '約 8 <small>回分</small>', s: 'K = 7/8'}]};
  }});
STEPS[STEPS.length - 1].solFn = () => ({ks: cmSim().firstMiss});

/* 11 */
const _mg = new Map();
function mergeCurve(){ const key = String(S.pfa); let c = _mg.get(key); if (c) return c; const T = thresholdFor(1, pfaOf()), x = [], two = []; for (let sp = 0.5; sp <= 4.001; sp += 0.25){ x.push(sp); two.push(mergeProb(sp, 100, 100, T, 600, 9000).two); } c = {x, two}; _mg.set(key, c); return c; }
STEPS.push({short: '発展：プロット抽出', title: '発展 — 検出の統合（プロット抽出）と、2 つの目標の分離', src: 'Target Resolution（p.7.19–7.21、表7.2、図7.22）、式7.11（p.7.11）、p.7.22',
  q: '同じ強度の 2 つの目標が、パルス幅の 1.5 倍だけ離れています。「隣接する検出を 1 つに統合する」処理を行うと、多くの場合どうなりますか。',
  ch: ['2 つの目標として出力される', '1 つの目標に統合されて出力される', 'どちらも出力されない'], ans: 1,
  why: '2 つのエコーのスカート部が重なり、間のセルもしきい値を超えるため、検出が連続します。連続した検出は 1 つに統合されるため、1 つの目標として出力されます。ハンドブックでは 2 つに分離する確率が 0.9 を超えるのは、間隔がパルス幅の 2.5 倍になってからであるとされています。',
  read: {
    ana: '夜の道路を遠くから見ると、車のヘッドライトは、2 つの光が 1 つににじんで見えます。近づいて 2 つの光の間に暗い部分が見えたとき、初めて「2 つある」と分かります。',
    what: '1 つの目標は通常、隣接する複数のセルでしきい値を超えます。そのまま出力すると 1 つの目標が複数の検出になるため、[[plot|隣接する検出を 1 つに統合]]し、その[[cen|重心]]を目標の位置とします。||この処理は 1 つの目標を 2 つに分割しないように設計します。その結果、近接した 2 つの目標は 1 つに統合されやすくなり、距離分解能は低下します。なお、ドップラ処理を行うレーダでは、CPI 1 回分の出力を「1 パルス」とみなせば、ここまでの検出の考え方をそのまま使えます。',
    eq: '重心 = Σ（強度 × 位置） / Σ（強度）',
    sym: 'Σ：統合した検出のすべてのセルについて加算することを表します。強度の大きいセルほど、位置の計算に大きく寄与します。{H}ハンドブックには方位について同じ形の式（式7.11）が記載されています。距離方向の重心はこれにならった計算です。',
    mis: '「分解能は波形（帯域幅）だけで決まる」という理解は誤りです。検出を統合する処理の方法によっても変わります。第1回で学んだ c/(2B) は、統合の処理を行う前の値です。'},
  hosoku: ['ヘッドライトのたとえ', 'パルスの形・サンプル間隔・位相差・固定しきい値などの簡略なモデル（ハンドブックの図7.22 は、対数ビデオで平均の小さい側の参照セルを使う検出器の結果）', '距離方向の重心の計算'],
  memo: 'つまずきやすい点は、2 つの目標のエコーが、位相差によって強め合ったり打ち消し合ったりすることです。このため、同じ間隔でも分離する場合としない場合があります。||声かけの例：「間隔が 2 倍の場合、何回に 1 回程度分離しますか」「目標がさらに強い場合、分離しやすくなりますか、しにくくなりますか」',
  init: {sep: 1.5, pfa: 4}, ctl: ['sep'], fixed: ['pfa'], fixT: ['2 つの目標の強度 どちらも S/N 20 dB（電力 100 倍）'], plots: [{h: 210}, {h: 190}], acts: [{t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: '2 つの目標が 9 割以上の確率で 2 つに分離して出力される、最小の間隔を見つけましょう。', ok: r => r.p2 >= 0.9 && r.pPrev < 0.9}, sol: {sep: 2.5},
  draw(P){
    const T = thresholdFor(1, pfaOf()), tg = mergeTargets(S.sep, 100, 100), Pw = mergeScan({tg}, S.seed + 31), plots = extractPlots(Pw, T), X = i => (i - NM / 2) / SPC, y = new Float64Array(NM), c = mergeCurve(), ix = Math.round((S.sep - 0.5) / 0.25), p2 = c.two[ix], pPrev = ix > 0 ? c.two[ix - 1] : 0;
    for (let i = 0; i < NM; i++) y[i] = db10(Pw[i]); const near = plots.filter(q => q.c >= tg[0].pos - 3 && q.c <= tg[1].pos + 3);
    P[0].set({title: '距離ごとの受信強度と、統合した検出（緑の帯）', xr: [-8, 8], yr: [-15, 32], xl: '距離（パルス幅を 1 とする）', yl: '強度 [dB]（雑音 = 0）', series: [{name: '受信強度', color: 's1', x0: X(0), dx: 1 / SPC, y, w: 1.5, mk: 2.2}], hl: [{y: db10(T), label: 'しきい値', color: 's2', dash: [6, 3]}],
      bands: plots.map(q => ({x0: X(q.i0 - 0.5), x1: X(q.i1 + 0.5), color: 'band3'})), vl: tg.map(t => ({x: X(t.pos), color: 'text2', dash: [3, 3]})), pts: plots.map(q => ({x: X(q.c), y: db10(T), color: 's3', r: 5.5})), notes: [{x: 0, y: 28, t: near.length >= 2 ? '2 つに分離した' : '1 つに統合された', dx: 60, dy: 0}],
      marks: {plot: {x0: near.length ? X(near[0].i0 - 0.5) : -1, x1: near.length ? X(near[near.length - 1].i1 + 0.5) : 1, t: '統合した検出'}, cen: {x0: near.length ? X(near[0].c) - 0.3 : -0.3, x1: near.length ? X(near[0].c) + 0.3 : 0.3, y0: db10(T) - 4, y1: db10(T) + 4, t: '重心'}}, tipx: v => fx(v, 2), tipy: v => fx(v, 1) + ' dB'});
    P[1].set({title: '2 つに分離して出力される割合（各 600 回の試行）', xr: [0.5, 4], yr: [0, 1.05], xl: '2 つの目標の間隔（パルス幅を 1 とする）', yl: '2 つに分離する割合', series: [{name: '2 つに分離する割合', color: 's1', x: c.x, y: c.two, w: 2, mk: 2.8}], hl: [{y: 0.9, label: '0.9', left: true}], vl: [{x: S.sep, label: '現在の間隔', color: 'text2', dash: [2, 2], row: 4}], pts: [{x: S.sep, y: p2, color: 's1', r: 6, label: fx(p2, 2), left: S.sep > 3}], tipx: v => '間隔 ' + fx(v, 2), tipy: v => fx(v, 2)});
    return {p2, pPrev, tiles: [{k: 'このデータでの出力', v: near.length + ' <small>個の目標</small>', s: '真の数は 2 個'}, {k: '2 つに分離する割合（この間隔）', v: fx(p2, 2), s: '600 回の試行'}]};
  }});

/* 12 */
const _mc = {key: '', acc: null};
function mcKey(){ return JSON.stringify([S.det, S.pfa, S.snr, S.sw, S.n, S.m, S.g, S.cnr, S.edge]); }
function mcGet(){ const k = mcKey(); if (_mc.key !== k){ _mc.key = k; _mc.acc = mcNew(scenario(S), [S.det]); } return _mc.acc; }
function checkTable4(){
  const R = runChecks(), lab = {ok: '<span class="ok">一致</span>', info: '<span class="info">差あり</span>', ng: '<span class="ng">不一致</span>'}, sb = t => String(t).replace(/P_D/g, 'P<sub>D</sub>').replace(/P_fa/g, 'P<sub>fa</sub>').replace(/P_N/g, 'P<sub>N</sub>');
  let h = '<h3>ハンドブックの値との照合</h3><p class="sym">「差あり」は、条件の違いなどによって差があるものです（理由は備考）。</p><div class="tw"><table class="t"><tr><th>項目</th><th>ハンドブック（基準）</th><th>このシミュレータ</th><th>判定</th><th>備考</th></tr>';
  for (const r of R) h += '<tr><td>' + sb(r.item) + '</td><td>' + sb(r.ref) + '</td><td>' + sb(r.calc) + '</td><td>' + lab[r.st] + '</td><td><small>' + r.note + '</small></td></tr>';
  return h + '</table></div>';
}
STEPS.push({short: '自由実験', title: '自由実験とまとめ — 試行を繰り返して、確率を確かめる', src: '第7章 7.1 Introduction、7.2 Automatic Detection（p.7.1–7.22）', free: true,
  q: '試行を 1,000 回から 11,000 回に増やします。実測した検出確率の「95% 区間」の幅はどの程度になりますか。',
  ch: ['ほとんど変わらない', '約 1/3 になる', '約 1/11 になる'], ans: 1,
  why: '{H}割合のばらつきは、試行回数の平方根に反比例します。回数を 11 倍にすると、幅は 1/√11、すなわち約 1/3 になります。誤警報確率のような小さい確率を確かめるには、その分だけ多くの試行が必要です。', do: 'すべてのパラメータを自由に変えられます。「試行」を押すと、乱数を変えたスキャンを繰り返して確率を数えます（' + LEG + '）',
  read: {
    ana: 'コインを 10 回投げて表が 7 回出ても、「表の出る確率は 0.7 である」とは断定できません。1,000 回、10,000 回と投げるほど、割合は真の確率に近づきます。検出確率と誤警報確率も、同様に試行を重ねて確かめます。',
    eq: '<i>P</i><sub>D</sub>（実測）=（検出した回数）/（試行の回数）',
    sym: '試行の回数：乱数を変えてスキャンを繰り返した回数。検出した回数：そのうち、目標のセルがしきい値を超えた回数。{H}実測値には試行回数に応じたばらつきがあり、95% 信頼区間で表します。',
    what: '検出の流れをまとめます。検波 → 複数のパルスを加算する（積分）→ 背景に合わせたしきい値（CFAR・クラッタマップ）と比較する → 隣接する検出を統合する → 追尾へ、という順です。||重要な関係は次の 4 つです。<br>(1) 誤警報と見逃しは、一方を減らすと他方が増える<br>(2) 積分すると、弱い目標でも検出しやすくなる<br>(3) CFAR は周囲のセルから背景を推定してしきい値を決め、推定の分だけ損失がある<br>(4) 参照セルが一様でないと、CFAR は誤警報や見逃しを生じる',
    mis: '1 スキャンの結果だけで「検出できる・できない」を判断しないでください。確率は何度も試行して初めて分かります。「試行」ボタンで数えた値には、試行回数に応じたばらつき（95% 信頼区間）があります。'},
  hosoku: ['コイン投げのたとえ', '実測の確率の式とばらつきが試行回数の平方根に反比例すること', 'まとめの 4 つの関係の整理のしかた', 'モンテカルロ試行と 95% 信頼区間（ウィルソンの方法）'],
  memo: '声かけの例：「試行 1,000 回で数えた誤警報確率は、設計値と完全に一致しますか。一致しないのはなぜですか」「固定しきい値とセル平均 CFAR とで、クラッタの区間の誤警報確率を比較してみましょう」',
  init: {det: 'ca', cnr: 15, edge: 120, t3: true, s3: 30, snr: 10, pfa: 3, n: 1, m: 16, g: 1, sw: 0}, ctl: ['det', 'pfa', 'snr', 'sw', 'n', 'm', 'cnr', 'edge'], fixed: [], plots: [{h: 270}],
  acts: [{t: '試行 +1,000 回', f: () => { mcRun(mcGet(), 1000); }}, {t: '試行 +10,000 回', f: () => { mcRun(mcGet(), 10000); }}, {t: '別のデータにする', f: () => { S.seed++; }}],
  mission: {t: 'セル平均 CFAR で、雑音の中の目標1 の検出確率が 0.9 以上になる設定を見つけ、1,000 回以上の試行で確かめましょう。雑音だけの領域の誤警報確率が、設計値の 2 倍以内であることも確かめましょう。', ok: r => S.det === 'ca' && r.N >= 1000 && r.pd1 >= 0.9 && r.pfaN <= 2 * pfaOf()}, sol: {snr: 16}, solClicks: [0],
  extra: checkTable4,
  draw(P){
    const sc = scenario(S), d = genScan(sc, S.seed), ev = evalDet(sc, d, S.det), acc = mcGet(), N = acc.trials, th = theory(sc, S.det), k1 = acc.det[S.det][0], kf = acc.fa[S.det][0], nf = acc.ncls[0] * N, w1 = wilson(k1, N), wf = wilson(kf, nf), kc = acc.fa[S.det][1], nc = acc.ncls[1] * N;
    P[0].set(profCfg(sc, d, ev, {title: (S.det === 'ca' ? 'セル平均 CFAR による判定' : '固定しきい値による判定') + '（1 スキャン分）', ymax: Math.max(35, S.cnr + 25), thrName: 'しきい値'}));
    return {N, pd1: N ? k1 / N : 0, pfaN: nf ? kf / nf : 1, msHint: N ? '試行 ' + N + ' 回' : 'まだ試行していない', tiles: [
      {k: '目標1 の検出確率：理論値', v: fx(th.pd[0], 3), s: N ? '試行 ' + fx(k1 / N, 3) + '（95% 区間 ' + fx(w1[0], 3) + '〜' + fx(w1[1], 3) + '、' + N + ' 回）' : '「試行」を押すと数えます'},
      {k: '誤警報確率（雑音だけの領域）：設計値', v: fP(th.pfa[0]), s: N ? '試行 ' + fP(kf / nf) + '（95% 区間 ' + fP(wf[0]) + '〜' + fP(wf[1]) + '）' : ''},
      sc.C > 0 ? {k: '誤警報確率（クラッタの内側）：理論値', v: fP(th.pfa[1]), s: N && nc ? '試行 ' + fP(kc / nc) : ''} : null,
      {k: 'このスキャン', v: '検出 ' + ev.nDet + '・見逃し ' + ev.nMiss, s: '誤警報 ' + ev.nFa + ' 個'}]};
  }});
boot();
</script>
</body>
</html>
