# 目次（全18本）。完成している回だけリンクし、残りは「準備中」と表示する。
import json, html, os
from paths import rd, wr, DOCS, GEN
D={d['file']:d for d in json.load(open(GEN/'dump.json',encoding='utf-8'))}
tpl=rd('tpl_head.html'); css=tpl[:tpl.index('</style>')].replace('%%TITLE%%','レーダ 入門シミュレータ（目次）')
INFO=[
 (0,'00_basics.html','レーダの基礎の基礎','Radar Basics','第1章 An Introduction and Overview of Radar','レーダが距離・方向・速度を知るしくみと、dB・レーダ方程式・雑音という共通の道具を学びます。','なし（ここから始めます）',10),
 (1,'01_pulse_compression.html','パルス圧縮','Pulse Compression','第8章 Pulse Compression Radar','長いパルスで遠くまで届かせながら、細かい距離の違いも見分ける工夫を学びます。','第0回',11),
 (2,'02_mti.html','MTI（移動目標指示）','Moving Target Indication','第2章 MTI Radar','地面や建物などの動かないエコー（クラッタ）を消して、動く目標だけを残す工夫を学びます。','第0回、第1回',11),
 (3,'03_pulse_doppler.html','パルスドップラ','Pulse Doppler','第4章 Pulse Doppler Radar','エコーを速度ごとにふるい分けて、強いクラッタの中から目標を見つける工夫を学びます。','第0回、第2回',12),
 (4,'04_detection_cfar.html','自動検出とCFAR','Automatic Detection and CFAR','第7章 7.1・7.2 Automatic Detection','「目標あり／なし」を機械が決める仕組みと、誤警報を一定に保つ工夫を学びます。','第0回、第3回',12),
 (5,'05_tracking.html','自動追尾','Automatic Tracking','第7章 7.3 Automatic Tracking','ばらばらの検出点をつないで航跡にし、目標の位置と速度を推定する方法を学びます。','第0回、第4回',9),
 (6,'06_amti.html','航空機搭載MTI（AMTI）','Airborne MTI','第3章 Airborne MTI','レーダ自身が動くときに、地面のクラッタがどう見え、どう打ち消すかを学びます。','第2回、第3回',8),
 (7,'07_phased_array.html','フェーズドアレイアンテナ','Phased Array Antennas','第13章 Phased Array Radar Antennas','小さなアンテナを並べ、位相をずらしてビームを電子的に振る方法を学びます。','第0回',10),
 (8,'08_monopulse.html','モノパルス測角と追尾レーダ','Monopulse and Tracking Radar','第9章 Tracking Radar','1 回のパルスで角度のずれを測り、1 つの目標を精密に追い続ける方法を学びます。','第5回、第7回',9),
 (9,'09_propagation.html','電波の伝わり方（伝搬）','Propagation','第26章 The Propagation Factor, Fp, in the Radar Equation','大気での曲がり方や海面での反射で、見える場所と見えない場所ができる理由を学びます。','第0回',7),
 (10,'10_rcs.html','レーダ断面積（RCS）','Radar Cross Section','第14章 Radar Cross Section','目標がレーダからどれくらい大きく見えるか、形や向きでどう変わるかを学びます。','第0回、第4回、第8回',7),
 (11,'11_sar.html','合成開口レーダ（SAR）','Synthetic Aperture Radar','第17章 Synthetic Aperture Radar','動きながら集めた信号を合成して、地面の細かい画像を作る方法を学びます。','第0回、第1回、第7回',8),
 (12,'12_eccm.html','電子防護（ECCM）','Electronic Counter-Countermeasures','第24章 Electronic Counter-Countermeasures','妨害を受けてもレーダが働き続けるための考え方を、原理のレベルで学びます。','第0回、第4回、第7回',8),
 (13,'13_scheduling.html','ビームのスケジューリング','Beam Scheduling','!もとにした資料：Smouse ほか「Integrated Air and Missile Defense Resource Management」Johns Hopkins APL Technical Digest 35(2), 2020 の前半（p.99–104）／Radar Handbook 3rd ed. §24.11、§7.3','捜索と追尾が、1 本のビームの時間をどう分け合うか。従来の方式と新しい方式を、同じ条件で動かして比べます。','第0回、第5回、第7回',9),
 (14,'14_clutter_map.html','クラッタマップ','Clutter Map','第2章 MTI Radar（§2.2、§2.15）、第7章（§7.2 Clutter Mapping）','場所ごとのクラッタの強さを覚えておき、しきい値を場所ごとに決める方法を学びます。','第0回、第2回、第4回',8),
 (15,'15_radar_equation.html','レーダ方程式','The Radar Equation','第1章 §1.4 The Radar Equation','受信機の雑音、パルスの積分、平均電力、損失、捜索レーダの形まで、レーダ方程式のすべての変数を動かして、探知距離への効き方を確かめます。','第0回、第4回',9),
 (16,'16_signal_chain.html','信号を追う（送信から航跡まで）','Following the Signal','第1章 §1.1 Basic Parts of a Radar（図1.1）と、これまでの各回','1 つの目標のエコーを、送信から航跡まで順に追い、各段階で S/N を何 dB 稼ぐか（失うか）を「家計簿」で確かめます。シリーズ全体をつなぐ回です。','第0回〜第15回（とくに第1・4・5・15回）',9),
 (17,'17_design_exercise.html','レーダを 1 台設計する','A Design Exercise','第1章 §1.4・§1.6、第26章、第8章 ほか（これまでの各回）','船に載せて 1 台で捜索も追尾もするレーダを例に、要求から順に、高さ・周波数・波形・時間の配分・余裕を決めていきます。値はすべて説明用です。シリーズの最後の回です。','第0回〜第16回（とくに第9・13・15・16回）',7)]
def ttl(x):
    h,_,r=x.partition(' — ')
    return ('発展：'+r) if h=='発展' else h
ready={i[0]: (i[1] in D and (DOCS/i[1]).exists()) for i in INFO}
def lk(n,label=None):
    i=INFO[n]; t=label or ('第%d回 %s'%(n,i[2]))
    return '<a href="%s">%s</a>'%(i[1],t) if ready[n] else '<span class="soon">%s</span>'%t
cards=''
for no,f,name,en,ch,desc,pre,nst in INFO:
    if ready[no]:
        st=D[f]['steps']; n=len(st)
        li=''.join('<li><a href="%s#s%d">%s</a></li>'%(f,k+1,html.escape(ttl(t['title']))) for k,t in enumerate(st))
        act='<p><a class="btn primary" href="%s">第%d回をはじめる →</a>　<span class="sym">全 %d ステップ</span></p><details><summary>ステップの一覧（押すとそのステップへ）</summary><ol>%s</ol></details>'%(f,no,n,li)
    else:
        n=nst; act='<p><span class="soon">準備中</span>　<span class="sym">%d ステップの予定</span></p>'%n
    cards+='''<section class="card sim%s"><div class="sim-h"><span class="no">第%d回</span><h2>%s <small>%s</small></h2></div>
<p>%s</p>
<p class="sym">所要時間の目安：約 %d〜%d 分　／　前提となる回：%s<br>%s</p>
%s</section>
'''%('' if ready[no] else ' off',no,name,en,desc,n*5,n*8,pre,(ch[1:] if ch.startswith('!') else 'もとにした章：Radar Handbook 3rd ed. '+ch),act)
from msims import MSIMS
MINFO=[(v[0],'中級 第%d回'%n,v[1],v[4],v[5],v[6],v[7]) for n,v in sorted(MSIMS.items())]
mcards=''
for f,no,name,en,ch,desc,pre in MINFO:
    if not (f in D and (DOCS/f).exists()): continue
    st=D[f]['steps']; n=len(st)
    li=''.join('<li><a href="%s#s%d">%s</a></li>'%(f,k+1,html.escape(ttl(t['title']))) for k,t in enumerate(st))
    mcards+='''<section class="card sim"><div class="sim-h"><span class="no">%s</span><h2>%s <small>%s</small></h2></div>
<p>%s</p>
<p class="sym">所要時間の目安：約 %d〜%d 分（手計算を含む）　／　前提となる回：%s<br>もとにした章：Radar Handbook 3rd ed. %s</p>
<p><a class="btn primary" href="%s">%sをはじめる →</a>　<span class="sym">全 %d ステップ</span></p><details><summary>ステップの一覧（押すとそのステップへ）</summary><ol>%s</ol></details></section>
'''%(no,name,en,desc,n*10,n*15,pre,ch,f,no,n,li)
def box(title,body,nums): return '<div><b>%s</b>%s<span class="mapl">%s</span></div>'%(title,body,'　'.join(lk(n,'第%d回'%n) for n in nums))
body='''
.wrap{max-width:1180px;margin:0 auto;padding:14px 44px 40px 14px}
.lead{font-size:15px}
.wrap h2.sec{font-size:15px;margin:18px 0 6px;color:var(--accent)}
.wrap p{margin:4px 0 8px}
.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media (max-width:1000px){.cards{grid-template-columns:minmax(0,1fr)}}
.sim-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.sim-h h2{font-size:18px;margin:0}
.sim-h h2 small{font-size:12px;color:var(--text2);font-weight:600}
.no{font-size:12px;font-weight:700;color:var(--surface);background:var(--accent);border-radius:4px;padding:1px 9px}
.card.sim.off{opacity:.72}.card.sim.off .no{background:var(--muted)}
.soon{color:var(--muted);font-weight:700}
.card.sim ol{margin:6px 0 4px;padding-left:26px;columns:2;column-gap:24px;font-size:13px}
@media (max-width:560px){.card.sim ol{columns:1}}
.card.sim li{break-inside:avoid}
.map{border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:10px 12px;margin:6px 0}
.map .row{display:flex;flex-wrap:wrap;align-items:stretch;gap:6px;margin:6px 0}
.map .row>div{flex:1 1 130px;border:1px solid var(--border);border-radius:8px;background:var(--bg);padding:6px 10px;font-size:12.5px;line-height:1.5}
.map .row>div b{display:block;color:var(--accent);font-size:13px}
.map .row>i{align-self:center;font-style:normal;color:var(--muted);font-size:18px}
.map .mapl{display:block;margin-top:3px;font-weight:700}
.map .cap{font-size:12px;color:var(--text2);font-weight:700;margin:8px 0 0}
.how{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
@media (max-width:1000px){.how{grid-template-columns:repeat(2,minmax(0,1fr))}}
.how div{border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:6px 12px}
.how b{display:block}.how b span{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--accent);color:var(--surface);font-size:12.5px;margin-right:6px}
ul.pl{margin:4px 0 8px;padding-left:22px}
@media (max-width:560px){header.top{flex-wrap:wrap}header.top h1{white-space:normal;flex:1 1 100%}.wrap{padding-right:34px}.map .row>i{display:none}}
</style>
</head>
<body>
<header class="top">
  <h1>レーダ 入門シミュレータ</h1>
  <div id="msbar">入門 18 回・中級 '''+str(len([m for m in MINFO if m[0] in D]))+''' 回</div>
  <a class="btn sm" href="glossary.html" title="入門と中級のすべての用語（五十音順・回ごと）">用語集のページ</a>
  <button class="btn sm" id="glBtn" type="button">用語集</button>
  <button class="btn sm" id="themeBtn" type="button" title="ライト／ダーク表示を切り替える">表示: ライト</button>
</header>
<main class="wrap">
<p class="lead">レーダのしくみを、<b>読み物を読みながら、シミュレータを触って確かめる</b>形で学ぶ、新人向けの教材です。レーダの知識がほとんどなくても、第0回から順に進めれば読めるように作っています。</p>
<p>内容は Merrill I. Skolnik 編 <i>Radar Handbook</i> 第3版（McGraw-Hill, 2008）にもとづく、一般的な原理の解説です。各ステップに、もとにした章・節と本のページを書いています。たとえ話など、ハンドブックにない説明には <span class="hosoku">補足</span> の印を付けています。特定の装置や社内の仕様には触れていません。第13回だけは、ハンドブックに詳しい記述がない話題なので、公開されている技術誌の記事（<i>Johns Hopkins APL Technical Digest</i>, 2020）をおもな資料にしています。</p>

<h2 class="sec">シリーズの地図（どの回が、レーダのどの部分を扱うか）　<span class="hosoku">補足</span></h2>
<div class="map">
 <p class="cap">電波の通り道：送る → 飛ぶ → はね返る</p>
 <div class="row">'''+box('送信する波形','長いパルスに「目印」を付けて送る',[1])+'<i>→</i>'+box('アンテナ','電波を細いビームにして向ける',[7])+'<i>→</i>'+box('空間','大気や海面で、届き方が変わる',[9])+'<i>→</i>'+box('目標','形や向きで、はね返り方が変わる',[10])+'''</div>
 <p class="cap">受信した信号の処理：消す → 決める → 追う</p>
 <div class="row">'''+box('クラッタを消す','動かない物のエコーを取り除く',[2,3,6])+'<i>→</i>'+box('「ある／ない」を決める','しきい値で検出する。場所ごとの背景を覚える',[4,14])+'<i>→</i>'+box('目標を追う','検出点をつないで航跡にする。角度を精密に測る',[5,8])+'''</div>
 <p class="cap">全体にかかわること・応用</p>
 <div class="row">'''+box('基礎','距離・dB・レーダ方程式・ドップラ・雑音',[0])+box('画像にする','動きながら集めた信号で画像を作る',[11])+box('妨害から守る','妨害の中でも働き続ける工夫',[12])+box('時間を配る','捜索と追尾に、ビームの時間を割り当てる',[13])+box('探知距離を見積もる','レーダ方程式の全部の変数',[15])+box('全体をつなぐ','1 つのエコーを追う。レーダを 1 台設計する',[16,17])+'''</div>
</div>
<p class="sym">受信した信号がたどる処理の順に並べた、おおまかな見取り図です。実際のレーダでは、方式によって使う処理や順番が変わります。</p>

<h2 class="sec">入門：18 回の一覧（上から順に進めるのがおすすめ）</h2>
<div class="cards">
'''+cards+'''</div>

<h2 class="sec">中級（性能の計算を、自分でやり始める人へ）</h2>
<p>入門を終えた人のための回です。3 択の予想のかわりに、<b>手で計算した数値を入力</b>します。外れたときは、途中の値のヒントが 1 段ずつ出ます。画面の「計算書」に、前提・式・値が 1 行ずつ埋まっていきます。式が使える条件と、崩れる条件も書いています。</p>
<div class="cards">
'''+mcards+'''</div>

<h2 class="sec">1 つのステップの進め方</h2>
<div class="how">
 <div><b><span>1</span>問いを読む</b>右側の一番上に、そのステップの「問い」が出ます。</div>
 <div><b><span>2</span>予想する</b>選択肢から 1 つ選びます。選ぶまで、操作部は「予想してから触ろう」と薄く表示されます。当たり外れは気にしなくて大丈夫です。</div>
 <div><b><span>3</span>動かして確かめる</b>スライダーを動かして、グラフの変化を見ます。動かせるのは原則 1 つだけで、ほかの値は「このステップでは固定」と表示されます。</div>
 <div><b><span>4</span>答えを見る</b>「答えを見る」を押すと、答えと理由が出ます。</div>
</div>
<ul class="pl">
 <li><b>ミッション</b>：各ステップに 1 つ、小さな課題があります。条件を満たすと「達成！」と表示され、画面上部の丸にチェックが付きます（ページを読み込み直すと消えます）。</li>
 <li><b>読み物</b>：左側に、①身近なたとえ ②何が起きているか ③大事な式 ④よくある誤解 ⑤出典 の順で書いています。<span style="color:var(--hl);font-weight:700;text-decoration:underline dotted">色の付いた用語</span>を押すと、右のグラフの対応する場所が光ります。</li>
 <li><b>用語集</b>：画面の右端のタブ、または右上の「用語集」ボタンで開きます。入門と中級のすべての用語を、五十音順と回ごとに並べた<a href="glossary.html">用語集のページ</a>もあります。本文で破線の下線と「?」の付いた用語を押すと、その場に短い説明が出ます（書き直しの済んだ回から順に対応）。</li>
 <li><b>自由実験</b>：各回の最後のステップでは、全部の値を自由に動かせます。ハンドブックの値との照合表もここにあります。</li>
 <li>所要時間は、1 ステップ 5〜8 分として見積もった目安です。途中のステップから始めることもできます。</li>
</ul>

<details><summary>指導者の方へ</summary>
<p>各ステップの読み物の一番下に「指導者向けメモ」（折りたたみ）があり、新人がつまずきやすい点と声かけの例を書いています。</p>
<p>「予想」を選ぶ前に、なぜそう思うかを一言で言ってもらうと、答え合わせの効果が上がります。外れた予想を責めず、「どこでそう考えたか」を一緒にたどるのがおすすめです。</p>
<p>dB、I/Q、ドップラ効果、確率などの前提知識は、第0回で扱います。各回の最初のステップにも、30 秒で読める補足と、第0回の該当ステップへのリンクがあります。</p>
</details>
<p class="sym" style="margin-top:14px">動作環境：Microsoft Edge または Google Chrome。インターネット接続は不要です（HTML ファイルをすべて同じフォルダに置いて使います）。乱数は種を固定しているので、同じ操作なら同じ結果になります。</p>
</main>
<button id="glTab" type="button" aria-label="用語集を開く">用語集</button>
<aside id="gloss" hidden aria-label="用語集"></aside>
<script>
'use strict';
'''+rd('fw_gloss2.js')+'''
(function(){
  const $ = s => document.querySelector(s), g = $('#gloss');
  const HB = '<span class="hosoku">補足</span>';
  const grp = n => GLOSS.filter(t => t[0] === n).map(t => '<dt>' + t[1] + '</dt><dd>' + t[2] + '</dd>').join('');
  let h = '<h2>用語集（全回共通）<button class="btn sm" type="button" id="glClose">閉じる</button></h2><input type="search" id="glFind" placeholder="用語をさがす" aria-label="用語をさがす"><dl id="glList"><h3>基礎の用語　' + HB + '</h3>' + grp(-1);
  for (let n = 0; n < SERIES.length; n++) if (GLOSS.some(t => t[0] === n)) h += '<h3>第' + n + '回 ' + SERIES[n].name + '</h3>' + grp(n);
  g.innerHTML = h + '</dl><p class="sym" style="margin-top:12px">用語の訳と説明は、Radar Handbook 3rd ed. の用語を新人向けに言い換えたものです。「基礎の用語」は一般的な知識による補足です。</p>';
  const toggle = on => { g.hidden = !on; if (on) $('#glFind').focus(); };
  $('#glBtn').addEventListener('click', () => toggle(g.hidden)); $('#glTab').addEventListener('click', () => toggle(g.hidden)); $('#glClose').addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });
  $('#glFind').addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); for (const dt of g.querySelectorAll('dt')){ const hit = !q || (dt.textContent + dt.nextElementSibling.textContent).toLowerCase().indexOf(q) >= 0; dt.hidden = !hit; dt.nextElementSibling.hidden = !hit; } });
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let theme = mq && mq.matches ? 'dark' : 'light';
  const apply = () => { document.documentElement.setAttribute('data-theme', theme); $('#themeBtn').textContent = '表示: ' + (theme === 'dark' ? 'ダーク' : 'ライト'); };
  $('#themeBtn').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; apply(); }); apply();
})();
</script>
</body>
</html>
'''
wr(DOCS/'00_index.html',css+body); print('00_index.html',len((css+body).encode('utf-8')),'ready',[n for n in ready if ready[n]])
