"""第1〜4回を組み立てる。使い方：python src/build/build.py 1 2 3 4
第1〜4回は、古い共通部品（fw_core.js、fw_gloss.js）で組み立てる。数値・式・計算・動作は変えない。
文章の書き直しと用語のリンク（{{g-ID|文字}}。fw_gloss.js の用語だけ）のために、組み立て直すことがある。"""
import sys
from paths import rd, wr, DOCS
from sims import LEGACY as SIMS
from gterm import expand, GT_CSS
for n in [int(a) for a in sys.argv[1:]]:
    f,title,cores,steps=SIMS[n]
    out=rd('tpl_head.html').replace('%%TITLE%%',title).replace('%%NO%%',str(n))
    out=out.replace('</style>',GT_CSS+'</style>',1)
    for c in cores: out+=rd(c)+'\n'
    out+=rd('fw_plot.js')+'\n'+rd('fw_gloss.js')+'\n'+rd('fw_core.js')+'\n'+rd('fw_gterm.js')+'\n'+expand(rd(steps),steps,legacy=True)
    wr(DOCS/f,out); print(f,len(out.encode('utf-8')))
