# 第0回・第5回以降用の共通部品（fw_core2.js / fw_gloss2.js）を、第1〜4回用の部品から機械的に作る。
# 第1〜4回の HTML は fw_core.js / fw_gloss.js のまま（変更しない）。
import re
from paths import rd, wr, GEN, SRC
c=rd('fw_core.js')
def rep(a,b):
    global c
    assert c.count(a)==1,(a[:60],c.count(a)); c=c.replace(a,b)
rep("""for (const p of PRE){ if (typeof p === 'string') h += '<details><summary>' + PREQ[p][0] + '</summary><p>' + PREQ[p][1] + '</p></details>'; else""",
    """for (const p of PRE){ if (typeof p === 'string'){ const L = PREQLINK[p], ok = L && L[0] !== SIM_NO && SERIES[L[0]].ready; h += '<details><summary>' + PREQ[p][0] + '</summary><p>' + PREQ[p][1] + (ok ? '　<a href="' + SERIES[L[0]].file + '#s' + L[1] + '">くわしくは第' + L[0] + '回のステップ' + L[1] + '</a>' : '') + '</p></details>'; } else""")
rep("""  if (st.extra) h += '<div id="extra"></div>';""",
    """  if (st.extra) h += '<div id="extra"></div>';
  if (i === STEPS.length - 1){ const nx = SERIES[SIM_NO + 1]; if (nx && nx.ready) h += '<p class="nextsim">この回はここまでです。次は　<a class="btn primary" href="' + nx.file + '">第' + nx.no + '回 ' + nx.name + ' →</a></p>'; else h += '<p class="nextsim">この回はここまでです。<a href="00_index.html">目次へ戻る</a></p>'; }""")
rep("""h += '<div class="src"><b>出典</b>　Radar Handbook 3rd ed.　' + st.src + '</div>';""",
    """h += '<div class="src"><b>出典</b>　' + (st.srcRaw ? '' : 'Radar Handbook 3rd ed.　') + st.src + '</div>';""")
rep("""let h = '<h2>用語集（4 回共通）<button""","""let h = '<h2>用語集（全回共通）<button""")
rep("""grp(SIM_NO) + '<h3>基礎の用語　' + H + '</h3>' + grp(0);
  for (let n = 1; n <= 4; n++) if (n !== SIM_NO) h +=""","""grp(SIM_NO) + '<h3>基礎の用語　' + H + '</h3>' + grp(-1);
  for (let n = 0; n < SERIES.length; n++) if (n !== SIM_NO && GLOSS.some(t => t[0] === n)) h +=""")
# 入門の画面の文言（STYLE.md の決まりに合わせる。第1〜4回の fw_core.js は、まだ変えない）
for a_, b_ in [
    ("""'予想とは違いましたね。外れても大丈夫、ここで「なぜ」を確かめれば身につきます。'""", """'予想とは異なりました。ここで理由を確かめることが、理解につながります。'"""),
    ("""（開くと 30 秒で読める説明が出ます）""", """（開くと、30 秒ほどで読める説明が表示されます）"""),
    ("""'">第' + p.no + '回のステップ' + p.step + 'を先に見てね</a></p>'""", """'">第' + p.no + '回 ステップ ' + p.step + ' を先に確認してください</a></p>'"""),
    ("""<div class="hint">まず予想を 1 つ選ぼう（当たり外れは気にしなくて大丈夫）。選ぶと下の操作部が使えるようになります。</div>""", """<div class="hint">まず予想を 1 つ選びましょう（正否は問いません）。選ぶと、下の操作部が使えるようになります。</div>"""),
    ("""<div class="lockmsg">予想してから触ろう</div>""", """<div class="lockmsg">先に予想を選びましょう</div>"""),
    ("""(st.do || 'スライダーを動かして確かめよう')""", """(st.do || 'スライダーを動かして確かめましょう')"""),
    ("""<span class="hint">操作して確かめてから押そう</span>""", """<span class="hint">操作して確かめてから押しましょう</span>"""),
    ("""用語の訳と説明は、Radar Handbook 3rd ed. の用語を新人向けに言い換えたものです。""", """用語の訳と説明は Radar Handbook 3rd ed. の用語を言い換えたものです。""")]:
    rep(a_, b_)
# 用語集のパネル：用語に ID を付ける（本文のリンクから同じ用語を開けるように）。用語集のページへのリンクを置く
rep("""GLOSS.filter(t => t[0] === n).map(t => '<dt>' + t[1] + '</dt><dd>' + t[2] + '</dd>').join('');""",
    """GLOSS.filter(t => t[0] === n).map(t => '<dt' + (t[3] ? ' id="' + t[3] + '"' : '') + '>' + t[1] + '</dt><dd>' + t[2] + '</dd>').join('');""")
rep("""<input type="search" id="glFind" placeholder="用語をさがす" aria-label="用語をさがす"><dl id="glList">';""",
    """<p class="glpage"><a href="glossary.html" target="_blank" rel="noopener">用語集のページを開く</a>（五十音順と回ごとの一覧。入門と中級のすべての用語）</p><input type="search" id="glFind" placeholder="用語をさがす" aria-label="用語をさがす"><dl id="glList">';""")
wr(GEN/'fw_core2.js',c+'\n'+rd('fw_gterm.js'))
g=rd('fw_gloss.js')
i0=g.index('const SERIES'); i1=g.index('/* [グループ')
ser='''const SERIES = [
  {no: 0, file: '00_basics.html', name: 'レーダの基礎の基礎', ready: %(r0)s},
  {no: 1, file: '01_pulse_compression.html', name: 'パルス圧縮', ready: true},
  {no: 2, file: '02_mti.html', name: 'MTI（移動目標指示）', ready: true},
  {no: 3, file: '03_pulse_doppler.html', name: 'パルスドップラ', ready: true},
  {no: 4, file: '04_detection_cfar.html', name: '自動検出とCFAR', ready: true},
  {no: 5, file: '05_tracking.html', name: '自動追尾', ready: %(r5)s},
  {no: 6, file: '06_amti.html', name: '航空機搭載MTI（AMTI）', ready: %(r6)s},
  {no: 7, file: '07_phased_array.html', name: 'フェーズドアレイアンテナ', ready: %(r7)s},
  {no: 8, file: '08_monopulse.html', name: 'モノパルス測角と追尾レーダ', ready: %(r8)s},
  {no: 9, file: '09_propagation.html', name: '電波の伝わり方（伝搬）', ready: %(r9)s},
  {no: 10, file: '10_rcs.html', name: 'レーダ断面積（RCS）', ready: %(r10)s},
  {no: 11, file: '11_sar.html', name: '合成開口レーダ（SAR）', ready: %(r11)s},
  {no: 12, file: '12_eccm.html', name: '電子防護（ECCM）', ready: %(r12)s},
  {no: 13, file: '13_scheduling.html', name: 'ビームのスケジューリング', ready: %(r13)s},
  {no: 14, file: '14_clutter_map.html', name: 'クラッタマップ', ready: %(r14)s},
  {no: 15, file: '15_radar_equation.html', name: 'レーダ方程式', ready: %(r15)s},
  {no: 16, file: '16_signal_chain.html', name: '信号を追う（送信から航跡まで）', ready: %(r16)s},
  {no: 17, file: '17_design_exercise.html', name: 'レーダを 1 台設計する', ready: %(r17)s}];
'''
import os
READY={n: (SRC/'episodes'/('s%d_steps.js'%n)).exists() for n in (0,5,6,7,8,9,10,11,12,13,14,15,16,17)}
ser=ser%{('r%d'%n):('true' if READY[n] else 'false') for n in READY}
g=g[:i0]+ser+g[i1:]
g=g.replace('グループ 0＝基礎（補足）、1〜4＝各回','グループ −1＝基礎（補足）、0〜17＝各回')
n0=len(re.findall(r'^  \[0, ',g,flags=re.M)); g=re.sub(r'^  \[0, ','  [-1, ',g,flags=re.M)
g+='\n'+rd('gloss_add.js')
wr(GEN/'fw_gloss2.js',g)
print('fw_core2.js',len(c),'fw_gloss2.js',len(g),'base terms',n0,'ready',[n for n in READY if READY[n]])
