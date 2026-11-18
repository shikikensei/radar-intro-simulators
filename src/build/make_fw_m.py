# 中級シリーズ用の共通部品（fw_core_m.js / fw_gloss_m.js）を、入門用の部品から機械的に作る。
# 入門の回（docs/00〜17）は、fw_core.js・fw_core2.js・fw_gloss2.js のまま（このスクリプトは、それらを書きかえない）。
# 中級で差し替える関数（redraw、showAnswer、renderRead、renderSim）は、もとの名前を変えて残し、fw_m_add.js の定義を使う。
# 中級用の用語は gloss_m.js に置き、中級の HTML にだけ入れる（入門の用語集は変わらない）。
import subprocess, sys
from pathlib import Path
from paths import rd, wr, GEN
subprocess.run([sys.executable, str(Path(__file__).with_name('make_fw2.py'))], check=True, stdout=subprocess.DEVNULL)
c = rd('fw_core2.js')
def rep(a, b):
    global c
    assert c.count(a) == 1, (a[:60], c.count(a)); c = c.replace(a, b)
for f in ('redraw', 'showAnswer', 'renderRead', 'renderSim'):
    rep('function %s(' % f, 'function %s_intro(' % f)
rep("""'<h3>この回（第' + SIM_NO + '回 ' + SERIES[SIM_NO].name + '）の用語</h3>'""", """'<h3>この回（' + SERIES[SIM_NO].label + ' ' + SERIES[SIM_NO].name + '）の用語</h3>'""")
rep("""for (let n = 0; n < SERIES.length; n++) if (n !== SIM_NO && GLOSS.some(t => t[0] === n)) h += '<h3>第' + n + '回 '""", """for (let n = 0; n < SERIES.length; n++) if (n !== SIM_NO && SERIES[n] && GLOSS.some(t => t[0] === n)) h += '<h3>' + (SERIES[n].label || '入門 第' + n + '回') + ' '""")
wr(GEN / 'fw_core_m.js', c + '\n' + rd('fw_m_add.js'))
from msims import MSIMS
from paths import SRC
ser = '\n'.join("SERIES[%d] = {no: %d, file: '%s', name: '%s', label: '中級 第%d回', ready: %s};" % (100 + n, 100 + n, v[0], v[1], n, 'true' if (SRC / 'episodes' / v[3]).exists() else 'false') for n, v in sorted(MSIMS.items()))
gm = rd('gloss_m.js'); assert gm.count('/*%%MSERIES%%*/') == 1
wr(GEN / 'fw_gloss_m.js', rd('fw_gloss2.js') + '\n' + gm.replace('/*%%MSERIES%%*/', ser))
print('fw_core_m.js', len(c), 'fw_gloss_m.js')
