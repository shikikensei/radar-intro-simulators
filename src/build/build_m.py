"""中級シリーズを組み立てる。使い方：python src/build/build_m.py 1
入門の回とは別の共通部品（fw_core_m.js・fw_gloss_m.js。make_fw_m.py が作る）を使う。入門の HTML は変わらない。"""
import sys, subprocess
from pathlib import Path
from paths import rd, wr, DOCS
subprocess.run([sys.executable, str(Path(__file__).with_name('make_fw_m.py'))], check=True)
SIMS = {1: ('m01_detection.html', '中級 第1回 検出の計算', ['cm01_core.js'], 'sm01_steps.js')}
CSS = """.nextsim{margin:14px 0 4px;font-size:14px}
.card.q .qm p{margin:4px 0 6px;font-size:14px;font-weight:400}
.card.q .qm p:first-child{font-size:15px;font-weight:700}
.asks{display:flex;flex-wrap:wrap;gap:8px 18px;margin:8px 0 10px}
.ask{display:flex;flex-direction:column;gap:2px;min-width:0}
.ask .al{font-size:13px;font-weight:700}
.ask .ai{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
.ask input{width:112px;font:inherit;font-size:16px;font-weight:700;padding:3px 8px;border:1.5px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);text-align:right}
.ask input:focus{outline:2px solid var(--accent);outline-offset:1px}
.ask input.good{border-color:var(--ok);background:var(--ok-bg)}
.ask input.bad{border-color:var(--warn);background:var(--warn-bg)}
.ask .au{font-size:13px}
.ask small{font-size:11.5px;color:var(--muted)}
.card.q .fb p{margin:6px 0 0;font-size:13.5px;font-weight:400}
.fb .okline{color:var(--ok)}
.fb .hintline{border-left:3px solid var(--accent);padding-left:8px}
.card.sheetc{padding-bottom:6px}
table.t.sheet td.num{font-weight:700;white-space:nowrap}
table.t.sheet tr.now td{background:var(--accent-bg)}
table.t.sheet tr.yet td{color:var(--muted)}
table.t.sheet tr.yet td.num{font-weight:400}
table.t.sheet tr.sh td{font-weight:700;color:var(--text2);background:var(--surface2)}
.card.ans .body p{margin:5px 0}
"""
for n in [int(a) for a in sys.argv[1:]]:
    f, title, cores, steps = SIMS[n]
    out = rd('tpl_head.html').replace('%%TITLE%%', title).replace('%%NO%%', str(100 + n))
    out = out.replace('</style>', CSS + '</style>', 1)
    out += rd('c_util.js') + '\n'
    for c in cores: out += rd(c) + '\n'
    out += rd('fw_plot.js') + '\n' + rd('fw_gloss_m.js') + '\n' + rd('fw_core_m.js') + '\n' + rd(steps)
    wr(DOCS / f, out); print(f, len(out.encode('utf-8')))
