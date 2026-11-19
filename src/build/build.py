"""第1〜4回を組み立てる。使い方：python src/build/build.py 1 2 3 4
注意：第1〜4回は、古い共通部品（fw_core.js、fw_gloss.js）で組み立てる。中身を変えない方針なので、ふだんは組み立て直さない。"""
import sys
from paths import rd, wr, DOCS
from sims import LEGACY as SIMS
for n in [int(a) for a in sys.argv[1:]]:
    f,title,cores,steps=SIMS[n]
    out=rd('tpl_head.html').replace('%%TITLE%%',title).replace('%%NO%%',str(n))
    for c in cores: out+=rd(c)+'\n'
    out+=rd('fw_plot.js')+'\n'+rd('fw_gloss.js')+'\n'+rd('fw_core.js')+'\n'+rd(steps)
    wr(DOCS/f,out); print(f,len(out.encode('utf-8')))
