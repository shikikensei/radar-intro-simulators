# 目次（全18本）。完成している回だけリンクし、残りは「準備中」と表示する。
import json, html, os
from paths import rd, wr, DOCS, GEN
D={d['file']:d for d in json.load(open(GEN/'dump.json',encoding='utf-8'))}
tpl=rd('tpl_head.html'); css=tpl[:tpl.index('</style>')].replace('%%TITLE%%','レーダ 入門シミュレータ（目次）')
INFO=[
 (0,'00_basics.html','レーダの基礎の基礎','Radar Basics','第1章 An Introduction and Overview of Radar','レーダが距離・方向・速度を測定する原理と、dB・レーダ方程式・雑音という共通の基礎を学びます。','なし（ここから始めます）',10),
 (1,'01_pulse_compression.html','パルス圧縮','Pulse Compression','第8章 Pulse Compression Radar','長いパルスで探知距離を確保しながら、高い距離分解能を得る方法を学びます。','第0回',11),
 (2,'02_mti.html','MTI（移動目標指示）','Moving Target Indication','第2章 MTI Radar','地面や建物などの静止した物体のエコー（クラッタ）を除去して、移動目標だけを残す方法を学びます。','第0回、第1回',11),
 (3,'03_pulse_doppler.html','パルスドップラ','Pulse Doppler','第4章 Pulse Doppler Radar','エコーを速度ごとに分離して、強いクラッタの中から目標を検出する方法を学びます。','第0回、第2回',12),
 (4,'04_detection_cfar.html','自動検出とCFAR','Automatic Detection and CFAR','第7章 7.1・7.2 Automatic Detection','「目標あり／なし」を自動的に判定する処理と、誤警報確率を一定に保つ方法を学びます。','第0回、第3回',12),
 (5,'05_tracking.html','自動追尾','Automatic Tracking','第7章 7.3 Automatic Tracking','個々の検出点を対応付けて航跡にし、目標の位置と速度を推定する方法を学びます。','第0回、第4回',9),
 (6,'06_amti.html','航空機搭載MTI（AMTI）','Airborne MTI','第3章 Airborne MTI','レーダ自身が移動する場合に、地面のクラッタがどのように現れ、どのように補償するかを学びます。','第2回、第3回',8),
 (7,'07_phased_array.html','フェーズドアレイアンテナ','Phased Array Antennas','第13章 Phased Array Radar Antennas','小さなアンテナを配列し、位相を制御してビームを電子的に走査する方法を学びます。','第0回',10),
 (8,'08_monopulse.html','モノパルス測角と追尾レーダ','Monopulse and Tracking Radar','第9章 Tracking Radar','1 回のパルスで角度誤差を測定し、1 つの目標を精密に追尾する方法を学びます。','第5回、第7回',9),
 (9,'09_propagation.html','電波の伝わり方（伝搬）','Propagation','第26章 The Propagation Factor, Fp, in the Radar Equation','大気による屈折や海面での反射によって、探知できる領域とできない領域が生じる理由を学びます。','第0回',7),
 (10,'10_rcs.html','レーダ断面積（RCS）','Radar Cross Section','第14章 Radar Cross Section','目標がレーダからどれだけの大きさに見えるか、形や姿勢によってどのように変わるかを学びます。','第0回、第4回、第8回',7),
 (11,'11_sar.html','合成開口レーダ（SAR）','Synthetic Aperture Radar','第17章 Synthetic Aperture Radar','移動しながら収集した信号を合成して、地表の高分解能の画像を生成する方法を学びます。','第0回、第1回、第7回',8),
 (12,'12_eccm.html','電子防護（ECCM）','Electronic Counter-Countermeasures','第24章 Electronic Counter-Countermeasures','妨害を受けてもレーダが機能を維持するための考え方を、原理の範囲で学びます。','第0回、第4回、第7回',8),
 (13,'13_scheduling.html','ビームのスケジューリング','Beam Scheduling','!もとにした資料：Smouse ほか「Integrated Air and Missile Defense Resource Management」Johns Hopkins APL Technical Digest 35(2), 2020 の前半（p.99–104）／Radar Handbook 3rd ed. §24.11、§7.3','捜索と追尾が 1 本のビームの時間をどのように共有するかを学びます。従来の方式と新しい方式を、同じ条件で動作させて比較します。','第0回、第5回、第7回',9),
 (14,'14_clutter_map.html','クラッタマップ','Clutter Map','第2章 MTI Radar（§2.2、§2.15）、第7章（§7.2 Clutter Mapping）','場所ごとのクラッタの強度を記憶し、しきい値を場所ごとに決める方法を学びます。','第0回、第2回、第4回',8),
 (15,'15_radar_equation.html','レーダ方程式','The Radar Equation','第1章 §1.4 The Radar Equation','受信機の雑音・パルスの積分・平均電力・損失・捜索レーダの形まで、レーダ方程式のすべての変数を変えて、探知距離への影響を確かめます。','第0回、第4回',9),
 (16,'16_signal_chain.html','信号を追う（送信から航跡まで）','Following the Signal','第1章 §1.1 Basic Parts of a Radar（図1.1）と、これまでの各回','1 つの目標のエコーを送信から航跡まで順にたどり、各段階での S/N の利得と損失を「S/N バジェット」で確かめます。シリーズ全体を結び付ける回です。','第0回〜第15回（とくに第1・4・5・15回）',9),
 (17,'17_design_exercise.html','レーダを 1 台設計する','A Design Exercise','第1章 §1.4・§1.6、第26章、第8章 ほか（これまでの各回）','艦艇に搭載し、1 台で捜索と追尾の両方を行うレーダを例にして、要求から順に、アンテナ高・周波数・波形・時間の配分・マージンを決めていきます。値はすべて説明用です。シリーズの最後の回です。','第0回〜第16回（とくに第9・13・15・16回）',7)]
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
  <a class="btn sm" id="glBtn" href="glossary.html" title="入門と中級のすべての用語（五十音順・回ごと）">用語集</a>
  <button class="btn sm" id="themeBtn" type="button" title="ライト／ダーク表示を切り替える">表示: ライト</button>
</header>
<main class="wrap">
<p class="lead">レーダの原理を、<b>読み物を読みながら、シミュレータを操作して確かめる</b>形で学ぶ、新人向けの教材です。レーダの知識がほとんどなくても、第0回から順に進めれば理解できるように構成しています。</p>
<p>内容は Merrill I. Skolnik 編 <i>Radar Handbook</i> 第3版（McGraw-Hill, 2008）に基づく、一般的な原理の解説です。各ステップに、もとにした章・節とページを示しています。たとえ話など、ハンドブックにない説明には <span class="hosoku">補足</span> の印を付けています。特定の装置や社内の仕様は扱っていません。第13回だけは、ハンドブックに詳しい記述がない主題であるため、公開されている技術誌の記事（<i>Johns Hopkins APL Technical Digest</i>, 2020）を主な資料にしています。</p>

<h2 class="sec">シリーズの地図（各回がレーダのどの部分を扱うか）　<span class="hosoku">補足</span></h2>
<div class="map">
 <p class="cap">電波の経路：送信 → 伝搬 → 反射</p>
 <div class="row">'''+box('送信する波形','長いパルスで探知距離を確保しながら、高い距離分解能を得る',[1])+'<i>→</i>'+box('アンテナ','小さなアンテナを配列し、電子的にビームを走査する',[7])+'<i>→</i>'+box('電波が伝搬する空間','大気による屈折、海面での反射、見通し距離',[9])+'<i>→</i>'+box('目標','目標がレーダからどれだけの大きさに見えるか（レーダ断面積）',[10])+'''</div>
 <p class="cap">受信信号の処理：抑圧 → 判定 → 追尾</p>
 <div class="row">'''+box('クラッタを抑圧する','地面や海面のエコーから、運動する目標だけを取り出す',[2,3,6])+'<i>→</i>'+box('目標の有無を判定する','しきい値によって検出し、場所ごとの背景を記憶する',[4,14])+'<i>→</i>'+box('目標を追尾する','検出点をつないで航跡にし、角度を精密に測定する',[5,8])+'''</div>
 <p class="cap">全体に関わる内容・応用</p>
 <div class="row">'''+box('基礎','距離・dB・レーダ方程式・ドップラ・雑音',[0])+box('画像を生成する','移動しながら収集した信号から、地表の高分解能の画像を生成する',[11])+box('妨害から防護する','妨害を受けても動作を続けるための対策',[12])+box('時間を配分する','捜索と追尾にビームの時間を割り当てる',[13])+box('探知距離を見積もる','レーダ方程式のすべての変数',[15])+box('全体を結び付ける','1 つのエコーをたどる回と、レーダを 1 台設計する回',[16,17])+'''</div>
</div>
<p class="sym">受信信号が通る処理の順に並べた、概略の図です。実際のレーダでは、方式によって使用する処理や順序が異なります。</p>

<h2 class="sec">入門：18 回の一覧（上から順に進めることを勧めます）</h2>
<div class="cards">
'''+cards+'''</div>

<h2 class="sec">中級（性能計算を自分で行い始める人へ）</h2>
<p>入門を終えた人のための回です。3 択の予想の代わりに、<b>手計算で求めた数値を入力</b>します。外れた場合は、途中の値のヒントが 1 段ずつ表示されます。画面の「計算書」に、前提・式・値が 1 行ずつ記入されていきます。式が使える条件と、成り立たなくなる条件も示しています。</p>
<div class="cards">
'''+mcards+'''</div>

<h2 class="sec">1 つのステップの進め方</h2>
<div class="how">
 <div><b><span>1</span>問いを読む</b>右側の最上部に、そのステップの「問い」が表示されます。</div>
 <div><b><span>2</span>予想する</b>選択肢から 1 つ選びます。選ぶまで、操作部には「先に予想を選びましょう」と表示され、操作できません。予想の正否は問いません。</div>
 <div><b><span>3</span>操作して確かめる</b>スライダーを動かして、グラフの変化を確かめます。変えられる値は原則として 1 つだけであり、ほかの値は「このステップでは固定」と表示されます。</div>
 <div><b><span>4</span>答えを見る</b>「答えを見る」を押すと、答えと理由が表示されます。</div>
</div>
<ul class="pl">
 <li><b>ミッション</b>：各ステップに 1 つ、小さな課題があります。条件を満たすと「達成！」と表示され、画面上部の丸に印が付きます（ページを読み込み直すと消えます）。</li>
 <li><b>読み物</b>：左側に、① 身近なたとえ ② 何が起きているか ③ 重要な式 ④ よくある誤解 ⑤ 出典 の順で示しています。<span style="color:var(--hl);font-weight:700;text-decoration:underline dotted">色の付いた用語</span>を押すと、右のグラフの対応する部分が強調されます。</li>
 <li><b>用語集</b>：各回の画面の右端のタブ、または右上の「用語集」ボタンで開きます。入門と中級のすべての用語を五十音順と回ごとに並べた<a href="glossary.html">用語集のページ</a>もあります。本文で破線の下線と「?」の付いた用語を押すと、その場に短い説明が表示されます。</li>
 <li><b>自由実験</b>：各回の最後のステップでは、すべての値を自由に変えられます。ハンドブックの値との照合表も、このステップにあります。</li>
 <li>所要時間は、1 ステップを 5〜8 分として見積もった目安です。途中のステップから始めることもできます。</li>
</ul>

<details><summary>指導者の方へ</summary>
<p>各ステップの読み物の最下部に「指導者向けメモ」（折りたたみ）があり、学習者がつまずきやすい点と声かけの例を示しています。</p>
<p>「予想」を選ぶ前に、そのように考える理由を一言で述べてもらうと、答え合わせの効果が高くなります。外れた予想を責めず、「どの段階でそのように考えたか」をともに振り返ることを勧めます。</p>
<p>dB、I/Q、ドップラ効果、確率などの前提知識は、第0回で扱います。各回の最初のステップにも、30 秒ほどで読める補足と、第0回の該当するステップへのリンクがあります。</p>
</details>
<p class="sym" style="margin-top:14px">動作環境：Microsoft Edge または Google Chrome。インターネット接続は不要です（HTML ファイルをすべて同じフォルダに置いて使います）。乱数は種を固定しているため、同じ操作であれば同じ結果になります。</p>
</main>
<script>
'use strict';
(function(){
  const $ = s => document.querySelector(s);
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
