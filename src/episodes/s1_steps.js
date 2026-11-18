/* ============================================================
   第1回 パルス圧縮：ステップの定義
   ============================================================ */
function resetS(init){ for (const k in S) delete S[k]; Object.assign(S, DEFAULTS, {t2: false, pos: 0, nc: 13, r1: 20, noise: false}, init); }
const PRE = ['wave', 'db', 'iq'];
const fkm = v => fx(v, 2) + ' km', fus = v => fx(v, v < 10 && v % 1 ? 1 : 0) + ' µs';
const CT = {
  T: {l: 'パルス幅 T（パルスの長さ）', min: 5, max: 100, step: 5, f: fus, h: v => 'エネルギーは T に比例'},
  B: {l: '帯域 B（周波数を振る幅）', min: 0.2, max: 4, step: 0.1, f: v => fx(v, 1) + ' MHz'},
  wave: {l: '波形', seg: [['cw', '無変調'], ['lfm', 'LFM'], ['barker', 'バーカー13']]},
  wt: {l: '重み付け', seg: [['none', 'なし'], ['taylor', 'テイラー']]},
  dr: {l: '2 つの目標の間隔', min: 30, max: 3000, step: 30, f: v => fx(v, 0) + ' m'},
  snr: {l: '入力の S/N（圧縮する前）', min: -25, max: 10, step: 1, f: v => dbx(v, 0)},
  fd: {l: 'ドップラ周波数', min: -500, max: 500, step: 10, f: v => fx(v, 0) + ' kHz', h: v => v > 0 ? '近づく目標' : v < 0 ? '遠ざかる目標' : '動かない目標'},
  r1: {l: '目標までの距離', min: 0.5, max: 10, step: 0.25, f: fkm},
  a2: {l: '弱い目標の強さ（強い目標との比）', min: -40, max: 0, step: 1, f: v => dbx(v, 0)},
  pos: {l: '参照波形の位置（ずらす時間）', min: 0, max: 60, step: 0.1, f: v => fx(v, 1) + ' µs'},
  nc: {l: '符号の長さ N', seg: [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [7, '7'], [11, '11'], [13, '13']]},
  t2: {l: '目標を 2 つにする', chk: true},
  noise: {l: '雑音を入れる', chk: true}
};
const wav = () => makeWave(S.wave, S.T, S.B, S.nc);
function tgts(){ const t = [{R: S.r1 * 1000, A: 1, ph: 0}]; if (S.t2) t.push({R: S.r1 * 1000 + S.dr, A: db2a(S.a2), ph: Math.PI / 2}); return t; }
function rseg(y, dt, r0, r1){ const k = dt * C / 2000, i0 = Math.max(0, Math.floor(r0 / k)), i1 = Math.min(y.length - 1, Math.ceil(r1 / k)); return {x0: i0 * k, dx: k, y: y.subarray(i0, i1 + 1)}; }
const amp = (re, im) => { const o = new Float64Array(re.length); for (let i = 0; i < o.length; i++) o[i] = Math.hypot(re[i], im[i]); return o; };
const dbA = (m, ref) => { const o = new Float64Array(m.length); for (let i = 0; i < o.length; i++) o[i] = 20 * Math.log10(Math.max(m[i] / ref, 1e-6)); return o; };
const RKM = {xl: '距離 [km]（レーダからの遠さ）', tipx: v => '距離 ' + fx(v, 3) + ' km'};
const STEPS = [];

/* 1 */
STEPS.push({short: 'なぜ圧縮', title: 'なぜパルス圧縮か — 長いパルスの力と、短いパルスの細かさを両立する', src: '§8.1 Introduction（p.8.1–8.2）、§8.2 表8.1（p.8.5）',
  q: '遠くまで見るには、パルスを長くして送るエネルギーを増やしたい。変調なしのままパルスの長さを 2 倍にすると、近くに並んだ 2 つの目標の「見分けやすさ」はどうなる？',
  ch: ['良くなる', '変わらない', '悪くなる（2 倍粗くなる）'], ans: 2,
  why: '変調のないパルスでは、エコーの長さがパルス幅そのものです。長くするほど 2 つのエコーが重なり、1 つの山に見えます。パルス圧縮（LFM）では、見分けやすさは帯域 B で決まるので、長くしても細かさは保たれます。',
  read: {
    ana: '遠くの人に声を届けるには、短く「あ！」と叫ぶより、長く「あーーー」と伸ばした方がたくさんのエネルギーを送れます。でも 2 人が同時に「あーーー」と言うと、声が重なって何人いるのか分かりません。',
    what: 'レーダも同じです。上の図は、変調なしの長いパルスを送ったときの[[merge|2 つの目標のエコー]]です。パルス幅 T が長いと、エコーが重なって 1 つの山になります。||下の図は、同じ長さのパルスに変調をかけ（LFM）、受信側で[[peaks|細いパルスに戻した]]ものです。これがパルス圧縮（pulse compression）で、長いパルスのエネルギーと、短いパルスの細かさを両立できます。',
    eq: '圧縮比 ≈ <i>T</i>·<i>B</i>　　距離分解能 ≈ <i>c</i> / (2<i>B</i>)',
    sym: '<i>T</i>：送信パルスの長さ [秒]。<i>B</i>：変調で広げた帯域 [Hz]。<i>c</i>：光の速さ（3×10⁸ m/s）。<i>T</i>·<i>B</i> は時間帯域幅積（time-bandwidth product）。B = 2 MHz なら分解能は約 75 m で、T にはよりません。',
    mis: '「圧縮するとエネルギーが増える」わけではありません。送ったエネルギーはそのままで、長い時間に広がっていたものを 1 点に集め直すだけです。'},
  hosoku: ['声のたとえ', '下の図で比べている「同じピーク電力の短いパルス」の考え方、無変調パルスの分解能の目安 cT/2'],
  memo: 'つまずきやすい点：エネルギー（T で決まる）と分解能（B で決まる）が別々に選べる、という発想そのもの。||声かけの例：「T を 3 µs まで短くすると分かれて見えるけど、そのとき送ったエネルギーは最初の何分の 1？」「下の図は T を変えても山の細さが変わらないのはなぜ？」',
  init: {T: 20, B: 2, t2: true, dr: 600, a2: 0}, ctl: [{k: 'T', min: 1, max: 20, step: 1}], fixed: ['dr', 'B'], plots: [{h: 190}, {h: 190}],
  mission: {t: '上の図（変調なし）で、600 m 離れた 2 つの目標が 2 つの山に分かれて見えるまで、パルス幅を短くしよう。そのときエネルギーが何分の 1 になったかも見ておこう。', ok: r => r.sep},
  sol: {T: 3},
  draw(P){
    const wc = makeWave('cw', S.T, S.B), sc = makeScene(wc, {targets: tgts(), fd: 0}), a = rseg(amp(sc.re, sc.im), 1 / FS, 19.5, 24.2);
    const wl = makeWave('lfm', S.T, S.B), y = compress(makeScene(wl, {targets: tgts(), fd: 0}), wl, 'none', 4), b = rseg(y.mag, y.dt, 19.5, 24.2), sep = S.T * 150 < S.dr;
    P[0].set(Object.assign({title: '変調なしのパルス：受信したエコーの強さ', xr: [19.5, 24.2], yr: [0, 1.8], yl: 'エコーの強さ（振幅）', series: [{name: '2 つの目標のエコー', color: 's1', x0: a.x0, dx: a.dx, y: a.y, w: 2, fill: 0.15}],
      vl: [{x: 20, label: '目標1'}, {x: 20.6, label: '目標2'}], notes: [sep ? {x: 20.52, y: 0.05, t: 'すき間ができた＝2 つと分かる', dx: 60, dy: -70} : {x: 20.8, y: 1.41, t: '重なって 1 つの山に見える', dx: 50, dy: -14}],
      marks: {merge: {x0: 20, x1: 20.6 + S.T * 0.15, t: '2 つの目標のエコー'}}}, RKM));
    P[1].set(Object.assign({title: '同じ長さのパルスに LFM をかけて圧縮した後', xr: [19.5, 24.2], yr: [0, 1.3], yl: '圧縮後の強さ（振幅）', series: [{name: '圧縮後の出力', color: 's2', x0: b.x0, dx: b.dx, y: b.y, w: 2}],
      notes: [{x: 20.6, y: 1, t: 'いつも 2 本に分かれる', dx: 50, dy: -4}], marks: {peaks: {x0: 19.9, x1: 20.7, t: '細いパルスに戻った'}}}, RKM));
    return {sep, tiles: [{k: '送るエネルギー（T = 20 µs を 1 として）', v: S.T === 20 ? '1 倍' : '1/' + fx(20 / S.T, 1), s: dbx(10 * Math.log10(S.T / 20))},
      {k: '変調なしの見分けの目安 cT/2', v: fx(S.T * 150, 0) + ' <small>m</small>', s: '目標の間隔は 600 m'}, {k: 'LFM の見分けの目安 c/(2B)', v: fx(150 / S.B, 0) + ' <small>m</small>', s: 'T を変えても同じ'}]};
  }});

/* 2 */
STEPS.push({short: 'LFM 波形', title: 'LFM（チャープ）波形 — パルスの中で周波数を直線的に変える', src: '§8.2 Linear Frequency Modulation（p.8.3–8.5、式8.3〜8.6）',
  q: 'LFM のパルスを、基準の周波数を 0 にした形（ベースバンド）で見る。波の振動がいちばん「ゆっくり」になるのは、パルスのどこ？',
  ch: ['パルスの始まり', 'パルスの真ん中', 'パルスの終わり'], ans: 1,
  why: 'LFM は周波数を −B/2 から +B/2 まで直線的に変えます。真ん中で周波数がちょうど 0 を通るので、そこで振動がいちばんゆっくりになります。両端は「負の周波数」と「正の周波数」で、振動の速さは同じです。',
  read: {
    ana: '鳥のさえずりのように、音の高さが「ピューイ」と連続して変わる音をチャープと呼びます。ずっと同じ高さの「ピー」と違い、音のどの部分にも「その瞬間だけの高さ」という目印が付いています。',
    what: '線形周波数変調（linear frequency modulation、LFM）は、パルスの中で[[freq|周波数を直線的に変える]]波形です。変える幅が帯域 B、パルスの長さが T です。||上の図は[[wave|波形の I 成分と Q 成分]]です。真ん中で振動がゆっくりになり、両端で速くなります。B を広げると、両端の振動が速くなります。',
    eq: '<i>f</i>(<i>t</i>) = (<i>B</i> / <i>T</i>)·<i>t</i>　　（−<i>T</i>/2 ≤ <i>t</i> ≤ <i>T</i>/2）',
    sym: '<i>f</i>(<i>t</i>)：時刻 <i>t</i> での周波数（瞬時周波数）[Hz]。<i>t</i>：パルスの真ん中を 0 とした時刻 [秒]。<i>B</i>：帯域 [Hz]。<i>T</i>：パルス幅 [秒]。<i>B</i>/<i>T</i> が周波数の変わる速さ（傾き）。',
    mis: '「真ん中は周波数が低く、両端が高い」わけではありません。前半は負の周波数、後半は正の周波数で、I と Q のどちらが先に進むかが逆になっています。{H}実際の送信では、これに高い搬送波の周波数が足されます。'},
  hosoku: ['鳥のさえずりのたとえ', 'ベースバンドでは真ん中で周波数が 0 を通るため、実部が「速い→遅い→速い」に見えるという説明', '実際の送信では搬送波の周波数が足されること'],
  memo: 'つまずきやすい点：「負の周波数」。I/Q の矢印が逆回りになることだと伝えるとよい。||声かけの例：「B を 2 倍にすると、下の図の直線の傾きはどうなる？」「T·B が大きいほど、後で何が良くなるんだっけ？（ステップ1）」',
  init: {T: 40, B: 1, wave: 'lfm'}, ctl: ['B'], fixed: ['T'], plots: [{h: 200}, {h: 180}],
  mission: {t: '時間帯域幅積 T·B を、ちょうど 100 にしよう。', ok: r => Math.abs(r.TB - 100) < 0.5}, sol: {B: 2.5},
  draw(P){
    const w = wav(), N = w.N, t = new Float64Array(N), f = new Float64Array(N); for (let i = 0; i < N; i++){ t[i] = (i / FS - w.T / 2) * 1e6; f[i] = S.B * t[i] / S.T; }
    P[0].set({title: 'LFM の波形（I 成分と Q 成分）', xr: [-S.T / 2, S.T / 2], yr: [-1.3, 1.3], xl: '時刻 [µs]（パルスの真ん中が 0）', yl: '波の高さ', series: [{name: 'I 成分（実部）', color: 's1', x: t, y: w.re, w: 1.8}, {name: 'Q 成分（虚部）', color: 's2', x: t, y: w.im, w: 1.2, alpha: 0.7}],
      notes: [{x: 0, y: 1, t: '真ん中：ゆっくり', dx: 24, dy: -6}], marks: {wave: {t: 'I 成分と Q 成分'}}, tipx: v => fx(v, 1) + ' µs', tipy: v => fx(v, 2)});
    P[1].set({title: 'その瞬間の周波数', xr: [-S.T / 2, S.T / 2], yr: [-2.2, 2.2], xl: '時刻 [µs]', yl: '周波数 [MHz]', series: [{name: '瞬時周波数', color: 's3', x: t, y: f, w: 2.4}], hl: [{y: 0, label: '周波数 0', left: true}],
      notes: [{x: S.T / 2, y: S.B / 2, t: '+B/2 = ' + fx(S.B / 2, 2) + ' MHz', dx: -40, dy: -18}], marks: {freq: {y0: -S.B / 2, y1: S.B / 2, t: '−B/2 から +B/2 まで直線的に変化'}}, tipx: v => fx(v, 1) + ' µs', tipy: v => fx(v, 2) + ' MHz'});
    return {TB: S.T * S.B, tiles: [{k: '時間帯域幅積 T·B', v: fx(S.T * S.B, 0), s: 'パルス圧縮比の目安'}, {k: '周波数の変わる速さ B/T', v: fx(S.B / S.T * 1000, 0) + ' <small>kHz/µs</small>'}, {k: '圧縮後のパルス幅の目安 1/B', v: fx(1 / S.B, 2) + ' <small>µs</small>', s: '送信パルスは ' + S.T + ' µs'}]};
  }});

/* 3 */
STEPS.push({short: '整合フィルタ', title: '整合フィルタと相関 — 参照波形を滑らせて、掛けて、足す', src: '§8.1（p.8.1–8.2）、付録 Matched Filters・Matched Filter Time Response（p.8.39–8.41）',
  q: '送った波形のコピー（参照波形）を、受信信号の上で少しずつずらしながら「掛けて足す」。出力がいちばん大きくなるのは、いつ？',
  ch: ['参照がエコーに重なり始めたとき', '参照がエコーにぴったり重なったとき', '参照がエコーを通り過ぎたとき'], ans: 1,
  why: 'ぴったり重なった瞬間だけ、掛け算の結果がすべて同じ向きにそろい、足し合わせが最大になります。少しでもずれると、プラスとマイナスが混ざって打ち消し合います。LFM では、そのずれの許容がおよそ 1/B と短いので、出力が細いパルスになります。',
  read: {
    ana: '型抜きクッキーの型を、生地の上で少しずつずらしていくところを想像してください。型と模様がぴったり合った瞬間だけ「カチッ」とはまります。整合フィルタは、送った波形という「型」を、受信信号の上で滑らせる仕組みです。',
    what: '整合フィルタ（matched filter）は、[[ref|参照波形]]（送信波形のコピー）を受信信号の上でずらしながら、重なった部分を掛けて足します。この計算を相関と呼びます。||下の図が[[out|出力]]です。「動かす」を押すと、参照がエコーに重なる瞬間にだけ、出力に鋭い山ができます。山の位置がエコーの遅れ、つまり目標の距離です。',
    eq: '<i>y</i>(τ) = ∫ <i>r</i>(<i>t</i>)·<i>u</i>*(<i>t</i> − τ) d<i>t</i>',
    sym: '<i>y</i>(τ)：ずらす量が τ のときの出力。<i>r</i>(<i>t</i>)：受信信号。<i>u</i>(<i>t</i>)：送信波形（参照）。* は複素共役（位相の向きを逆にする操作）。∫ は「重なった部分を全部足す」という意味。',
    mis: '整合フィルタは「エコーの形をそのまま取り出す」フィルタではありません。出力の形は送信波形とは別物（自己相関）で、ピークの S/N を最大にすることが目的です。'},
  hosoku: ['型抜きのたとえ', '少しずれると掛け算の結果が正負混ざって打ち消し合い、許容がおよそ 1/B であるという説明', '式は相関の形に書き直したもの'],
  memo: 'つまずきやすい点：「掛けて足す」がなぜピークを作るのか。位相がそろう＝矢印が同じ向きに並ぶ、と言い換える。||声かけの例：「参照を 1 µs だけずらしたとき、出力はどのくらい下がった？」「山の位置から目標の距離を計算してみよう（1 µs = 150 m）」',
  init: {T: 20, B: 1, wave: 'lfm', pos: 5}, ctl: ['pos'], fixed: ['T', 'B'], plots: [{h: 200}, {h: 170}],
  acts: [{t: '▶ 動かす', play: {k: 'pos', min: 0, max: 60, step: 0.4, ms: 60, once: true}}],
  mission: {t: '出力がいちばん大きくなる位置に、参照波形をぴったり合わせよう（スライダーは矢印キーで細かく動かせます）。', ok: r => Math.abs(S.pos - 30) < 0.15}, sol: {pos: 30},
  draw(P){
    const w = wav(), sc = makeScene(w, {targets: [{R: 4500, A: 1, ph: 0}], fd: 0}), y = compress(sc, w, 'none', 1), n = Math.round(S.pos * 10), ref = new Float64Array(w.N); for (let i = 0; i < w.N; i++) ref[i] = w.re[i] - 2.6;
    P[0].set({title: '受信信号（上）と、ずらしていく参照波形（下）', xr: [0, 82], yr: [-3.9, 1.4], xl: '時刻 [µs]（送信してからの時間）', yl: '', yticks: [[0, 'エコー'], [-2.6, '参照']], series: [{name: '受信したエコー（I 成分）', color: 's1', x0: 0, dx: 0.1, y: sc.re.subarray(0, 820), w: 1.5}, {name: '参照波形（I 成分）', color: 's2', x0: S.pos, dx: 0.1, y: ref, w: 1.5}],
      bands: [{x0: 30, x1: 50, color: 'band', label: 'エコーのある区間'}], marks: {ref: {x0: S.pos, x1: S.pos + S.T, y0: -3.8, y1: -1.4, t: '参照波形'}}, noHover: true});
    P[1].set({title: '整合フィルタの出力（ここまでずらした分）', xr: [0, 82], yr: [0, 1.15], xl: '参照をずらした時間 [µs]', yl: '出力の強さ（振幅）', series: [{name: '出力', color: 's3', x0: 0, dx: 0.1, y: y.mag.subarray(0, n + 1), w: 2}],
      pts: [{x: S.pos, y: y.mag[n], color: 's3', label: fx(y.mag[n], 2)}], notes: S.pos >= 30 ? [{x: 30, y: 1, t: 'ぴったり重なった瞬間', dx: 40, dy: 0}] : [], marks: {out: {x0: 26, x1: 34, t: '出力の山'}}, tipx: v => fx(v, 1) + ' µs', tipy: v => fx(v, 2)});
    return {tiles: [{k: 'いまの出力', v: fx(y.mag[n], 2), s: '最大は 1.00'}, {k: 'ずらした時間', v: fx(S.pos, 1) + ' <small>µs</small>', s: '距離にすると ' + fx(S.pos * 0.15, 2) + ' km'}]};
  }});

/* 4 */
STEPS.push({short: '距離分解能', title: '距離分解能 — 近くに並んだ 2 つの目標を見分ける', src: '§8.2 Time Delay and Range Resolution Widths・表8.1（p.8.4–8.5）',
  q: '300 m 離れた 2 つの目標が、圧縮後に 1 つの山に見えている。2 つに分けるには、何を変えるのが効く？',
  ch: ['パルス幅 T を長くする', '帯域 B を広げる', 'どちらを変えても同じ'], ans: 1,
  why: '圧縮後のパルスの幅は、およそ 1/B です。B を広げるほど山が細くなり、近くの目標を分けられます。パルス幅 T は圧縮後の幅には効きません（T が効くのはエネルギー、つまり S/N です）。',
  read: {
    ana: '太いマジックで書いた 2 本の線は、近づけるとくっついて 1 本に見えます。細いペンなら、同じ間隔でも 2 本だと分かります。距離分解能は、この「ペンの太さ」にあたります。',
    what: '圧縮後の[[lobe|山（主ローブ）の幅]]は、帯域 B で決まります。高さが約 7 割（3 dB 下）になる幅は 0.886/B です。||これに c/2 を掛けると距離になります。目安としてよく使う c/(2B) は、少し低い位置（3.9 dB 下）で測った幅にあたります。上の図で B を動かし、[[dip|2 つの山の間の谷]]がどうなるか見てください。',
    eq: 'Δ<i>R</i> ≈ <i>c</i> / (2<i>B</i>)',
    sym: 'Δ<i>R</i>：距離分解能 [m]。<i>c</i>：光の速さ（3×10⁸ m/s）。<i>B</i>：帯域 [Hz]。B = 1 MHz なら約 150 m。2 で割るのは、電波が往復するからです。',
    mis: '「パルスを長くすると分解能が悪くなる」のは変調なしの場合だけです。パルス圧縮では、T を長くしても分解能は変わりません。下の図（変調なし）と比べてください。'},
  hosoku: ['ペンの太さのたとえ', '2 つのエコーの位相差を 90° に固定していること（谷の深さは位相差で変わる）'],
  memo: 'つまずきやすい点：分解能（見分ける能力）と精度（位置を測る細かさ）の混同。ここで扱うのは分解能。||声かけの例：「B を 2 倍にしたら山の幅は？」「谷がちょうど見え始める B のとき、c/(2B) は何 m？間隔 300 m と比べると？」',
  init: {T: 40, B: 0.3, wave: 'lfm', t2: true, dr: 300, a2: 0}, ctl: ['B'], fixed: ['T', 'dr'], plots: [{h: 210}, {h: 150}],
  mission: {t: '2 つの山の間に、深さ 3 dB 以上（山の高さの約 7 割以下）の谷ができるようにしよう。ただし帯域は 1 MHz 以下で。', ok: r => r.dip >= 3 && S.B <= 1.0001}, sol: {B: 0.8},
  draw(P){
    const w = wav(), y = compress(makeScene(w, {targets: tgts(), fd: 0}), w, 'none', 4), a = rseg(y.mag, y.dt, 19, 21.3), k = y.dt * 1.5e8;
    const i1 = Math.round(20000 / k), i2 = Math.round(20300 / k), pk = Math.min(maxIn(y.mag, i1 - 2, i1 + 2), maxIn(y.mag, i2 - 2, i2 + 2)); let mn = Infinity; for (let i = i1; i <= i2; i++) if (y.mag[i] < mn) mn = y.mag[i];
    const dip = Math.max(0, 20 * Math.log10(pk / Math.max(mn, 1e-9))), wc = makeWave('cw', S.T, S.B), yc = compress(makeScene(wc, {targets: tgts(), fd: 0}), wc, 'none', 1), c = rseg(yc.mag, yc.dt, 13, 27);
    P[0].set(Object.assign({title: 'LFM：圧縮後の出力（目標は 20.0 km と 20.3 km）', xr: [19, 21.3], yr: [0, 1.5], yl: '圧縮後の強さ（振幅）', series: [{name: '圧縮後の出力', color: 's1', x0: a.x0, dx: a.dx, y: a.y, w: 2}], vl: [{x: 20, label: '目標1'}, {x: 20.3, label: '目標2'}],
      notes: [dip >= 3 ? {x: 20.15, y: mn, t: '谷の深さ ' + fx(dip, 1) + ' dB', dx: 60, dy: 40} : {x: 20.15, y: mn, t: 'まだ 1 つの山', dx: 60, dy: -30}], marks: {lobe: {x0: 20 - 0.0665 / S.B, x1: 20 + 0.0665 / S.B, t: '山の幅（3 dB 幅）= 0.886/B'}, dip: {x0: 20.05, x1: 20.25, t: '谷'}}}, RKM));
    P[1].set(Object.assign({title: '比較：同じ長さ（40 µs）の変調なしパルス', xr: [13, 27], yr: [0, 1.5], yl: '強さ（振幅）', series: [{name: '変調なしの出力', color: 'ref', x0: c.x0, dx: c.dx, y: c.y, w: 2}], notes: [{x: 20.15, y: 1.38, t: '300 m の差はまったく見えない', dx: 40, dy: 30}]}, RKM));
    return {dip, tiles: [{k: '見分けの目安 c/(2B)', v: fx(150 / S.B, 0) + ' <small>m</small>', s: '目標の間隔は 300 m'}, {k: '山の 3 dB 幅（0.886/B を距離に）', v: fx(0.886 * 150 / S.B, 0) + ' <small>m</small>'}, {k: '2 つの山の間の谷', v: dip >= 0.05 ? fx(dip, 1) + ' <small>dB</small>' : 'なし', s: dip >= 0.05 ? '谷の高さは山の ' + fx(Math.pow(10, -dip / 20) * 100, 0) + '%' : '1 つの山に見える'}]};
  }});

/* 5 */
STEPS.push({short: '雑音の中の検出', title: '雑音の中での検出 — 埋もれたエコーが、圧縮すると浮かび上がる', src: '付録 Matched Filters（p.8.39、式8.42〜8.45）、§8.1（p.8.1–8.2）',
  q: 'エコーは雑音より弱く、圧縮する前は見えない。パルス幅 T を 2 倍にすると、圧縮後のピークの S/N はどうなる？',
  ch: ['変わらない', '約 3 dB（2 倍）良くなる', '約 6 dB（4 倍）良くなる'], ans: 1,
  why: '整合フィルタの出力の S/N は、受信した信号のエネルギーで決まります。同じ強さでパルスを 2 倍の長さにすると、エネルギーが 2 倍になるので、S/N は 2 倍（約 3 dB）良くなります。',
  read: {
    ana: 'にぎやかな教室で、1 人が小さな声で話しても聞こえません。でも 100 人が同じ言葉を、同じタイミングで言えば、はっきり聞こえます。ばらばらのざわめき（雑音）は、足してもそれほど大きくならないからです。',
    what: '上の図は圧縮する前です。[[before|エコー]]は雑音より弱く、どこにあるか分かりません。下の図は整合フィルタに通した後で、パルス全体のエネルギーが 1 点に集まり、[[after|ピーク]]が雑音の上に出ます。||整合フィルタは、雑音の中の信号に対して、出力のピークの S/N を最大にするフィルタです。その S/N は信号のエネルギーだけで決まり、波形の種類にはよりません。',
    eq: '(S/N)<sub>出力</sub> = 2<i>E</i> / <i>N</i><sub>0</sub>',
    sym: '<i>E</i>：受信した信号のエネルギー [J]（強さ × パルス幅）。<i>N</i><sub>0</sub>：雑音の電力密度 [W/Hz]（1 Hz あたりの雑音の強さ）。パルス幅を伸ばすと <i>E</i> が増えます。',
    mis: '「LFM にすると S/N が良くなる」わけではありません。同じ長さ・同じ強さなら、変調なしでも LFM でも圧縮後の S/N は同じです。変調の目的は S/N ではなく、分解能です。'},
  hosoku: ['教室のたとえ', '入力 S/N を 1 サンプルあたりで定義し、改善量を 10·log(サンプル数) としていること'],
  memo: 'つまずきやすい点：「改善量」は入力 S/N の定義（雑音の帯域）で数字が変わる。ここではサンプル数 N = T × 10 MHz 倍。||声かけの例：「T を 10 µs から 40 µs にしたら、ピークは何 dB 上がった？」「雑音の高さ（0 dB の線）は変わった？」',
  init: {T: 10, B: 2, wave: 'lfm', snr: -10}, ctl: ['T'], fixed: ['snr', 'B'], plots: [{h: 170}, {h: 200}], acts: [{t: '別の雑音にする', f: () => { S.seed++; }}],
  mission: {t: '圧縮後のピークの S/N が 15 dB 以上（電力で約 32 倍）になる、いちばん短いパルス幅を見つけよう。', ok: r => r.out >= 15 && r.out - 10 * Math.log10(S.T / (S.T - 5)) < 15}, sol: {T: 35},
  draw(P){
    const w = wav(), sc = makeScene(w, {targets: [{R: 20000, A: 1, ph: 0}], fd: 0, noise: true}), sg = Math.pow(10, -S.snr / 20), y = compress(sc, w, 'none', 1);
    const a = rseg(dbA(amp(sc.re, sc.im), sg), 1 / FS, 17, 37), b = rseg(dbA(y.mag, sg / Math.sqrt(w.N)), y.dt, 17, 37), gain = 10 * Math.log10(w.N), out = S.snr + gain;
    P[0].set(Object.assign({title: '圧縮する前：受信した信号の強さ', xr: [17, 37], yr: [-25, 25], yl: '強さ [dB]（雑音の平均 = 0）', series: [{name: '受信信号', color: 'ref', x0: a.x0, dx: a.dx, y: a.y, w: 1}], bands: [{x0: 20, x1: 20 + S.T * 0.15, color: 'band', label: 'エコーはここにある'}],
      marks: {before: {x0: 20, x1: 20 + S.T * 0.15, t: 'エコー（雑音より ' + (-S.snr) + ' dB 弱い）'}}, tipy: v => fx(v, 1) + ' dB'}, RKM));
    P[1].set(Object.assign({title: '圧縮した後：整合フィルタの出力', xr: [17, 37], yr: [-25, 25], yl: '強さ [dB]（雑音の平均 = 0）', series: [{name: '圧縮後の出力', color: 's1', x0: b.x0, dx: b.dx, y: b.y, w: 1.2}], hl: [{y: 15, label: '目標の 15 dB', left: false}],
      notes: [{x: 20, y: out, t: 'ピーク（理論値 ' + fx(out, 1) + ' dB）', dx: 46, dy: 6}], marks: {after: {x0: 19.6, x1: 20.4, t: '1 点に集まったピーク'}}, tipy: v => fx(v, 1) + ' dB'}, RKM));
    return {out, tiles: [{k: '圧縮する前の S/N', v: fx(S.snr, 0) + ' <small>dB</small>', s: '電力 ' + ratioTxt(S.snr)}, {k: '圧縮による改善', v: '+' + fx(gain, 1) + ' <small>dB</small>', s: '足し合わせるサンプル数 ' + w.N + ' 倍'}, {k: '圧縮後のピークの S/N（理論）', v: fx(out, 1) + ' <small>dB</small>', s: '電力 ' + ratioTxt(out)}]};
  }});

/* 6 */
STEPS.push({short: 'サイドローブ', title: 'サイドローブと重み付け — 強い目標の「すそ」に、弱い目標が隠れる', src: '§8.2 Frequency Domain Weighting・表8.2（p.8.7–8.8、式8.10〜8.12）、第4章 Pulse Compression Mismatch Loss（p.4.39–4.40）',
  q: '強い目標のすぐ隣に、電力が 1/1000（−30 dB）の弱い目標がある。テイラー重み付けを入れると、圧縮後の出力はどう変わる？',
  ch: ['サイドローブが下がり、山は少し太くなる', 'サイドローブも下がり、山も細くなる', '何も変わらない'], ans: 0,
  why: '重み付けは、サイドローブを −13 dB から −40 dB まで下げます。その代わり、山の幅が 0.886/B から 1.25/B に広がり、S/N が 1.15 dB 下がります（ミスマッチ損失）。良いことだけの方法はありません。',
  read: {
    ana: '夜、明るい街灯のすぐ隣にある小さな豆電球は、街灯のまぶしさ（にじみ）に隠れて見えません。にじみを抑えるフィルタをかけると豆電球が見えますが、街灯の像は少しぼやけます。',
    what: '圧縮後の山の両脇には、[[sl|時間サイドローブ（time sidelobe）]]という小さな山が並びます。重みなしの LFM では、いちばん大きいものが主ローブの −13.2 dB です。強い目標のサイドローブは、近くの[[weak|弱い目標]]を隠します。||テイラー重み付け（Taylor weighting）は、周波数の端を弱めることでサイドローブを下げます。代わりに整合フィルタから少し外れるので、S/N が下がります。これがミスマッチ損失（mismatch loss）です。',
    eq: 'ミスマッチ損失 <i>L</i><sub>m</sub> = (S/N)<sub>整合フィルタ</sub> / (S/N)<sub>重み付け後</sub>',
    sym: '<i>L</i><sub>m</sub>：ミスマッチ損失（1 以上の比。dB で表すことが多い）。−40 dB のテイラー重み付けでは 1.15 dB（電力で約 1.3 倍の損）。',
    mis: '「サイドローブ」は雑音ではありません。強い目標そのものの応答の一部です。だから S/N をいくら上げても消えず、重み付けでしか下がりません。'},
  hosoku: ['街灯のたとえ', '弱い目標を 260 m 隣に置いた場面設定'],
  memo: 'つまずきやすい点：サイドローブと雑音の区別。目標の強さを変えるとサイドローブも一緒に上下することを確認させる。||声かけの例：「重みなしで見えるのは、弱い目標が何 dB のときまで？」「テイラーにしたとき、山の幅は何倍になった？」',
  init: {T: 40, B: 2, wave: 'lfm', t2: true, dr: 260, a2: -15, wt: 'none'}, ctl: ['wt', 'a2'], fixed: ['T', 'B', 'dr'], plots: [{h: 260}],
  mission: {t: '弱い目標を −30 dB（電力 1/1000）まで下げ、それでも山として見えるようにしよう。', ok: r => S.a2 <= -30 && S.wt === 'taylor'}, sol: {a2: -30, wt: 'taylor'},
  draw(P){
    const w = wav(), y = compress(makeScene(w, {targets: tgts(), fd: 0}), w, S.wt, 4), a = rseg(dbA(y.mag, 1), y.dt, 19.2, 20.8), y1 = compress(makeScene(w, {targets: [tgts()[0]], fd: 0}), w, S.wt, 4), b = rseg(dbA(y1.mag, 1), y1.dt, 19.2, 20.8), r = response(w, 0, S.wt), m = metrics(r);
    P[0].set(Object.assign({title: '圧縮後の出力（縦軸は dB。強い目標の頂上が 0 dB）', xr: [19.2, 20.8], yr: [-65, 6], yl: '強さ [dB]（強い目標 = 0）', series: [{name: '強い目標だけのとき', color: 'ref', x0: b.x0, dx: b.dx, y: b.y, w: 1.2, dash: [4, 3]}, {name: '弱い目標もあるとき', color: 's1', x0: a.x0, dx: a.dx, y: a.y, w: 2}],
      hl: [{y: S.a2, label: '弱い目標の強さ ' + S.a2 + ' dB', left: true}], notes: [{x: 20.26, y: S.a2, t: '弱い目標はここ', dx: 40, dy: -30}], marks: {sl: {x0: 20.06, x1: 20.75, y0: -64, y1: m.psl + 3, t: 'サイドローブ（最大 ' + fx(m.psl, 1) + ' dB）'}, weak: {x0: 20.2, x1: 20.32, t: '弱い目標'}}, tipy: v => fx(v, 1) + ' dB'}, RKM));
    return {tiles: [{k: 'いちばん大きいサイドローブ', v: fx(m.psl, 1) + ' <small>dB</small>', s: '主ローブの電力の ' + ratioTxt(m.psl)}, {k: '山の 3 dB 幅', v: fx(m.w3 * S.B * 1e6, 2) + ' <small>/B</small>', s: '距離では ' + fx(m.w3 * 1.5e8, 0) + ' m'}, {k: 'ミスマッチ損失', v: fx(r.lossDb, 2) + ' <small>dB</small>', s: S.wt === 'taylor' ? 'S/N が電力で ' + ratioTxt(-r.lossDb) + ' に' : '重みなしなので 0'}]};
  }});

/* 7 */
STEPS.push({short: 'ドップラの影響', title: 'ドップラの影響 — LFM は形を保つが、位置がずれる', src: '§8.2 LFM・Range-Doppler Coupling（p.8.3–8.6、式8.7〜8.9）、Binary Phase Codes（p.8.17）、§8.3 表8.8（p.8.27）',
  q: '目標が近づいていて、エコーにドップラ周波数が付いている。LFM で圧縮すると、出力のピークはどうなる？',
  ch: ['ほとんど消えてしまう', '形はほぼそのままで、位置がずれる', '位置はそのままで、幅が大きく広がる'], ans: 1,
  why: 'LFM は「時刻」と「周波数」が直線の関係で結ばれています。エコー全体の周波数が fd だけずれると、参照波形とぴったり合う時刻が fd·T/B だけずれます。山の形と高さはほとんど変わりません。これが距離ドップラ結合です。',
  read: {
    ana: '音階を順に上がっていく音（ドレミファ…）を、全体に少し高い音で演奏されたとします。「ミ」を待っている人には、本来より少し早いタイミングで「ミ」の高さの音が聞こえます。高さのずれが、時間のずれに見えるのです。',
    what: '動く目標のエコーには、ドップラ周波数 fd が加わります。LFM では、[[shift|ピークの位置]]が fd·T/B だけ時間方向にずれます。これを距離ドップラ結合（range-Doppler coupling）と呼びます。近づく目標（fd が正）は、アップチャープなら近い側にずれます。||形と S/N はほとんど変わらないので、±B/10 程度までのドップラなら 1 本のフィルタで対応できます。一方、バーカー符号のような位相符号はドップラに敏感で、ピークが下がりサイドローブが上がります（波形を切り替えて比べてください）。',
    eq: 'Δ<i>t</i> = −<i>f</i><sub>d</sub>·<i>T</i> / <i>B</i>',
    sym: 'Δ<i>t</i>：ピークの位置のずれ [秒]（負は早い側＝近い側）。<i>f</i><sub>d</sub>：ドップラ周波数 [Hz]。<i>T</i>：パルス幅 [秒]。<i>B</i>：帯域 [Hz]。距離のずれは Δ<i>t</i>·<i>c</i>/2。',
    mis: '「LFM はドップラの影響を受けない」は言い過ぎです。形は保たれますが、距離が少しずれて測られます。{H}このスライダーの ±500 kHz は見やすくするための大きな値で、実際は fd = 2v/λ（波長 0.1 m・300 m/s なら 6 kHz）程度です。'},
  hosoku: ['音階のたとえ', 'スライダーの範囲が実際より大きいこと、fd = 2v/λ による実際の値の目安'],
  memo: 'つまずきやすい点：ずれの向き（アップチャープで近づく目標は近い側）。式の符号と図を対応させる。||声かけの例：「fd を 2 倍にすると、ずれは？」「バーカーに切り替えて、fd = 20 kHz でピークは何割になった？」',
  init: {T: 40, B: 2, wave: 'lfm', fd: 0}, ctl: ['fd', {k: 'wave', seg: [['lfm', 'LFM'], ['barker', 'バーカー13']]}], fixed: ['T', 'B'], plots: [{h: 250}],
  mission: {t: 'LFM で、ピークの位置がちょうど 300 m 近い側へずれるドップラ周波数を見つけよう。', ok: r => S.wave === 'lfm' && Math.abs(r.dm + 300) < 20}, sol: {fd: 100},
  draw(P){
    const w = wav(), r0 = response(w, 0, 'none'), r = response(w, S.fd * 1e3, 'none'), m = metrics(r), dm = m.tpk * 1.5e8, lim = S.wave === 'lfm' ? 12 : 8;
    const xs = q => { const o = new Float64Array(q.n); for (let i = 0; i < q.n; i++) o[i] = (q.x0 + i * q.dx) * 1e6; return o; };
    P[0].set({title: '圧縮後の出力：ドップラがないとき（破線）と、あるとき（実線）', xr: [-lim, lim], yr: [0, 1.15], xl: '本当の位置からのずれ [µs]（1 µs = 150 m。左が近い側）', yl: '圧縮後の強さ（振幅）', series: [{name: 'ドップラなし', color: 'ref', x: xs(r0), y: r0.mag, w: 1.4, dash: [5, 3]}, {name: 'ドップラ ' + S.fd + ' kHz', color: 's1', x: xs(r), y: r.mag, w: 2.2}],
      vl: [{x: 0, label: '本当の位置'}], notes: Math.abs(S.fd) >= 10 ? [{x: m.tpk * 1e6, y: m.pk, t: 'ずれ ' + fx(dm, 0) + ' m、高さ ' + fx(m.pk * 100, 0) + '%', dx: m.tpk < 0 ? -30 : 30, dy: -6}] : [], marks: {shift: {x0: m.tpk * 1e6 - 0.6, x1: m.tpk * 1e6 + 0.6, t: 'ピークの位置'}}, tipx: v => fx(v, 2) + ' µs', tipy: v => fx(v, 2)});
    return {dm, tiles: [{k: 'ピークの位置のずれ', v: fx(m.tpk * 1e6, 2) + ' <small>µs</small>', s: '距離では ' + fx(dm, 0) + ' m' + (dm < -1 ? '（近い側）' : dm > 1 ? '（遠い側）' : '')}, S.wave === 'lfm' ? {k: '式の値 −fd·T/B', v: fx(-S.fd * S.T / S.B / 1000, 2) + ' <small>µs</small>'} : null, {k: 'ピークの高さ', v: fx(m.pk * 100, 0) + ' <small>%</small>', s: dbx(20 * Math.log10(Math.max(m.pk, 1e-6)))}]};
  }});

/* 8 */
STEPS.push({short: '位相符号', title: '位相符号波形 — バーカー符号', src: '§8.2 Phase-Coded Waveforms・Binary Phase Codes・Barker Codes・表8.4（p.8.16–8.18）',
  q: '長さ 13 のバーカー符号を圧縮すると、サイドローブの高さ（振幅）は主ローブの何分の 1 になる？',
  ch: ['1/2', '1/13', '1/169'], ans: 1,
  why: 'バーカー符号は、サイドローブの振幅がどこでも主ローブの 1/N 以下になる特別な符号です。N = 13 なら 1/13、dB では −22.3 dB です（電力では 1/169 にあたります）。',
  read: {
    ana: '暗証番号の錠前を考えてください。正しい並びのときだけ全部の歯がかみ合い、1 つずれると、かみ合う歯とぶつかる歯がほぼ同じ数になって、ほとんど力が伝わりません。バーカー符号は、そういう性質を持つように選ばれた＋と−の並びです。',
    what: '位相符号波形（phase-coded waveform）は、パルスを N 個の[[code|サブパルス]]に分け、サブパルスごとに位相を 0° か 180° に切り替えます。圧縮後の山の幅は、ほぼサブパルス 1 個分です。||バーカー符号（Barker code）は、[[bsl|サイドローブ]]が主ローブの 1/N になる符号で、長さは 2、3、4、5、7、11、13 のものしか知られていません。そのため圧縮比は最大 13 です。',
    eq: 'ピークサイドローブ = −20·log<sub>10</sub>(<i>N</i>)　[dB]',
    sym: '<i>N</i>：符号の長さ（サブパルスの数）。時間帯域幅積と圧縮比も <i>N</i> に等しくなります。N = 13 のとき −22.3 dB。',
    mis: '「符号を長くすれば、いくらでもサイドローブを下げられる」わけではありません。バーカー符号は 13 までしかなく、もっと長い符号では別の種類（サイドローブはやや高い）を使います。'},
  hosoku: ['錠前のたとえ'],
  memo: 'つまずきやすい点：−20·log N の「20」（振幅の比だから）。電力の比なら 1/N² になる。||声かけの例：「N = 5 のとき、サイドローブは何 dB？ 式で計算してから図で確かめよう」「LFM の重みなし（−13.2 dB）と比べて、どちらが低い？」',
  init: {T: 39, wave: 'barker', nc: 5}, ctl: ['nc'], fixed: ['T'], fixT: ['符号の種類 バーカー符号'], plots: [{h: 130}, {h: 220}],
  mission: {t: 'サイドローブが −20 dB 以下（振幅で 1/10 以下）になる符号の長さを選ぼう。', ok: r => r.psl <= -20}, sol: {nc: 13},
  draw(P){
    const w = wav(), r = response(w, 0, 'none'), m = metrics(r), cx = [], cy = []; for (let i = 0; i <= w.nc; i++){ cx.push(i); cy.push(w.code.charAt(Math.min(i, w.nc - 1)) === '1' ? 1 : -1); }
    const x = new Float64Array(r.n); for (let i = 0; i < r.n; i++) x[i] = (r.x0 + i * r.dx) * FS / w.chip;
    P[0].set({title: '符号の並び（＋が位相 0°、−が位相 180°）', xr: [0, 13], yr: [-1.6, 1.6], xl: 'サブパルスの番号', yl: '', yticks: [[1, '＋'], [-1, '−']], series: [{name: '符号', color: 's1', x: cx, y: cy, step: true, w: 2.2}], marks: {code: {x0: 0, x1: w.nc, t: 'サブパルス ' + w.nc + ' 個'}}, noHover: true});
    P[1].set({title: '圧縮後の出力', xr: [-13.5, 13.5], yr: [0, 1.12], xl: '本当の位置からのずれ（サブパルス何個分か）', yl: '圧縮後の強さ（振幅）', series: [{name: '圧縮後の出力', color: 's2', x, y: r.mag, w: 2}], hl: [{y: 1 / w.nc, label: '1/N = ' + fx(1 / w.nc, 3), left: true}],
      notes: [{x: 0, y: 1, t: '主ローブ', dx: 30, dy: 4}], marks: {bsl: {x0: 1, x1: w.nc, y0: 0, y1: 1.6 / w.nc, t: 'サイドローブ'}}, tipx: v => fx(v, 1) + ' 個分', tipy: v => fx(v, 3)});
    return {psl: m.psl, tiles: [{k: 'いちばん大きいサイドローブ', v: fx(m.psl, 1) + ' <small>dB</small>', s: '振幅で主ローブの 1/' + fx(Math.pow(10, -m.psl / 20), 1)}, {k: '式の値 −20·log N', v: fx(-20 * Math.log10(w.nc), 1) + ' <small>dB</small>', s: 'N = ' + w.nc}]};
  }});

/* 9 */
STEPS.push({short: 'エクリプシング', title: 'エクリプシング — 送信している間は、受信できない', src: '第5章 p.5.18（Eclipsing loss）、第4章 Losses（p.4.39–4.40）、§8.4（p.8.30–8.31）',
  q: 'パルス幅 40 µs のレーダで、3 km 先の目標を見る。エコーの先頭は 20 µs 後に戻ってくるが、そのときまだ送信中だ。圧縮後のピークはどうなる？',
  ch: ['ふつうに出る', '下がる（エコーの前半が欠けるから）', 'まったく出ない'], ans: 1,
  why: '送信中は受信機を切っているので、エコーのうち送信が終わる前に戻ってきた部分は受信できません。3 km ならエコーの半分が欠け、圧縮後のピークの振幅は半分（−6 dB）になります。まったく見えなくなるわけではありません。',
  read: {
    ana: '自分が大声で話している間は、相手の小さな返事が聞き取れません。話し終わってからやっと聞こえ始めますが、相手の返事の最初の部分はもう聞き逃しています。',
    what: '送信パルスを出している間、受信機は止まっています。近い目標のエコーは[[tx|送信が終わる前]]に戻り始めるので、[[lost|先頭の部分が欠けます]]。これがエクリプシング（eclipsing）です。||受信できた分だけで圧縮するので、ピークが下がります。パルス圧縮のためにパルスを長くするほど、この影響を受ける距離が広がります。そのため、近距離だけを短い無変調パルスで補う実装例もあります。デューティ比（送信している時間の割合）が高い波形では、これが最も大きな損失になることがよくあります。',
    eq: '欠けずに受信できる最短距離 ≈ <i>c</i>·<i>T</i> / 2',
    sym: '<i>c</i>：光の速さ（3×10⁸ m/s）。<i>T</i>：送信パルス幅 [秒]。T = 40 µs なら 6 km。{H}この式はハンドブックの記述（送信中は受信できない）から導いた関係です。',
    mis: '「最短距離より近い目標はまったく見えない」わけではありません。受信できた割合に応じてピークが下がるだけで、強い目標なら見えます。'},
  hosoku: ['会話のたとえ', '「欠けずに受信できる最短距離 ≈ cT/2」という関係', '受信できた割合を p とするとピークの振幅がおよそ p 倍になること'],
  memo: 'つまずきやすい点：「距離」と「時間」の行き来（1 µs = 150 m）。図の横軸は時間で、目標の距離が動くとエコーが左右に動くことを確認。||声かけの例：「エコーが半分欠けるとき、ピークは何 dB 下がる？」「T を 100 µs にしたら、cT/2 は何 km？」',
  init: {T: 40, B: 2, wave: 'lfm', r1: 8}, ctl: ['r1'], fixed: ['T', 'B'], plots: [{h: 170}, {h: 200}],
  mission: {t: '圧縮後のピークがちょうど半分（−6 dB）になる距離を見つけよう。', ok: r => Math.abs(r.p - 0.5) < 0.03}, sol: {r1: 3},
  draw(P){
    const w = wav(), td = S.r1 / 0.15, lostT = Math.max(0, Math.min(S.T, S.T - td)), lost = Math.round(lostT * 10), p = 1 - lostT / S.T, full = response(w, 0, 'none'), r = response(w, 0, 'none', lost);
    const xs = q => { const o = new Float64Array(q.n); for (let i = 0; i < q.n; i++) o[i] = (q.x0 + i * q.dx) * 1e6; return o; };
    P[0].set({title: '時間の流れ：送信パルスと、戻ってくるエコー', xr: [0, 120], yr: [0, 1.5], xl: '時刻 [µs]（送信を始めてからの時間）', yl: '', yticks: [], series: [{name: '受信できた部分', color: 's1', x: [Math.max(td, S.T), Math.max(td, S.T), td + S.T, td + S.T], y: [0, 0.8, 0.8, 0], w: 2.2, fill: 0.2}].concat(lostT > 0 ? [{name: '欠けた部分', color: 'ref', x: [td, td, S.T, S.T], y: [0, 0.8, 0.8, 0], w: 1.5, dash: [4, 3]}] : []),
      bands: [{x0: 0, x1: S.T, color: 'band2', label: '送信中（受信できない）'}], notes: lostT > 0 ? [{x: (td + S.T) / 2, y: 0.8, t: 'ここが欠ける', dx: 20, dy: -30}] : [{x: td, y: 0.8, t: 'エコーは全部受信できる', dx: 20, dy: -30}],
      marks: {tx: {x0: 0, x1: S.T, t: '送信中'}, lost: {x0: td, x1: Math.max(td, S.T), t: '欠けた部分'}}, noHover: true});
    P[1].set({title: '圧縮後の出力：全部受信できた場合（破線）と、いまの場合（実線）', xr: [-3, 3], yr: [0, 1.12], xl: '本当の位置からのずれ [µs]', yl: '圧縮後の強さ（振幅）', series: [{name: '全部受信できた場合', color: 'ref', x: xs(full), y: full.mag, w: 1.4, dash: [5, 3]}, {name: 'いまの出力', color: 's1', x: xs(r), y: r.mag, w: 2.2}],
      notes: p < 0.98 ? [{x: 0, y: p, t: 'ピークは ' + fx(p * 100, 0) + '%', dx: 40, dy: -4}] : [], tipx: v => fx(v, 2) + ' µs', tipy: v => fx(v, 2)});
    return {p, tiles: [{k: '受信できた割合', v: fx(p * 100, 0) + ' <small>%</small>', s: 'エコーの先頭は ' + fx(td, 0) + ' µs 後に戻る'}, {k: 'ピークの低下', v: p > 0.001 ? fx(20 * Math.log10(p), 1) + ' <small>dB</small>' : '受信できない', s: p > 0.001 ? '振幅が ' + fx(p * 100, 0) + '% に' : ''}, {k: '欠けずに受信できる最短距離 cT/2', v: fx(S.T * 0.15, 1) + ' <small>km</small>'}]};
  }});

/* 10 */
STEPS.push({short: '実装のしかた', title: '実装のしかた（概要）— ストレッチ処理は、距離を周波数に変える', src: '§8.4 Digital Pulse Compression（p.8.29–8.30）、Stretch Pulse Compression（p.8.31–8.35、式8.24〜8.37）',
  q: 'ストレッチ処理では、受信した LFM に、同じ傾きの参照 LFM を掛ける。掛けた後、目標の「距離の違い」は何の違いとして現れる？',
  ch: ['信号の強さの違い', '一定の周波数の違い', '信号の長さの違い'], ans: 1,
  why: '傾きが同じ 2 つの LFM を掛けると、周波数の差が一定になります。その差は、参照とエコーの時間差に比例します。つまり距離の差が、周波数の差に変わります。あとは FFT で周波数を調べれば、距離が分かります。',
  read: {
    ana: '同じ速さで坂を上る 2 台の車を考えます。後から出た車と前の車の高さの差は、ずっと一定です。その差は「どれだけ遅れて出たか」で決まります。高さを周波数に置き換えたものが、ストレッチ処理です。',
    what: 'パルス圧縮の計算方法は 3 つあります。(1) 時間をずらしながら掛けて足す（ステップ3）。(2) FFT を使って周波数の上で掛け算する（結果は (1) と同じで、速い）。(3) ストレッチ処理（stretch processing）。||(3) は LFM 専用です。参照の LFM を掛けると、エコーは[[tone|一定の周波数の波]]になり、その[[spec|周波数]]が参照との時間差に比例します。広い帯域の LFM を、狭い帯域の処理で圧縮できるのが利点です。ただし見られるのは、決めた距離の近くだけです。',
    eq: 'δ<i>f</i> = −(<i>B</i> / <i>T</i>)·Δτ',
    sym: 'δ<i>f</i>：掛けた後の信号の周波数 [Hz]。<i>B</i>/<i>T</i>：LFM の傾き [Hz/秒]。Δτ：参照に対するエコーの時間差 [秒]（距離差 × 2/<i>c</i>）。',
    mis: '「ストレッチ処理は分解能が悪い」わけではありません。分解能は整合フィルタと同じ（6 dB 幅で 1.21/B）です。違いは、一度に見られる距離の範囲が狭いことです。'},
  hosoku: ['坂を上る車のたとえ', '参照 LFM を基準距離 20 km に合わせ、長さを 2T とした場面設定'],
  memo: 'つまずきやすい点：(1)(2) は同じ結果で計算の仕方が違うだけ、(3) は考え方が違う、という整理。||声かけの例：「目標を 2 倍遠くにずらすと、上の図の波の細かさは？」「−100 kHz に出すには何 m ずらす？ 式で先に計算してみよう」',
  init: {T: 40, B: 2, wave: 'lfm', r1: 20, dr: 60}, ctl: [{k: 'dr', l: '基準の距離（20 km）からの目標のずれ', min: 0, max: 1500, step: 30}], fixed: ['T', 'B'], plots: [{h: 170}, {h: 200}],
  mission: {t: '下の図のピークが −100 kHz（±5 kHz）に出るように、目標の位置を合わせよう。', ok: r => Math.abs(r.fk + 100) <= 5}, sol: {dr: 300},
  draw(P){
    const w = wav(), R0 = 20000, tauR = 2 * R0 / C, st = stretch(makeScene(w, {fd: 0, targets: [{R: R0 + S.dr, A: 1, ph: 0}]}), w, tauR), m = metrics({x0: st.f0, dx: st.df, mag: st.mag, n: st.n}), fk = m.tpk / 1e3, th = -(S.B * 1e6 / (S.T * 1e-6)) * (2 * S.dr / C) / 1e3;
    const i0 = Math.round((-650e3 - st.f0) / st.df), i1 = Math.round((150e3 - st.f0) / st.df);
    P[0].set({title: '参照の LFM を掛けた後の信号（I 成分）', xr: [st.t0 * 1e6, st.t0 * 1e6 + st.len / 10], yr: [-1.4, 1.4], xl: '時刻 [µs]', yl: '波の高さ', series: [{name: '掛けた後の信号', color: 's1', x0: st.t0 * 1e6, dx: 0.1, y: st.dechirpRe, w: 1.5}], marks: {tone: {t: '一定の周波数の波'}}, tipx: v => fx(v, 1) + ' µs', tipy: v => fx(v, 2)});
    P[1].set({title: 'その信号を周波数に分けた結果（FFT）', xr: [-650, 150], yr: [0, 1.12], xl: '周波数 [kHz]（0 が基準の距離。左ほど遠い）', yl: '成分の強さ', series: [{name: 'スペクトル', color: 's2', x0: (st.f0 + i0 * st.df) / 1e3, dx: st.df / 1e3, y: st.mag.subarray(i0, i1 + 1), w: 2}],
      vl: [{x: -100, label: '目標の −100 kHz'}], notes: [{x: fk, y: m.pk, t: fx(fk, 0) + ' kHz', dx: 30, dy: 4}], marks: {spec: {x0: fk - 25, x1: fk + 25, t: '周波数が距離を表す'}}, tipx: v => fx(v, 0) + ' kHz', tipy: v => fx(v, 2)});
    return {fk, tiles: [{k: 'ピークの周波数（FFT の結果）', v: fx(fk, 1) + ' <small>kHz</small>'}, {k: '式の値 −(B/T)·Δτ', v: fx(th, 1) + ' <small>kHz</small>', s: 'Δτ = ' + fx(2 * S.dr / C * 1e6, 2) + ' µs'}, {k: '周波数から求めた距離のずれ', v: fx(-fk * 1e3 / (S.B * 1e6 / (S.T * 1e-6)) * C / 2, 0) + ' <small>m</small>', s: '設定は ' + S.dr + ' m'}]};
  }});

/* 11 */
function checkTable1(){
  const R = runChecks(); let h = '<h3>ハンドブックの値との照合</h3><div class="tw"><table class="t"><tr><th>項目</th><th>条件</th><th>計算値</th><th>ハンドブック</th><th>判定</th><th>出典</th></tr>';
  for (const r of R) h += '<tr><td>' + r.item + '</td><td>' + r.cond + '</td><td>' + fx(r.meas, 2) + ' ' + r.unit + '</td><td>' + fx(r.ref, 2) + ' ' + r.unit + '</td><td>' + (r.ok === null ? '<span class="info">参考</span>' : r.ok ? '<span class="ok">一致</span>' : '<span class="ng">不一致</span>') + '</td><td>' + r.src + (r.note ? '<br><small>' + r.note + '</small>' : '') + '</td></tr>';
  return h + '</table></div>';
}
STEPS.push({short: '自由実験', title: '自由実験とまとめ — 全部のつまみを自由に動かす', src: '第8章 Pulse Compression Radar（p.8.1–8.44）、p.4.39–4.40、p.5.18', free: true,
  q: 'パルス幅 T を 2 倍にして、帯域 B はそのままにする。圧縮後の山の幅（3 dB 幅）はどうなる？',
  ch: ['2 倍に太くなる', 'ほとんど変わらない', '半分に細くなる'], ans: 1,
  why: '圧縮後の山の幅は帯域 B で決まり（およそ 1/B）、パルス幅 T にはよりません（ステップ 4）。T を伸ばして増えるのは、エネルギー（S/N）と時間帯域幅積 T·B です（ステップ 5）。',
  do: 'ここでは全部のパラメータを自由に動かせます',
  read: {
    ana: 'ここまでは、楽器を 1 つずつ鳴らして音を確かめてきました。このステップでは全部を一緒に鳴らして、合奏にします。1 つのつまみを動かすと、ほかの量にどう響くかを確かめてください。',
    eq: '圧縮比 ≈ <i>T</i>·<i>B</i>',
    sym: '<i>T</i>：送信パルスの幅 [秒]。<i>B</i>：帯域（周波数を振る幅）[Hz]。圧縮比：圧縮する前と後のパルス幅の比。ステップ 1 と同じ式です。',
    what: 'ここまでの内容を 1 つの流れにまとめます。符号化した長いパルスを送る → エコー（遅れ・ドップラ）と雑音を受信 → 整合フィルタで圧縮 → 必要なら重み付け → 幅がおよそ 1/B の細いパルス。||覚えておきたい関係は 4 つです。(1) エネルギーは T、分解能は B で決まる。(2) 圧縮比 ≈ T·B。(3) サイドローブを下げると、山が太り S/N が少し下がる。(4) LFM はドップラで位置がずれ、位相符号はドップラでピークが崩れる。',
    mis: '右の図は縦軸が dB です。−20 dB は「電力で 1/100」、−40 dB は「電力で 1/10000」。目盛り 1 つの差が大きいことに注意してください。'},
  hosoku: ['楽器の合奏のたとえ', 'まとめの 4 つの関係の整理のしかた'],
  memo: '自由実験では「予想 → 操作」の型を、新人自身に作らせるとよい。||声かけの例：「T を半分、B を 2 倍にしたら何が変わって何が変わらない？ 先に予想を紙に書いてから動かそう」',
  init: {T: 20, B: 1, wave: 'lfm', wt: 'none', t2: true, dr: 600, a2: -20, snr: 0, fd: 0, noise: false}, ctl: ['wave', 'wt', 'T', 'B', 'dr', 'a2', 'fd', 'noise', 'snr'], fixed: [], plots: [{h: 280}],
  acts: [{t: '別の雑音にする', f: () => { S.seed++; }}],
  mission: {t: 'LFM で、山の 3 dB 幅が 100 m 以下、かつサイドローブが −35 dB 以下になる設定を作ろう。', ok: r => S.wave === 'lfm' && r.w3m <= 100 && r.psl <= -35}, sol: {T: 60, B: 2.5, wt: 'taylor'},
  extra: checkTable1,
  draw(P){
    const w = wav(), sc = makeScene(w, {targets: tgts(), noise: S.noise}), y = compress(sc, w, S.wave === 'lfm' ? S.wt : 'none', 4), a = rseg(dbA(y.mag, 1), y.dt, 18, 23), r = response(w, 0, S.wave === 'lfm' ? S.wt : 'none'), m = metrics(r);
    P[0].set(Object.assign({title: '圧縮後の出力（目標1 は 20 km、頂上が 0 dB）', xr: [18, 23], yr: [-70, 8], yl: '強さ [dB]（目標1 = 0）', series: [{name: '圧縮後の出力', color: 's1', x0: a.x0, dx: a.dx, y: a.y, w: 1.6}], vl: [{x: 20, label: '目標1'}, {x: 20 + S.dr / 1000, label: '目標2（' + S.a2 + ' dB）'}], tipy: v => fx(v, 1) + ' dB'}, RKM));
    return {w3m: m.w3 * 1.5e8, psl: m.psl, tiles: [{k: '時間帯域幅積 T·B', v: fx(w.TB, 0)}, {k: '山の 3 dB 幅', v: fx(m.w3 * 1.5e8, 0) + ' <small>m</small>'}, {k: 'いちばん大きいサイドローブ', v: fx(m.psl, 1) + ' <small>dB</small>', s: '電力 ' + ratioTxt(m.psl)}, {k: 'ミスマッチ損失', v: fx(r.lossDb, 2) + ' <small>dB</small>'}]};
  }});
boot();
</script>
</body>
</html>
