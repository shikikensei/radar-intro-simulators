"""第0回、第5回以降を組み立てる。使い方：python src/build/build2.py 0 5 6 7 8 9 10 11 12 13 14 15 16 17
用語集と「次の回へ」のリンクは全回で共通なので、1 つ足したら、全部を組み立て直す。"""
import sys, subprocess
from pathlib import Path
from paths import rd, wr, DOCS
subprocess.run([sys.executable,str(Path(__file__).with_name('make_fw2.py'))],check=True)
from sims import SIMS
from gterm import expand, GT_CSS
for n in [int(a) for a in sys.argv[1:]]:
    f,title,cores,steps=SIMS[n]
    out=rd('tpl_head.html').replace('%%TITLE%%',title).replace('%%NO%%',str(n))
    out=out.replace('</style>','.nextsim{margin:14px 0 4px;font-size:14px}\n'+GT_CSS+'</style>',1)
    out+=rd('c_util.js')+'\n'
    for c in cores: out+=rd(c)+'\n'
    out+=rd('fw_plot.js')+'\n'+rd('fw_gloss2.js')+'\n'+rd('fw_core2.js')+'\n'+expand(rd(steps),steps)
    wr(DOCS/f,out); print(f,len(out.encode('utf-8')))
