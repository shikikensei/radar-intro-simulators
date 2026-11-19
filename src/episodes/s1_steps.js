/* ============================================================
   第1回 パルス圧縮：ステップの定義
   ============================================================ */
function resetS(init){ for (const k in S) delete S[k]; Object.assign(S, DEFAULTS, {t2: false, pos: 0, nc: 13, r1: 20, noise: false}, init); }
const PRE = ['wave', 'db', 'iq'];
const fkm = v => fx(v, 2) + ' km', fus = v => fx(v, v < 10 && v % 1 ? 1 : 0) + ' µs';
const CT = {
  T: {l: 'パルス幅 T（パルスの時間長）', min: 5, max: 100, step: 5, f: fus, h: v => 'エネルギーは T に比例'},
  B: {l: '帯域幅 B（周波数を変化させる幅）', min: 0.2, max: 4, step: 0.1, f: v => fx(v, 1) + ' MHz'},
  wave: {l: '波形', seg: [['cw', '無変調'], ['lfm', 'LFM'], ['barker', 'バーカー13']]},
  wt: {l: '重み付け', seg: [['none', 'なし'], ['taylor', 'テイラー']]},
  dr: {l: '2 つの目標の間隔', min: 30, max: 3000, step: 30, f: v => fx(v, 0) + ' m'},
  snr: {l: '入力の S/N（圧縮前）', min: -25, max: 10, step: 1, f: v => dbx(v, 0)},
  fd: {l: 'ドップラ周波数', min: -500, max: 500, step: 10, f: v => fx(v, 0) + ' kHz', h: v => v > 0 ? '接近する目標' : v < 0 ? '離隔する目標' : '静止目標'},
  r1: {l: '目標距離', min: 0.5, max: 10, step: 0.25, f: fkm},
  a2: {l: '弱い目標の強度（強い目標との比）', min: -40, max: 0, step: 1, f: v => dbx(v, 0)},
  pos: {l: '参照波形の位置（遅延させる時間）', min: 0, max: 60, step: 0.1, f: v => fx(v, 1) + ' µs'},
  nc: {l: '符号長 N', seg: [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [7, '7'], [11, '11'], [13, '13']]},
  t2: {l: '目標を 2 つにする', chk: true},
  noise: {l: '雑音を加える', chk: true}
};
const wav = () => makeWave(S.wave, S.T, S.B, S.nc);
function tgts(){ const t = [{R: S.r1 * 1000, A: 1, ph: 0}]; if (S.t2) t.push({R: S.r1 * 1000 + S.dr, A: db2a(S.a2), ph: Math.PI / 2}); return t; }
function rseg(y, dt, r0, r1){ const k = dt * C / 2000, i0 = Math.max(0, Math.floor(r0 / k)), i1 = Math.min(y.length - 1, Math.ceil(r1 / k)); return {x0: i0 * k, dx: k, y: y.subarray(i0, i1 + 1)}; }
const amp = (re, im) => { const o = new Float64Array(re.length); for (let i = 0; i < o.length; i++) o[i] = Math.hypot(re[i], im[i]); return o; };
const dbA = (m, ref) => { const o = new Float64Array(m.length); for (let i = 0; i < o.length; i++) o[i] = 20 * Math.log10(Math.max(m[i] / ref, 1e-6)); return o; };
const RKM = {xl: '距離 [km]（レーダからの距離）', tipx: v => '距離 ' + fx(v, 3) + ' km'};
const STEPS = [];

/* 1 */
STEPS.push({short: '圧縮の目的', title: 'パルス圧縮の目的 — 長いパルスのエネルギーと、短いパルスの距離分解能を両立する', src: '§8.1 Introduction（p.8.1–8.2）、§8.2 表8.1（p.8.5）',
  q: '遠距離まで探知するには、パルス幅を長くして、送信するエネルギーを増やす必要があります。無変調のままパルス幅を 2 倍にすると、近接した 2 つの目標の分解能はどうなりますか。',
  ch: ['高くなる', '変わらない', '低くなる（分解できる間隔が 2 倍になる）'], ans: 2,
  why: '無変調のパルスでは、エコーの長さがパルス幅そのものになります。長くするほど 2 つのエコーが重なり、1 つのピークに見えます。LFM による{{g-pulse-compression|パルス圧縮}}では、分解能が帯域幅 B で決まるため、パルス幅を長くしても分解能は保たれます。',
  read: {
    ana: '遠くの人に声を届けるには、短く「あ」と叫ぶより、長く「あー」と伸ばしたほうが多くのエネルギーを送れます。しかし、2 人が同時に「あー」と言うと、声が重なって、何人いるのかが分かりません。',
    what: 'レーダも同様です。上の図は無変調の長いパルスを送信した場合の[[merge|2 つの目標のエコー]]です。パルス幅 T が長いと、エコーが重なって 1 つのピークになります。||下の図は同じ長さのパルスに変調（LFM：パルスの中で周波数を直線的に変化させる変調）をかけ、受信側で[[peaks|幅の狭いパルスに圧縮した]]ものです。これがパルス圧縮（pulse compression）であり、長いパルスのエネルギーと、短いパルスの{{g-range-resolution|距離分解能}}を両立できます。',
    eq: '圧縮比 ≈ <i>T</i>·<i>B</i>　　距離分解能 ≈ <i>c</i> / (2<i>B</i>)',
    sym: '<i>T</i>：送信パルス幅 [秒]。<i>B</i>：変調によって広げた帯域幅 [Hz]。<i>c</i>：光速（3×10⁸ m/s）。<i>T</i>·<i>B</i> は{{g-time-bandwidth-product|時間帯域幅積}}（time-bandwidth product）です。B = 2 MHz の場合、分解能は約 75 m であり、T にはよりません。',
    mis: '「圧縮するとエネルギーが増える」という理解は誤りです。送信したエネルギーは変わらず、長い時間に分散していたものを 1 点に集中させ直すだけです。'},
  hosoku: ['声のたとえ', '下の図で比較している「同じ尖頭電力の短いパルス」の考え方と無変調パルスの分解能の目安 cT/2'],
  memo: 'つまずきやすい点は、エネルギー（T で決まる）と分解能（B で決まる）を別々に選べる、という考え方そのものです。||声かけの例：「T を 3 µs まで短くすると分離して見えますが、その場合に送信したエネルギーは最初の何分の 1 ですか」「下の図で T を変えてもピークの幅が変わらないのはなぜですか」',
  init: {T: 20, B: 2, t2: true, dr: 600, a2: 0}, ctl: [{k: 'T', min: 1, max: 20, step: 1}], fixed: ['dr', 'B'], plots: [{h: 190}, {h: 190}],
  mission: {t: '上の図（無変調）で、600 m 離れた 2 つの目標が 2 つのピークに分離して見えるまで、パルス幅を短くしましょう。その場合にエネルギーが何分の 1 になったかも確かめましょう。', ok: r => r.sep},
  sol: {T: 3},
  draw(P){
    const wc = makeWave('cw', S.T, S.B), sc = makeScene(wc, {targets: tgts(), fd: 0}), a = rseg(amp(sc.re, sc.im), 1 / FS, 19.5, 24.2);
    const wl = makeWave('lfm', S.T, S.B), y = compress(makeScene(wl, {targets: tgts(), fd: 0}), wl, 'none', 4), b = rseg(y.mag, y.dt, 19.5, 24.2), sep = S.T * 150 < S.dr;
    P[0].set(Object.assign({title: '無変調のパルス：受信したエコーの振幅', xr: [19.5, 24.2], yr: [0, 1.8], yl: 'エコーの振幅', series: [{name: '2 つの目標のエコー', color: 's1', x0: a.x0, dx: a.dx, y: a.y, w: 2, fill: 0.15}],
      vl: [{x: 20, label: '目標1'}, {x: 20.6, label: '目標2'}], notes: [sep ? {x: 20.52, y: 0.05, t: '間に落ち込みがある＝2 つと分かる', dx: 60, dy: -70} : {x: 20.8, y: 1.41, t: '重なって 1 つのピークに見える', dx: 50, dy: -14}],
      marks: {merge: {x0: 20, x1: 20.6 + S.T * 0.15, t: '2 つの目標のエコー'}}}, RKM));
    P[1].set(Object.assign({title: '同じ長さのパルスに LFM をかけて圧縮した後', xr: [19.5, 24.2], yr: [0, 1.3], yl: '圧縮後の振幅', series: [{name: '圧縮後の出力', color: 's2', x0: b.x0, dx: b.dx, y: b.y, w: 2}],
      notes: [{x: 20.6, y: 1, t: '常に 2 本に分離する', dx: 50, dy: -4}], marks: {peaks: {x0: 19.9, x1: 20.7, t: '幅の狭いパルスに圧縮された'}}}, RKM));
    return {sep, tiles: [{k: '送信エネルギー（T = 20 µs を 1 として）', v: S.T === 20 ? '1 倍' : '1/' + fx(20 / S.T, 1), s: dbx(10 * Math.log10(S.T / 20))},
      {k: '無変調の場合の分解能の目安 cT/2', v: fx(S.T * 150, 0) + ' <small>m</small>', s: '目標の間隔は 600 m'}, {k: 'LFM の分解能の目安 c/(2B)', v: fx(150 / S.B, 0) + ' <small>m</small>', s: 'T を変えても同じ'}]};
  }});

/* 2 */
STEPS.push({short: 'LFM 波形', title: 'LFM（チャープ）波形 — パルスの中で周波数を直線的に変化させる', src: '§8.2 Linear Frequency Modulation（p.8.3–8.5、式8.3〜8.6）',
  q: '基準の周波数が 0 になるように変換した LFM のパルス（ベースバンド信号）を観測します。波形の振動が最も遅くなるのは、パルスのどの部分ですか。',
  ch: ['パルスの先頭', 'パルスの中央', 'パルスの末尾'], ans: 1,
  why: 'LFM は周波数を −B/2 から +B/2 まで直線的に変化させます。中央で周波数がちょうど 0 を通過するため、そこで振動が最も遅くなります。両端は「負の周波数」と「正の周波数」であり、振動の周期は同じです。',
  read: {
    ana: '鳥のさえずりのように、音の高さが連続して変化する音をチャープと呼びます。同じ高さが続く音とは異なり、音のどの部分にも「その瞬間だけの高さ」という目印が付いています。',
    what: '線形周波数変調（linear frequency modulation、{{g-lfm|LFM}}）は、パルスの中で[[freq|周波数を直線的に変化させる]]波形です。変化させる幅が帯域幅 B、パルスの時間長がパルス幅 T です。||上の図は[[wave|波形の I 成分と Q 成分]]です。中央で振動が遅くなり、両端で速くなります。B を広げると、両端の振動が速くなります。',
    eq: '<i>f</i>(<i>t</i>) = (<i>B</i> / <i>T</i>)·<i>t</i>　　（−<i>T</i>/2 ≤ <i>t</i> ≤ <i>T</i>/2）',
    sym: '<i>f</i>(<i>t</i>)：時刻 <i>t</i> での周波数（瞬時周波数）[Hz]。<i>t</i>：パルスの中央を 0 とした時刻 [秒]。<i>B</i>：帯域幅 [Hz]。<i>T</i>：パルス幅 [秒]。<i>B</i>/<i>T</i> が周波数の変化率（傾き）です。',
    mis: '「中央は周波数が低く、両端が高い」という理解は誤りです。前半は負の周波数、後半は正の周波数であり、I と Q のどちらが先行するかが逆になっています。{H}実際の送信ではこれに搬送波の高い周波数が加わります。'},
  hosoku: ['鳥のさえずりのたとえ', 'ベースバンドでは中央で周波数が 0 を通過するため、実部が「速い→遅い→速い」に見えるという説明', '実際の送信では搬送波の周波数が加わること'],
  memo: 'つまずきやすい点は、「負の周波数」です。I/Q の矢印（フェーザ）が逆方向に回転することである、と説明すると理解しやすくなります。||声かけの例：「B を 2 倍にすると、下の図の直線の傾きはどうなりますか」「T·B が大きいほど、何が改善されるのでしたか（ステップ1）」',
  init: {T: 40, B: 1, wave: 'lfm'}, ctl: ['B'], fixed: ['T'], plots: [{h: 200}, {h: 180}],
  mission: {t: '時間帯域幅積 T·B を、ちょうど 100 にしましょう。', ok: r => Math.abs(r.TB - 100) < 0.5}, sol: {B: 2.5},
  draw(P){
    const w = wav(), N = w.N, t = new Float64Array(N), f = new Float64Array(N); for (let i = 0; i < N; i++){ t[i] = (i / FS - w.T / 2) * 1e6; f[i] = S.B * t[i] / S.T; }
    P[0].set({title: 'LFM の波形（I 成分と Q 成分）', xr: [-S.T / 2, S.T / 2], yr: [-1.3, 1.3], xl: '時刻 [µs]（パルスの中央が 0）', yl: '振幅', series: [{name: 'I 成分（実部）', color: 's1', x: t, y: w.re, w: 1.8}, {name: 'Q 成分（虚部）', color: 's2', x: t, y: w.im, w: 1.2, alpha: 0.7}],
      notes: [{x: 0, y: 1, t: '中央：振動が遅い', dx: 24, dy: -6}], marks: {wave: {t: 'I 成分と Q 成分'}}, tipx: v => fx(v, 1) + ' µs', tipy: v => fx(v, 2)});
    P[1].set({title: '瞬時周波数', xr: [-S.T / 2, S.T / 2], yr: [-2.2, 2.2], xl: '時刻 [µs]', yl: '周波数 [MHz]', series: [{name: '瞬時周波数', color: 's3', x: t, y: f, w: 2.4}], hl: [{y: 0, label: '周波数 0', left: true}],
      notes: [{x: S.T / 2, y: S.B / 2, t: '+B/2 = ' + fx(S.B / 2, 2) + ' MHz', dx: -40, dy: -18}], marks: {freq: {y0: -S.B / 2, y1: S.B / 2, t: '−B/2 から +B/2 まで直線的に変化'}}, tipx: v => fx(v, 1) + ' µs', tipy: v => fx(v, 2) + ' MHz'});
    return {TB: S.T * S.B, tiles: [{k: '時間帯域幅積 T·B', v: fx(S.T * S.B, 0), s: 'パルス圧縮比の目安'}, {k: '周波数の変化率 B/T', v: fx(S.B / S.T * 1000, 0) + ' <small>kHz/µs</small>'}, {k: '圧縮後のパルス幅の目安 1/B', v: fx(1 / S.B, 2) + ' <small>µs</small>', s: '送信パルスは ' + S.T + ' µs'}]};
  }});

/* 3 */
STEPS.push({short: '整合フィルタ', title: '整合フィルタと相関 — 参照波形を遅延させながら、乗算して加算する', src: '§8.1（p.8.1–8.2）、付録 Matched Filters・Matched Filter Time Response（p.8.39–8.41）',
  q: '送信波形の複製（参照波形）を、受信信号に対して少しずつ遅延させながら「乗算して加算」します。出力が最大になるのは、どの時点ですか。',
  ch: ['参照波形がエコーに重なり始めた時点', '参照波形がエコーに完全に重なった時点', '参照波形がエコーを通過した時点'], ans: 1,
  why: '完全に重なった瞬間だけ、乗算の結果がすべて同位相になり、加算の結果が最大になります。わずかでも外れると、正と負の成分が混在して打ち消し合います。LFM では許容される時間差が約 1/B と短いため、出力が幅の狭いパルスになります。',
  read: {
    ana: '型抜きクッキーの型を、生地の上で少しずつ動かしていく場面を想像してください。型と模様が完全に合った瞬間だけ、型がはまります。整合フィルタは送信波形という「型」を、受信信号の上で移動させる処理です。',
    what: '{{g-matched-filter|整合フィルタ}}（matched filter）は、[[ref|参照波形]]（送信波形の複製）を受信信号に対して遅延させながら、重なった部分を乗算して加算します。この計算を相関と呼びます。||下の図が[[out|出力]]です。「動かす」を押すと、参照波形がエコーに重なる瞬間にだけ、出力に鋭いピークが生じます。ピークの位置がエコーの遅延時間、すなわち目標距離を表します。',
    eq: '<i>y</i>(τ) = ∫ <i>r</i>(<i>t</i>)·<i>u</i>*(<i>t</i> − τ) d<i>t</i>',
    sym: '<i>y</i>(τ)：遅延量が τ の場合の出力。<i>r</i>(<i>t</i>)：受信信号。<i>u</i>(<i>t</i>)：送信波形（参照波形）。* は複素共役（位相の符号を反転する操作）。∫ は「重なった部分をすべて加算する」ことを表します。',
    mis: '整合フィルタは「エコーの形をそのまま取り出す」フィルタではありません。出力の形は送信波形とは異なり（自己相関）、ピークの S/N を最大にすることが目的です。'},
  hosoku: ['型抜きのたとえ', 'わずかに外れると乗算の結果に正負が混在して打ち消し合い、許容される時間差が約 1/B であるという説明', '式は相関の形に書き直したもの'],
  memo: 'つまずきやすい点は、「乗算して加算する」ことがなぜピークを生じさせるのか、という点です。位相がそろうこと、すなわち矢印（フェーザ）が同じ方向に並ぶことである、と言い換えます。||声かけの例：「参照波形を 1 µs だけ遅延させると、出力はどの程度下がりましたか」「ピークの位置から目標距離を計算してみましょう（1 µs = 150 m）」',
  init: {T: 20, B: 1, wave: 'lfm', pos: 5}, ctl: ['pos'], fixed: ['T', 'B'], plots: [{h: 200}, {h: 170}],
  acts: [{t: '▶ 動かす', play: {k: 'pos', min: 0, max: 60, step: 0.4, ms: 60, once: true}}],
  mission: {t: '出力が最大になる位置に、参照波形を正確に合わせましょう（スライダーは矢印キーで細かく動かせます）。', ok: r => Math.abs(S.pos - 30) < 0.15}, sol: {pos: 30},
  draw(P){
    const w = wav(), sc = makeScene(w, {targets: [{R: 4500, A: 1, ph: 0}], fd: 0}), y = compress(sc, w, 'none', 1), n = Math.round(S.pos * 10), ref = new Float64Array(w.N); for (let i = 0; i < w.N; i++) ref[i] = w.re[i] - 2.6;
    P[0].set({title: '受信信号（上）と、遅延させていく参照波形（下）', xr: [0, 82], yr: [-3.9, 1.4], xl: '時刻 [µs]（送信からの時間）', yl: '', yticks: [[0, 'エコー'], [-2.6, '参照波形']], series: [{name: '受信したエコー（I 成分）', color: 's1', x0: 0, dx: 0.1, y: sc.re.subarray(0, 820), w: 1.5}, {name: '参照波形（I 成分）', color: 's2', x0: S.pos, dx: 0.1, y: ref, w: 1.5}],
      bands: [{x0: 30, x1: 50, color: 'band', label: 'エコーのある区間'}], marks: {ref: {x0: S.pos, x1: S.pos + S.T, y0: -3.8, y1: -1.4, t: '参照波形'}}, noHover: true});
    P[1].set({title: '整合フィルタの出力（ここまで遅延させた分）', xr: [0, 82], yr: [0, 1.15], xl: '参照波形の遅延時間 [µs]', yl: '出力の振幅', series: [{name: '出力', color: 's3', x0: 0, dx: 0.1, y: y.mag.subarray(0, n + 1), w: 2}],
      pts: [{x: S.pos, y: y.mag[n], color: 's3', label: fx(y.mag[n], 2)}], notes: S.pos >= 30 ? [{x: 30, y: 1, t: '完全に重なった瞬間', dx: 40, dy: 0}] : [], marks: {out: {x0: 26, x1: 34, t: '出力のピーク'}}, tipx: v => fx(v, 1) + ' µs', tipy: v => fx(v, 2)});
    return {tiles: [{k: '現在の出力', v: fx(y.mag[n], 2), s: '最大は 1.00'}, {k: '遅延時間', v: fx(S.pos, 1) + ' <small>µs</small>', s: '距離に換算すると ' + fx(S.pos * 0.15, 2) + ' km'}]};
  }});

/* 4 */
STEPS.push({short: '距離分解能', title: '距離分解能 — 近接した 2 つの目標を分離する', src: '§8.2 Time Delay and Range Resolution Widths・表8.1（p.8.4–8.5）',
  q: '300 m 離れた 2 つの目標が、圧縮後に 1 つのピークに見えています。2 つに分離するには、何を変えることが有効ですか。',
  ch: ['パルス幅 T を長くする', '帯域幅 B を広げる', 'どちらを変えても同じ'], ans: 1,
  why: '圧縮後のパルス幅は、約 1/B です。B を広げるほどピークの幅が狭くなり、近接した目標を分離できます。パルス幅 T は圧縮後の幅には影響しません（T が影響するのはエネルギー、すなわち S/N です）。',
  read: {
    ana: '太いマジックで書いた 2 本の線は、近づけるとつながって 1 本に見えます。細いペンであれば、同じ間隔でも 2 本であると分かります。距離分解能はこの「ペンの太さ」に当たります。',
    what: '圧縮後の[[lobe|ピーク（メインローブ）の幅]]は帯域幅 B で決まります。振幅が約 7 割（3 dB 下）になる幅は 0.886/B です。||これに c/2 を掛けると距離になります。目安としてよく使う c/(2B) は、やや低いレベル（3.9 dB 下）で測った幅に当たります。上の図で B を変えて、[[dip|2 つのピークの間の落ち込み]]がどのように変わるかを確かめてください。',
    eq: 'Δ<i>R</i> ≈ <i>c</i> / (2<i>B</i>)',
    sym: 'Δ<i>R</i>：距離分解能 [m]。<i>c</i>：光速（3×10⁸ m/s）。<i>B</i>：帯域幅 [Hz]。B = 1 MHz の場合は約 150 m です。2 で割るのは、電波が往復するためです。',
    mis: '「パルス幅を長くすると分解能が低くなる」のは、無変調の場合だけです。パルス圧縮では T を長くしても分解能は変わりません。下の図（無変調）と比較してください。'},
  hosoku: ['ペンの太さのたとえ', '2 つのエコーの位相差を 90° に固定していること（落ち込みの深さは位相差によって変わる）'],
  memo: 'つまずきやすい点は、分解能（分離する能力）と精度（位置を測定する正確さ）の混同です。ここで扱うのは分解能です。||声かけの例：「B を 2 倍にすると、ピークの幅はどうなりますか」「落ち込みがちょうど現れ始める B の場合、c/(2B) は何 m ですか。間隔 300 m と比較するとどうですか」',
  init: {T: 40, B: 0.3, wave: 'lfm', t2: true, dr: 300, a2: 0}, ctl: ['B'], fixed: ['T', 'dr'], plots: [{h: 210}, {h: 150}],
  mission: {t: '2 つのピークの間に、深さ 3 dB 以上（ピークの振幅の約 7 割以下）の落ち込みが生じるようにしましょう。ただし、帯域幅は 1 MHz 以下とします。', ok: r => r.dip >= 3 && S.B <= 1.0001}, sol: {B: 0.8},
  draw(P){
    const w = wav(), y = compress(makeScene(w, {targets: tgts(), fd: 0}), w, 'none', 4), a = rseg(y.mag, y.dt, 19, 21.3), k = y.dt * 1.5e8;
    const i1 = Math.round(20000 / k), i2 = Math.round(20300 / k), pk = Math.min(maxIn(y.mag, i1 - 2, i1 + 2), maxIn(y.mag, i2 - 2, i2 + 2)); let mn = Infinity; for (let i = i1; i <= i2; i++) if (y.mag[i] < mn) mn = y.mag[i];
    const dip = Math.max(0, 20 * Math.log10(pk / Math.max(mn, 1e-9))), wc = makeWave('cw', S.T, S.B), yc = compress(makeScene(wc, {targets: tgts(), fd: 0}), wc, 'none', 1), c = rseg(yc.mag, yc.dt, 13, 27);
    P[0].set(Object.assign({title: 'LFM：圧縮後の出力（目標は 20.0 km と 20.3 km）', xr: [19, 21.3], yr: [0, 1.5], yl: '圧縮後の振幅', series: [{name: '圧縮後の出力', color: 's1', x0: a.x0, dx: a.dx, y: a.y, w: 2}], vl: [{x: 20, label: '目標1'}, {x: 20.3, label: '目標2'}],
      notes: [dip >= 3 ? {x: 20.15, y: mn, t: '落ち込みの深さ ' + fx(dip, 1) + ' dB', dx: 60, dy: 40} : {x: 20.15, y: mn, t: 'まだ 1 つのピーク', dx: 60, dy: -30}], marks: {lobe: {x0: 20 - 0.0665 / S.B, x1: 20 + 0.0665 / S.B, t: 'ピークの幅（3 dB 幅）= 0.886/B'}, dip: {x0: 20.05, x1: 20.25, t: '落ち込み'}}}, RKM));
    P[1].set(Object.assign({title: '比較：同じ長さ（40 µs）の無変調パルス', xr: [13, 27], yr: [0, 1.5], yl: '振幅', series: [{name: '無変調の出力', color: 'ref', x0: c.x0, dx: c.dx, y: c.y, w: 2}], notes: [{x: 20.15, y: 1.38, t: '300 m の差はまったく分離できない', dx: 40, dy: 30}]}, RKM));
    return {dip, tiles: [{k: '分解能の目安 c/(2B)', v: fx(150 / S.B, 0) + ' <small>m</small>', s: '目標の間隔は 300 m'}, {k: 'ピークの 3 dB 幅（0.886/B を距離に換算）', v: fx(0.886 * 150 / S.B, 0) + ' <small>m</small>'}, {k: '2 つのピークの間の落ち込み', v: dip >= 0.05 ? fx(dip, 1) + ' <small>dB</small>' : 'なし', s: dip >= 0.05 ? '落ち込みの振幅はピークの ' + fx(Math.pow(10, -dip / 20) * 100, 0) + '%' : '1 つのピークに見える'}]};
  }});

/* 5 */
STEPS.push({short: '雑音の中の検出', title: '雑音の中での検出 — 埋もれたエコーが圧縮によって現れる', src: '付録 Matched Filters（p.8.39、式8.42〜8.45）、§8.1（p.8.1–8.2）',
  q: 'エコーは雑音より弱く、圧縮前には検出できません。パルス幅 T を 2 倍にすると、圧縮後のピークの S/N はどうなりますか。',
  ch: ['変わらない', '約 3 dB（2 倍）向上する', '約 6 dB（4 倍）向上する'], ans: 1,
  why: '整合フィルタの出力の S/N は、受信信号のエネルギーで決まります。同じ電力でパルス幅を 2 倍にすると、エネルギーが 2 倍になるため、S/N は 2 倍（約 3 dB）向上します。',
  read: {
    ana: '騒がしい教室で、1 人が小さな声で話しても聞こえません。しかし、100 人が同じ言葉を同じタイミングで言えば、はっきり聞こえます。不規則なざわめき（雑音）は、加算してもそれほど大きくならないためです。',
    what: '上の図は圧縮前です。[[before|エコー]]は雑音より弱く、どこにあるかが分かりません。下の図は整合フィルタを通した後であり、パルス全体のエネルギーが 1 点に集中し、[[after|ピーク]]が雑音を上回ります。||整合フィルタは雑音の中の信号に対して、出力のピークの {{g-snr|S/N}} を最大にするフィルタです。その S/N は信号のエネルギーだけで決まり、波形の種類にはよりません。',
    eq: '(S/N)<sub>出力</sub> = 2<i>E</i> / <i>N</i><sub>0</sub>',
    sym: '<i>E</i>：受信信号のエネルギー [J]（電力 × パルス幅）。<i>N</i><sub>0</sub>：雑音電力密度 [W/Hz]（1 Hz あたりの雑音電力）。パルス幅を長くすると <i>E</i> が増えます。',
    mis: '「LFM にすると S/N が向上する」という理解は誤りです。同じ長さ・同じ電力であれば、無変調でも LFM でも圧縮後の S/N は同じです。変調の目的は S/N ではなく、分解能です。'},
  hosoku: ['教室のたとえ', '入力の S/N を 1 サンプルあたりで定義し、改善量を 10·log(サンプル数) としていること'],
  memo: 'つまずきやすい点は、「改善量」の数値が入力の S/N の定義（雑音の帯域幅）によって変わることです。ここではサンプル数を N = T × 10 MHz としています。||声かけの例：「T を 10 µs から 40 µs にすると、ピークは何 dB 上がりましたか」「雑音のレベル（0 dB の線）は変わりましたか」',
  init: {T: 10, B: 2, wave: 'lfm', snr: -10}, ctl: ['T'], fixed: ['snr', 'B'], plots: [{h: 170}, {h: 200}], acts: [{t: '別の雑音にする', f: () => { S.seed++; }}],
  mission: {t: '圧縮後のピークの S/N が 15 dB 以上（電力で約 32 倍）になる、最も短いパルス幅を見つけましょう。', ok: r => r.out >= 15 && r.out - 10 * Math.log10(S.T / (S.T - 5)) < 15}, sol: {T: 35},
  draw(P){
    const w = wav(), sc = makeScene(w, {targets: [{R: 20000, A: 1, ph: 0}], fd: 0, noise: true}), sg = Math.pow(10, -S.snr / 20), y = compress(sc, w, 'none', 1);
    const a = rseg(dbA(amp(sc.re, sc.im), sg), 1 / FS, 17, 37), b = rseg(dbA(y.mag, sg / Math.sqrt(w.N)), y.dt, 17, 37), gain = 10 * Math.log10(w.N), out = S.snr + gain;
    P[0].set(Object.assign({title: '圧縮前：受信信号の強度', xr: [17, 37], yr: [-25, 25], yl: '強度 [dB]（雑音の平均 = 0）', series: [{name: '受信信号', color: 'ref', x0: a.x0, dx: a.dx, y: a.y, w: 1}], bands: [{x0: 20, x1: 20 + S.T * 0.15, color: 'band', label: 'エコーの位置'}],
      marks: {before: {x0: 20, x1: 20 + S.T * 0.15, t: 'エコー（雑音より ' + (-S.snr) + ' dB 弱い）'}}, tipy: v => fx(v, 1) + ' dB'}, RKM));
    P[1].set(Object.assign({title: '圧縮後：整合フィルタの出力', xr: [17, 37], yr: [-25, 25], yl: '強度 [dB]（雑音の平均 = 0）', series: [{name: '圧縮後の出力', color: 's1', x0: b.x0, dx: b.dx, y: b.y, w: 1.2}], hl: [{y: 15, label: '目標値の 15 dB', left: false}],
      notes: [{x: 20, y: out, t: 'ピーク（理論値 ' + fx(out, 1) + ' dB）', dx: 46, dy: 6}], marks: {after: {x0: 19.6, x1: 20.4, t: '1 点に集中したピーク'}}, tipy: v => fx(v, 1) + ' dB'}, RKM));
    return {out, tiles: [{k: '圧縮前の S/N', v: fx(S.snr, 0) + ' <small>dB</small>', s: '電力 ' + ratioTxt(S.snr)}, {k: '圧縮による改善', v: '+' + fx(gain, 1) + ' <small>dB</small>', s: '加算するサンプル数 ' + w.N + ' 倍'}, {k: '圧縮後のピークの S/N（理論）', v: fx(out, 1) + ' <small>dB</small>', s: '電力 ' + ratioTxt(out)}]};
  }});

/* 6 */
STEPS.push({short: 'サイドローブ', title: 'サイドローブと重み付け — 強い目標のサイドローブに、弱い目標が隠れる', src: '§8.2 Frequency Domain Weighting・表8.2（p.8.7–8.8、式8.10〜8.12）、第4章 Pulse Compression Mismatch Loss（p.4.39–4.40）',
  q: '強い目標のすぐ隣に、電力が 1/1000（−30 dB）の弱い目標があります。テイラーの重み付けを行うと、圧縮後の出力はどのように変わりますか。',
  ch: ['サイドローブが下がり、メインローブの幅はやや広くなる', 'サイドローブも下がり、メインローブの幅も狭くなる', '何も変わらない'], ans: 0,
  why: '重み付けは、サイドローブを −13 dB から −40 dB まで下げます。その代わり、メインローブの幅が 0.886/B から 1.25/B に広がり、S/N が 1.15 dB 低下します（ミスマッチ損失）。利点だけをもつ方法はありません。',
  read: {
    ana: '夜、明るい街灯のすぐ隣にある小さな豆電球は、街灯の光のにじみに隠れて見えません。にじみを抑えるフィルタをかけると豆電球が見えますが、街灯の像はやや不鮮明になります。',
    what: '圧縮後のピークの両側には、[[sl|小さなピーク]]が並びます。これを{{g-time-sidelobe|時間サイドローブ}}（time sidelobe）と呼びます。重み付けなしの LFM では、最大の時間サイドローブはメインローブに対して −13.2 dB です。強い目標のサイドローブは、近くの[[weak|弱い目標]]を隠します。||{{g-taylor-weighting|テイラー重み付け}}（Taylor weighting）は、周波数の両端の振幅を小さくすることによって、サイドローブを下げます。その代わりに整合フィルタからわずかに外れるため、S/N が低下します。これが{{g-mismatch-loss|ミスマッチ損失}}（mismatch loss）です。',
    eq: 'ミスマッチ損失 <i>L</i><sub>m</sub> = (S/N)<sub>整合フィルタ</sub> / (S/N)<sub>重み付け後</sub>',
    sym: '<i>L</i><sub>m</sub>：ミスマッチ損失（1 以上の比。dB で表すことが多い）。−40 dB のテイラー重み付けでは 1.15 dB（電力で約 1.3 倍の損失）です。',
    mis: '「サイドローブ」は雑音ではありません。強い目標そのものの応答の一部です。このため、S/N をどれだけ上げてもなくならず、重み付けによってしか下がりません。'},
  hosoku: ['街灯のたとえ', '弱い目標を 260 m 隣に置いた場面の設定'],
  memo: 'つまずきやすい点は、サイドローブと雑音の区別です。目標の強度を変えるとサイドローブもともに上下することを確認させます。||声かけの例：「重み付けなしで検出できるのは、弱い目標が何 dB の場合までですか」「テイラーの重み付けにすると、メインローブの幅は何倍になりましたか」',
  init: {T: 40, B: 2, wave: 'lfm', t2: true, dr: 260, a2: -15, wt: 'none'}, ctl: ['wt', 'a2'], fixed: ['T', 'B', 'dr'], plots: [{h: 260}],
  mission: {t: '弱い目標を −30 dB（電力 1/1000）まで下げ、その状態でもピークとして見えるようにしましょう。', ok: r => S.a2 <= -30 && S.wt === 'taylor'}, sol: {a2: -30, wt: 'taylor'},
  draw(P){
    const w = wav(), y = compress(makeScene(w, {targets: tgts(), fd: 0}), w, S.wt, 4), a = rseg(dbA(y.mag, 1), y.dt, 19.2, 20.8), y1 = compress(makeScene(w, {targets: [tgts()[0]], fd: 0}), w, S.wt, 4), b = rseg(dbA(y1.mag, 1), y1.dt, 19.2, 20.8), r = response(w, 0, S.wt), m = metrics(r);
    P[0].set(Object.assign({title: '圧縮後の出力（縦軸は dB。強い目標のピークが 0 dB）', xr: [19.2, 20.8], yr: [-65, 6], yl: '強度 [dB]（強い目標 = 0）', series: [{name: '強い目標だけの場合', color: 'ref', x0: b.x0, dx: b.dx, y: b.y, w: 1.2, dash: [4, 3]}, {name: '弱い目標もある場合', color: 's1', x0: a.x0, dx: a.dx, y: a.y, w: 2}],
      hl: [{y: S.a2, label: '弱い目標の強度 ' + fx(S.a2, 0) + ' dB', left: true}], notes: [{x: 20.26, y: S.a2, t: '弱い目標の位置', dx: 40, dy: -30}], marks: {sl: {x0: 20.06, x1: 20.75, y0: -64, y1: m.psl + 3, t: 'サイドローブ（最大 ' + fx(m.psl, 1) + ' dB）'}, weak: {x0: 20.2, x1: 20.32, t: '弱い目標'}}, tipy: v => fx(v, 1) + ' dB'}, RKM));
    return {tiles: [{k: '最も大きいサイドローブ', v: fx(m.psl, 1) + ' <small>dB</small>', s: 'メインローブの電力の ' + ratioTxt(m.psl)}, {k: 'メインローブの 3 dB 幅', v: fx(m.w3 * S.B * 1e6, 2) + ' <small>/B</small>', s: '距離では ' + fx(m.w3 * 1.5e8, 0) + ' m'}, {k: 'ミスマッチ損失', v: fx(r.lossDb, 2) + ' <small>dB</small>', s: S.wt === 'taylor' ? 'S/N が電力で ' + ratioTxt(-r.lossDb) + ' に' : '重み付けなしのため 0'}]};
  }});

/* 7 */
STEPS.push({short: 'ドップラの影響', title: 'ドップラの影響 — LFM は形を保つが、位置が変化する', src: '§8.2 LFM・Range-Doppler Coupling（p.8.3–8.6、式8.7〜8.9）、Binary Phase Codes（p.8.17）、§8.3 表8.8（p.8.27）',
  q: '目標が接近しており、エコーにドップラ偏移が生じています。LFM で圧縮すると、出力のピークはどうなりますか。',
  ch: ['ほとんど消失する', '形はほぼ変わらず、位置が変化する', '位置は変わらず、幅が大きく広がる'], ans: 1,
  why: 'LFM では「時刻」と「周波数」が直線の関係にあります。エコー全体の周波数が fd だけ偏移すると、参照波形と一致する時刻が fd·T/B だけ変化します。ピークの形と高さは、ほとんど変わりません。これが距離ドップラ結合です。',
  read: {
    ana: '音階を順に上がっていく音（ドレミファ…）が、全体にやや高い音で演奏されたとします。「ミ」を待っている人には、本来よりやや早いタイミングで「ミ」の高さの音が聞こえます。音の高さの差が時間の差として現れます。',
    what: '運動する目標のエコーには、{{g-doppler-frequency|ドップラ周波数}} fd が加わります。LFM では[[shift|ピークの位置]]が fd·T/B だけ時間方向に変化します。これを{{g-range-doppler-coupling|距離ドップラ結合}}（range-Doppler coupling）と呼びます。接近する目標（fd が正）は、アップチャープの場合、近距離側に現れます。||形と S/N はほとんど変わらないため、±B/10 程度までのドップラ周波数であれば、1 本のフィルタで対応できます。一方、バーカー符号のような位相符号はドップラ周波数に敏感であり、ピークが下がってサイドローブが上がります（波形を切り替えて比較してください）。',
    eq: 'Δ<i>t</i> = −<i>f</i><sub>d</sub>·<i>T</i> / <i>B</i>',
    sym: 'Δ<i>t</i>：ピークの位置の変化 [秒]（負は早い側＝近距離側）。<i>f</i><sub>d</sub>：ドップラ周波数 [Hz]。<i>T</i>：パルス幅 [秒]。<i>B</i>：帯域幅 [Hz]。距離の変化は Δ<i>t</i>·<i>c</i>/2 です。',
    mis: '「LFM はドップラの影響を受けない」という表現は正確ではありません。形は保たれますが、距離にわずかな誤差が生じます。{H}このスライダーの ±500 kHz は見やすくするための大きな値であり、実際は fd = 2v/λ（波長 0.1 m・300 m/s の場合は 6 kHz）程度です。'},
  hosoku: ['音階のたとえ', 'スライダーの範囲が実際より大きいこと、fd = 2v/λ による実際の値の目安'],
  memo: 'つまずきやすい点は、位置が変化する方向です（アップチャープで接近する目標は近距離側）。式の符号と図を対応させます。||声かけの例：「fd を 2 倍にすると、位置の変化はどうなりますか」「バーカー符号に切り替えて、fd = 20 kHz でピークは何割になりましたか」',
  init: {T: 40, B: 2, wave: 'lfm', fd: 0}, ctl: ['fd', {k: 'wave', seg: [['lfm', 'LFM'], ['barker', 'バーカー13']]}], fixed: ['T', 'B'], plots: [{h: 250}],
  mission: {t: 'LFM でピークの位置がちょうど 300 m 近距離側へ変化するドップラ周波数を見つけましょう。', ok: r => S.wave === 'lfm' && Math.abs(r.dm + 300) < 20}, sol: {fd: 100},
  draw(P){
    const w = wav(), r0 = response(w, 0, 'none'), r = response(w, S.fd * 1e3, 'none'), m = metrics(r), dm = m.tpk * 1.5e8, lim = S.wave === 'lfm' ? 12 : 8;
    const xs = q => { const o = new Float64Array(q.n); for (let i = 0; i < q.n; i++) o[i] = (q.x0 + i * q.dx) * 1e6; return o; };
    P[0].set({title: '圧縮後の出力：ドップラ周波数がない場合（破線）と、ある場合（実線）', xr: [-lim, lim], yr: [0, 1.15], xl: '真の位置からの差 [µs]（1 µs = 150 m。左が近距離側）', yl: '圧縮後の振幅', series: [{name: 'ドップラなし', color: 'ref', x: xs(r0), y: r0.mag, w: 1.4, dash: [5, 3]}, {name: 'ドップラ ' + S.fd + ' kHz', color: 's1', x: xs(r), y: r.mag, w: 2.2}],
      vl: [{x: 0, label: '真の位置'}], notes: Math.abs(S.fd) >= 10 ? [{x: m.tpk * 1e6, y: m.pk, t: '差 ' + fx(dm, 0) + ' m、高さ ' + fx(m.pk * 100, 0) + '%', dx: m.tpk < 0 ? -30 : 30, dy: -6}] : [], marks: {shift: {x0: m.tpk * 1e6 - 0.6, x1: m.tpk * 1e6 + 0.6, t: 'ピークの位置'}}, tipx: v => fx(v, 2) + ' µs', tipy: v => fx(v, 2)});
    return {dm, tiles: [{k: 'ピークの位置の変化', v: fx(m.tpk * 1e6, 2) + ' <small>µs</small>', s: '距離では ' + fx(dm, 0) + ' m' + (dm < -1 ? '（近距離側）' : dm > 1 ? '（遠距離側）' : '')}, S.wave === 'lfm' ? {k: '式の値 −fd·T/B', v: fx(-S.fd * S.T / S.B / 1000, 2) + ' <small>µs</small>'} : null, {k: 'ピークの高さ', v: fx(m.pk * 100, 0) + ' <small>%</small>', s: dbx(20 * Math.log10(Math.max(m.pk, 1e-6)))}]};
  }});

/* 8 */
STEPS.push({short: '位相符号', title: '位相符号波形 — バーカー符号', src: '§8.2 Phase-Coded Waveforms・Binary Phase Codes・Barker Codes・表8.4（p.8.16–8.18）',
  q: '長さ 13 のバーカー符号を圧縮すると、サイドローブのレベル（振幅）はメインローブの何分の 1 になりますか。',
  ch: ['1/2', '1/13', '1/169'], ans: 1,
  why: 'バーカー符号はサイドローブの振幅がどの位置でもメインローブの 1/N 以下になる特別な符号です。N = 13 の場合は 1/13、dB では −22.3 dB です（電力では 1/169 に当たります）。',
  read: {
    ana: '鍵と錠前を考えてください。正しい鍵の場合だけすべての歯がかみ合い、1 つ外れると、かみ合う歯とぶつかる歯がほぼ同数になって、ほとんど力が伝わりません。バーカー符号はこのような性質をもつように選ばれた＋と−の系列です。',
    what: '{{g-phase-coded-waveform|位相符号波形}}（phase-coded waveform）は、パルスを N 個の[[code|サブパルス]]に分け、サブパルスごとに位相を 0° か 180° に切り替えます。圧縮後のピークの幅は、ほぼサブパルス 1 個分です。||{{g-barker-code|バーカー符号}}（Barker code）は、[[bsl|サイドローブ]]がメインローブの 1/N になる符号であり、長さが 2・3・4・5・7・11・13 のものしか知られていません。このため、圧縮比は最大 13 です。',
    eq: 'ピークサイドローブ = −20·log<sub>10</sub>(<i>N</i>)　[dB]',
    sym: '<i>N</i>：符号長（サブパルスの数）。時間帯域幅積と圧縮比も <i>N</i> に等しくなります。N = 13 の場合は −22.3 dB です。',
    mis: '「符号を長くすれば、サイドローブを限りなく下げられる」という理解は誤りです。バーカー符号は長さ 13 までしかなく、それより長い符号では別の種類（サイドローブはやや高い）を使います。'},
  hosoku: ['錠前のたとえ'],
  memo: 'つまずきやすい点は、−20·log N の「20」です（振幅の比であるため）。電力の比では 1/N² になります。||声かけの例：「N = 5 の場合、サイドローブは何 dB ですか。式で計算してから図で確かめましょう」「LFM の重み付けなし（−13.2 dB）と比較して、どちらが低いですか」',
  init: {T: 39, wave: 'barker', nc: 5}, ctl: ['nc'], fixed: ['T'], fixT: ['符号の種類 バーカー符号'], plots: [{h: 130}, {h: 220}],
  mission: {t: 'サイドローブが −20 dB 以下（振幅で 1/10 以下）になる符号長を選びましょう。', ok: r => r.psl <= -20}, sol: {nc: 13},
  draw(P){
    const w = wav(), r = response(w, 0, 'none'), m = metrics(r), cx = [], cy = []; for (let i = 0; i <= w.nc; i++){ cx.push(i); cy.push(w.code.charAt(Math.min(i, w.nc - 1)) === '1' ? 1 : -1); }
    const x = new Float64Array(r.n); for (let i = 0; i < r.n; i++) x[i] = (r.x0 + i * r.dx) * FS / w.chip;
    P[0].set({title: '符号の系列（＋が位相 0°、−が位相 180°）', xr: [0, 13], yr: [-1.6, 1.6], xl: 'サブパルスの番号', yl: '', yticks: [[1, '＋'], [-1, '−']], series: [{name: '符号', color: 's1', x: cx, y: cy, step: true, w: 2.2}], marks: {code: {x0: 0, x1: w.nc, t: 'サブパルス ' + w.nc + ' 個'}}, noHover: true});
    P[1].set({title: '圧縮後の出力', xr: [-13.5, 13.5], yr: [0, 1.12], xl: '真の位置からの差（サブパルスの個数）', yl: '圧縮後の振幅', series: [{name: '圧縮後の出力', color: 's2', x, y: r.mag, w: 2}], hl: [{y: 1 / w.nc, label: '1/N = ' + fx(1 / w.nc, 3), left: true}],
      notes: [{x: 0, y: 1, t: 'メインローブ', dx: 30, dy: 4}], marks: {bsl: {x0: 1, x1: w.nc, y0: 0, y1: 1.6 / w.nc, t: 'サイドローブ'}}, tipx: v => fx(v, 1) + ' 個分', tipy: v => fx(v, 3)});
    return {psl: m.psl, tiles: [{k: '最も大きいサイドローブ', v: fx(m.psl, 1) + ' <small>dB</small>', s: '振幅でメインローブの 1/' + fx(Math.pow(10, -m.psl / 20), 1)}, {k: '式の値 −20·log N', v: fx(-20 * Math.log10(w.nc), 1) + ' <small>dB</small>', s: 'N = ' + w.nc}]};
  }});

/* 9 */
STEPS.push({short: 'エクリプシング', title: 'エクリプシング — 送信中は受信できない', src: '第5章 p.5.18（Eclipsing loss）、第4章 Losses（p.4.39–4.40）、§8.4（p.8.30–8.31）',
  q: 'パルス幅 40 µs のレーダで、3 km 先の目標を観測します。エコーの先頭は 20 µs 後に戻りますが、その時点ではまだ送信中です。圧縮後のピークはどうなりますか。',
  ch: ['通常どおりに現れる', '下がる（エコーの前半が欠落するため）', 'まったく現れない'], ans: 1,
  why: '送信中は受信機を切り離しているため、エコーのうち送信が終わる前に戻った部分は受信できません。3 km の場合はエコーの半分が欠落し、圧縮後のピークの振幅は半分（−6 dB）になります。まったく検出できなくなるのではありません。',
  read: {
    ana: '自分が大声で話している間は、相手の小さな返事を聞き取れません。話し終わってからようやく聞こえ始めますが、相手の返事の最初の部分は、すでに聞き逃しています。',
    what: '送信パルスを送信している間、受信機は停止しています。近距離の目標のエコーは[[tx|送信が終わる前]]に戻り始めるため、[[lost|先頭の部分が欠落します]]。これが{{g-eclipsing|エクリプシング}}（eclipsing）です。||受信できた部分だけで圧縮するため、ピークが下がります。パルス圧縮のためにパルス幅を長くするほど、この影響を受ける距離の範囲が広くなります。このため、近距離だけを短い無変調パルスで補う実装例もあります。デューティ比（送信時間の割合）が高い波形ではこれが最大の損失になることがよくあります。',
    eq: '欠落なく受信できる最短距離 ≈ <i>c</i>·<i>T</i> / 2',
    sym: '<i>c</i>：光速（3×10⁸ m/s）。<i>T</i>：送信パルス幅 [秒]。T = 40 µs の場合は 6 km です。{H}この式はハンドブックの記述（送信中は受信できない）から導いた関係です。',
    mis: '「最短距離より近い目標はまったく検出できない」という理解は誤りです。受信できた割合に応じてピークが下がるだけであり、強い目標であれば検出できます。'},
  hosoku: ['会話のたとえ', '「欠落なく受信できる最短距離 ≈ cT/2」という関係', '受信できた割合を p とすると、ピークの振幅が約 p 倍になること'],
  memo: 'つまずきやすい点は、「距離」と「時間」の換算です（1 µs = 150 m）。図の横軸は時間であり、目標距離を変えるとエコーが左右に移動することを確認します。||声かけの例：「エコーが半分欠落する場合、ピークは何 dB 下がりますか」「T を 100 µs にすると、cT/2 は何 km ですか」',
  init: {T: 40, B: 2, wave: 'lfm', r1: 8}, ctl: ['r1'], fixed: ['T', 'B'], plots: [{h: 170}, {h: 200}],
  mission: {t: '圧縮後のピークがちょうど半分（−6 dB）になる距離を見つけましょう。', ok: r => Math.abs(r.p - 0.5) < 0.03}, sol: {r1: 3},
  draw(P){
    const w = wav(), td = S.r1 / 0.15, lostT = Math.max(0, Math.min(S.T, S.T - td)), lost = Math.round(lostT * 10), p = 1 - lostT / S.T, full = response(w, 0, 'none'), r = response(w, 0, 'none', lost);
    const xs = q => { const o = new Float64Array(q.n); for (let i = 0; i < q.n; i++) o[i] = (q.x0 + i * q.dx) * 1e6; return o; };
    P[0].set({title: '時間軸：送信パルスと戻ってくるエコー', xr: [0, 120], yr: [0, 1.5], xl: '時刻 [µs]（送信の開始からの時間）', yl: '', yticks: [], series: [{name: '受信できた部分', color: 's1', x: [Math.max(td, S.T), Math.max(td, S.T), td + S.T, td + S.T], y: [0, 0.8, 0.8, 0], w: 2.2, fill: 0.2}].concat(lostT > 0 ? [{name: '欠落した部分', color: 'ref', x: [td, td, S.T, S.T], y: [0, 0.8, 0.8, 0], w: 1.5, dash: [4, 3]}] : []),
      bands: [{x0: 0, x1: S.T, color: 'band2', label: '送信中（受信できない）'}], notes: lostT > 0 ? [{x: (td + S.T) / 2, y: 0.8, t: 'この部分が欠落', dx: 20, dy: -30}] : [{x: td, y: 0.8, t: 'エコーはすべて受信できる', dx: 20, dy: -30}],
      marks: {tx: {x0: 0, x1: S.T, t: '送信中'}, lost: {x0: td, x1: Math.max(td, S.T), t: '欠落した部分'}}, noHover: true});
    P[1].set({title: '圧縮後の出力：すべて受信できた場合（破線）と、現在の場合（実線）', xr: [-3, 3], yr: [0, 1.12], xl: '真の位置からの差 [µs]', yl: '圧縮後の振幅', series: [{name: 'すべて受信できた場合', color: 'ref', x: xs(full), y: full.mag, w: 1.4, dash: [5, 3]}, {name: '現在の出力', color: 's1', x: xs(r), y: r.mag, w: 2.2}],
      notes: p < 0.98 ? [{x: 0, y: p, t: 'ピークは ' + fx(p * 100, 0) + '%', dx: 40, dy: -4}] : [], tipx: v => fx(v, 2) + ' µs', tipy: v => fx(v, 2)});
    return {p, tiles: [{k: '受信できた割合', v: fx(p * 100, 0) + ' <small>%</small>', s: 'エコーの先頭は ' + fx(td, 0) + ' µs 後に戻る'}, {k: 'ピークの低下', v: p > 0.001 ? fx(20 * Math.log10(p), 1) + ' <small>dB</small>' : '受信できない', s: p > 0.001 ? '振幅は ' + fx(p * 100, 0) + '%' : ''}, {k: '欠落なく受信できる最短距離 cT/2', v: fx(S.T * 0.15, 1) + ' <small>km</small>'}]};
  }});

/* 10 */
STEPS.push({short: '実装の方法', title: '実装の方法（概要）— ストレッチ処理は距離を周波数に変換する', src: '§8.4 Digital Pulse Compression（p.8.29–8.30）、Stretch Pulse Compression（p.8.31–8.35、式8.24〜8.37）',
  q: 'ストレッチ処理では、受信した LFM に同じ傾きの参照 LFM を乗算します。乗算の後、目標の「距離の差」は何の差として現れますか。',
  ch: ['信号の強度の差', '一定の周波数の差', '信号の長さの差'], ans: 1,
  why: '傾きが同じ 2 つの LFM を乗算すると、周波数の差が一定になります。その差は参照波形とエコーの時間差に比例します。すなわち、距離の差が周波数の差に変換されます。その後、FFT で周波数を求めれば、距離が分かります。',
  read: {
    ana: '同じ速度で坂を上る 2 台の車を考えます。後から出発した車と前の車の高さの差は、常に一定です。その差は「どれだけ遅れて出発したか」で決まります。高さを周波数に置き換えたものが、ストレッチ処理です。',
    what: 'パルス圧縮の計算方法は 3 つあります。<br>(1) 遅延させながら乗算して加算する（ステップ3）<br>(2) FFT を使って周波数領域で乗算する（結果は (1) と同じであり、高速である）<br>(3) {{g-stretch-processing|ストレッチ処理}}（stretch processing）||(3) は LFM 専用です。参照 LFM を乗算すると、エコーは[[tone|一定の周波数の信号]]になり、その[[spec|周波数]]が参照波形との時間差に比例します。広い帯域幅の LFM を、狭い帯域幅の処理で圧縮できることが利点です。ただし、観測できるのは、設定した距離の付近だけです。',
    eq: 'δ<i>f</i> = −(<i>B</i> / <i>T</i>)·Δτ',
    sym: 'δ<i>f</i>：乗算後の信号の周波数 [Hz]。<i>B</i>/<i>T</i>：LFM の傾き [Hz/秒]。Δτ：参照波形に対するエコーの時間差 [秒]（距離差 × 2/<i>c</i>）。',
    mis: '「ストレッチ処理は分解能が低い」という理解は誤りです。分解能は整合フィルタと同じ（6 dB 幅で 1.21/B）です。異なるのは、一度に観測できる距離の範囲が狭いことです。'},
  hosoku: ['坂を上る車のたとえ', '参照 LFM を基準距離 20 km に合わせ、長さを 2T とした場面の設定'],
  memo: 'つまずきやすい点は、(1)(2) は結果が同じで計算方法が異なるだけであり、(3) は考え方が異なる、という整理です。||声かけの例：「目標を 2 倍の距離だけ離すと、上の図の波形の周波数はどうなりますか」「−100 kHz に現れるようにするには、何 m 離しますか。式で先に計算してみましょう」',
  init: {T: 40, B: 2, wave: 'lfm', r1: 20, dr: 60}, ctl: [{k: 'dr', l: '基準距離（20 km）からの目標の距離差', min: 0, max: 1500, step: 30}], fixed: ['T', 'B'], plots: [{h: 170}, {h: 200}],
  mission: {t: '下の図のピークが −100 kHz（±5 kHz）に現れるように、目標の位置を合わせましょう。', ok: r => Math.abs(r.fk + 100) <= 5}, sol: {dr: 300},
  draw(P){
    const w = wav(), R0 = 20000, tauR = 2 * R0 / C, st = stretch(makeScene(w, {fd: 0, targets: [{R: R0 + S.dr, A: 1, ph: 0}]}), w, tauR), m = metrics({x0: st.f0, dx: st.df, mag: st.mag, n: st.n}), fk = m.tpk / 1e3, th = -(S.B * 1e6 / (S.T * 1e-6)) * (2 * S.dr / C) / 1e3;
    const i0 = Math.round((-650e3 - st.f0) / st.df), i1 = Math.round((150e3 - st.f0) / st.df);
    P[0].set({title: '参照 LFM を乗算した後の信号（I 成分）', xr: [st.t0 * 1e6, st.t0 * 1e6 + st.len / 10], yr: [-1.4, 1.4], xl: '時刻 [µs]', yl: '振幅', series: [{name: '乗算後の信号', color: 's1', x0: st.t0 * 1e6, dx: 0.1, y: st.dechirpRe, w: 1.5}], marks: {tone: {t: '一定の周波数の信号'}}, tipx: v => fx(v, 1) + ' µs', tipy: v => fx(v, 2)});
    P[1].set({title: 'その信号を周波数成分に分解した結果（FFT）', xr: [-650, 150], yr: [0, 1.12], xl: '周波数 [kHz]（0 が基準距離。左ほど遠距離）', yl: '成分の強度', series: [{name: 'スペクトル', color: 's2', x0: (st.f0 + i0 * st.df) / 1e3, dx: st.df / 1e3, y: st.mag.subarray(i0, i1 + 1), w: 2}],
      vl: [{x: -100, label: '目標値の −100 kHz'}], notes: [{x: fk, y: m.pk, t: fx(fk, 0) + ' kHz', dx: 30, dy: 34}], marks: {spec: {x0: fk - 25, x1: fk + 25, t: '周波数が距離を表す'}}, tipx: v => fx(v, 0) + ' kHz', tipy: v => fx(v, 2)});
    return {fk, tiles: [{k: 'ピークの周波数（FFT の結果）', v: fx(fk, 1) + ' <small>kHz</small>'}, {k: '式の値 −(B/T)·Δτ', v: fx(th, 1) + ' <small>kHz</small>', s: 'Δτ = ' + fx(2 * S.dr / C * 1e6, 2) + ' µs'}, {k: '周波数から求めた距離差', v: fx(-fk * 1e3 / (S.B * 1e6 / (S.T * 1e-6)) * C / 2, 0) + ' <small>m</small>', s: '設定は ' + S.dr + ' m'}]};
  }});

/* 11 */
function checkTable1(){
  const R = runChecks(); let h = '<h3>ハンドブックの値との照合</h3><div class="tw"><table class="t"><tr><th>項目</th><th>条件</th><th>計算値</th><th>ハンドブック</th><th>判定</th><th>出典</th></tr>';
  for (const r of R) h += '<tr><td>' + r.item + '</td><td>' + r.cond + '</td><td>' + fx(r.meas, 2) + ' ' + r.unit + '</td><td>' + fx(r.ref, 2) + ' ' + r.unit + '</td><td>' + (r.ok === null ? '<span class="info">参考</span>' : r.ok ? '<span class="ok">一致</span>' : '<span class="ng">不一致</span>') + '</td><td>' + r.src + (r.note ? '<br><small>' + r.note + '</small>' : '') + '</td></tr>';
  return h + '</table></div>';
}
STEPS.push({short: '自由実験', title: '自由実験とまとめ — すべての設定を自由に変える', src: '第8章 Pulse Compression Radar（p.8.1–8.44）、p.4.39–4.40、p.5.18', free: true,
  q: 'パルス幅 T を 2 倍にして、帯域幅 B は変えません。圧縮後のメインローブの幅（3 dB 幅）はどうなりますか。',
  ch: ['2 倍に広くなる', 'ほとんど変わらない', '半分に狭くなる'], ans: 1,
  why: '圧縮後のメインローブの幅は帯域幅 B で決まり（約 1/B）、パルス幅 T にはよりません（ステップ 4）。T を長くして増えるのは、エネルギー（S/N）と時間帯域幅積 T·B です（ステップ 5）。',
  do: 'ここではすべてのパラメータを自由に変えられます',
  read: {
    ana: 'ここまでは楽器を 1 つずつ鳴らして音を確かめてきました。このステップではすべてを同時に鳴らして合奏にします。1 つの設定を変えると、ほかの量にどのように影響するかを確かめてください。',
    eq: '圧縮比 ≈ <i>T</i>·<i>B</i>',
    sym: '<i>T</i>：送信パルス幅 [秒]。<i>B</i>：帯域幅（周波数を変化させる幅）[Hz]。圧縮比：圧縮前と圧縮後のパルス幅の比。ステップ 1 と同じ式です。',
    what: 'ここまでの内容を 1 つの流れにまとめます。符号化した長いパルスを送信する → エコー（遅延・ドップラ偏移）と雑音を受信する → 整合フィルタで圧縮する → 必要に応じて重み付けを行う → 幅が約 1/B の狭いパルスが得られる、という順です。||重要な関係は次の 4 つです。<br>(1) エネルギーは T、分解能は B で決まる<br>(2) 圧縮比 ≈ T·B<br>(3) サイドローブを下げると、メインローブの幅が広くなり、S/N がわずかに低下する<br>(4) LFM ではドップラ偏移によって位置が変化し、位相符号ではドップラ偏移によってピークが低下する',
    mis: '図の縦軸は dB です。−20 dB は「電力で 1/100」、−40 dB は「電力で 1/10000」です。目盛り 1 つの差が大きいことに注意してください。 さらに深く：PRF・パルス幅・帯域幅を要求から決定する方法は、<a href="m03_waveform_ambiguity.html">中級 第3回 波形とあいまいさ</a>で扱います。'},
  hosoku: ['楽器の合奏のたとえ', 'まとめの 4 つの関係の整理のしかた'],
  memo: '自由実験では「予想 → 操作」の手順を学習者自身に組み立てさせると効果的です。||声かけの例：「T を半分、B を 2 倍にすると、何が変わり、何が変わりませんか。先に予想を紙に書いてから操作しましょう」',
  init: {T: 20, B: 1, wave: 'lfm', wt: 'none', t2: true, dr: 600, a2: -20, snr: 0, fd: 0, noise: false}, ctl: ['wave', 'wt', 'T', 'B', 'dr', 'a2', 'fd', 'noise', 'snr'], fixed: [], plots: [{h: 280}],
  acts: [{t: '別の雑音にする', f: () => { S.seed++; }}],
  mission: {t: 'LFM でメインローブの 3 dB 幅が 100 m 以下、かつサイドローブが −35 dB 以下になる設定を見つけましょう。', ok: r => S.wave === 'lfm' && r.w3m <= 100 && r.psl <= -35}, sol: {T: 60, B: 2.5, wt: 'taylor'},
  extra: checkTable1,
  draw(P){
    const w = wav(), sc = makeScene(w, {targets: tgts(), noise: S.noise}), y = compress(sc, w, S.wave === 'lfm' ? S.wt : 'none', 4), a = rseg(dbA(y.mag, 1), y.dt, 18, 23), r = response(w, 0, S.wave === 'lfm' ? S.wt : 'none'), m = metrics(r);
    P[0].set(Object.assign({title: '圧縮後の出力（目標1 は 20 km、ピークが 0 dB）', xr: [18, 23], yr: [-70, 8], yl: '強度 [dB]（目標1 = 0）', series: [{name: '圧縮後の出力', color: 's1', x0: a.x0, dx: a.dx, y: a.y, w: 1.6}], vl: [{x: 20, label: '目標1'}, {x: 20 + S.dr / 1000, label: '目標2（' + fx(S.a2, 0) + ' dB）'}], tipy: v => fx(v, 1) + ' dB'}, RKM));
    return {w3m: m.w3 * 1.5e8, psl: m.psl, tiles: [{k: '時間帯域幅積 T·B', v: fx(w.TB, 0)}, {k: 'メインローブの 3 dB 幅', v: fx(m.w3 * 1.5e8, 0) + ' <small>m</small>'}, {k: '最も大きいサイドローブ', v: fx(m.psl, 1) + ' <small>dB</small>', s: '電力 ' + ratioTxt(m.psl)}, {k: 'ミスマッチ損失', v: fx(r.lossDb, 2) + ' <small>dB</small>'}]};
  }});
boot();
</script>
</body>
</html>
