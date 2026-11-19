"""用語集の共通部品（build2.py、build_m.py、build_glossary.py、tests/jlint.py が使う）。
・用語は src/framework/fw_gloss.js、gloss_add.js、gloss_m.js の [グループ, 見出し, 説明, ID]。ID（g-…）は変えない。
・読み、別の言い方、関係する用語は src/glossary/meta.json（ID ごと）。
・本文の印 {{g-ID|表示する文字}} を、組み立てのときに <a class=gt data-g=g-ID …> に直す（expand）。
  図の強調の印 [[キー|文字]] とは別のもの。印は、各ステップで、その用語が最初に出る 1 か所だけに付ける。"""
import re, json
from paths import rd, SRC

GFILES = ['fw_gloss.js', 'gloss_add.js', 'gloss_m.js']
ENTRY = re.compile(r"^  \[(-?\d+), '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)', '(g-[a-z0-9-]+)'\]", re.M)
MARK = re.compile(r'\{\{(g-[a-z0-9-]+)\|([^{}|]+)\}\}')
ANCHOR = '<a class=gt data-g=%s tabindex=0 role=button aria-haspopup=dialog aria-expanded=false>%s</a>'


def _unq(s):
    return s.replace("\\'", "'").replace('\\\\', '\\')


def load_gloss():
    """用語の一覧。grp：−1 = 基礎、0〜17 = 入門の回、101〜 = 中級の回"""
    out = []
    for f in GFILES:
        t = rd(f)
        ms = list(ENTRY.finditer(t))
        n = len(re.findall(r"^  \[-?\d+, '", t, flags=re.M))
        assert len(ms) == n, '%s：ID のない用語がある（%d / %d）' % (f, len(ms), n)
        for m in ms:
            g = int(m.group(1))
            if f == 'fw_gloss.js' and g == 0:
                g = -1
            out.append({'grp': g, 'head': _unq(m.group(2)), 'desc': _unq(m.group(3)), 'id': m.group(4), 'src': f})
    ids = [t['id'] for t in out]
    assert len(ids) == len(set(ids)), 'ID が重なっている'
    return out


def load_meta():
    return json.loads((SRC / 'glossary' / 'meta.json').read_text(encoding='utf-8'))


def expand(text, name, mid=False, legacy=False):
    """本文の印を、用語のリンクに直す。入門の回（mid=False）では、中級だけの用語（gloss_m.js）は使えない。
    第1〜4回（legacy=True）は、HTML に fw_gloss.js しか入らないので、その用語だけを使える"""
    ok = {t['id'] for t in load_gloss() if (t['src'] == 'fw_gloss.js' if legacy else (mid or t['src'] != 'gloss_m.js'))}

    def rep(m):
        if m.group(1) not in ok:
            raise SystemExit('%s：用語集にない ID %s（「%s」）' % (name, m.group(1), m.group(2)))
        return ANCHOR % (m.group(1), m.group(2))
    seen = set()
    for st, gid, word in marks_by_step(text):       # 同じステップで、同じ用語に 2 度リンクを張らない
        if (st, gid) in seen:
            raise SystemExit('%s：ステップ %d で %s（「%s」）に 2 度リンクがある' % (name, st, gid, word))
        seen.add((st, gid))
    out = MARK.sub(rep, text)
    assert '{{g-' not in out, '%s：直せなかった印がある' % name
    return out


def marks_by_step(text):
    """ステップ定義の中の印を、ステップの番号（1 から）ごとに返す：[(ステップ, ID, 文字)]"""
    starts = [m.start() for m in re.finditer(r'STEPS\.push\(', text)]
    out = []
    for m in MARK.finditer(text):
        st = sum(1 for s in starts if s < m.start())
        out.append((st, m.group(1), m.group(2)))
    return out


# 用語のリンクと、その場に出す説明の見た目（入門・中級の HTML に入れる）
GT_CSS = """a.gt{color:inherit;text-decoration:underline dashed var(--accent);text-decoration-thickness:1.5px;text-underline-offset:3px;cursor:help;border-radius:3px}
a.gt::after{content:"?";font-size:.68em;font-weight:700;vertical-align:super;line-height:0;margin-left:1px;color:var(--accent)}
a.gt:hover,a.gt[aria-expanded=true]{background:var(--accent-bg)}
.gpop{position:absolute;z-index:38;width:min(340px,calc(100vw - 16px));background:var(--surface);border:1.5px solid var(--accent);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.28);padding:8px 12px 10px;font-size:13px;font-weight:400;line-height:1.65;color:var(--text)}
.gpop:focus{outline:2px solid var(--accent);outline-offset:1px}
.gpop .gh{display:block;font-size:14px;font-weight:700;margin:0 0 2px}
.gpop p{margin:0 0 8px;color:var(--text2)}
.gpop .gpa{display:flex;flex-wrap:wrap;gap:6px}
#gloss dt.hit,#gloss dt.hit+dd{background:var(--accent-bg);box-shadow:-6px 0 0 var(--accent-bg),6px 0 0 var(--accent-bg)}
#gloss .glpage{margin:0 0 8px;font-size:12.5px}
.tile .k,.tile .v,.tile .s,.plot-t,.ctl-h label,.ctl small,.ctl .chk,.ch button,.card.q p,.card.ms p,nav#steps,#read h2,.fixed{word-break:auto-phrase}
.seg button{padding:2px 7px}
"""
