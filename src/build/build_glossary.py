"""用語集のページ docs/glossary.html を作る。使い方：python src/build/build_glossary.py
・用語は src/framework/fw_gloss.js、gloss_add.js、gloss_m.js（[グループ, 見出し, 説明, ID]）。入門と中級を 1 つのページにまとめる。
・読み、別の言い方、関係する用語は src/glossary/meta.json。
・「くわしく扱う回・ステップ」は、ステップ定義の印 {{g-ID|文字}} から自動で作る（印のない用語は、その用語が属する回へのリンクだけ）。
・単体の HTML（外部の読み込みなし）。glossary.html#g-ID で、その用語を直接開ける。
最後に、どの回からもリンクされていない用語の数を出す（--unlinked を付けると一覧）。"""
import re, sys, json, html
from paths import rd, wr, DOCS, SRC
from gterm import load_gloss, load_meta, marks_by_step
from sims import SIMS, LEGACY
from msims import MSIMS

# 回の一覧：番号 → (ファイル, 呼び名, 題, ステップ定義)
EPS = {}
for n, v in list(SIMS.items()) + list(LEGACY.items()):
    EPS[n] = (v[0], '入門 第%d回' % n, re.sub(r'^第\d+回 ', '', v[1]), v[3])
for n, v in MSIMS.items():
    EPS[100 + n] = (v[0], '中級 第%d回' % n, v[1], v[3])

ROWS = [('あ', 'あいうえおぁぃぅぇぉゔ'), ('か', 'かきくけこがぎぐげご'), ('さ', 'さしすせそざじずぜぞ'), ('た', 'たちつてとだぢづでどっ'), ('な', 'なにぬねの'),
        ('は', 'はひふへほばびぶべぼぱぴぷぺぽ'), ('ま', 'まみむめも'), ('や', 'やゆよゃゅょ'), ('ら', 'らりるれろ'), ('わ', 'わをん')]
NORM = str.maketrans('がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉゃゅょっゔ', 'かきくけこさしすせそたちつてとはひふへほはひふへほあいうえおやゆよつう')


def row_of(y):
    c = y[:1]
    for name, chars in ROWS:
        if c in chars:
            return name + '行'
    return '英字・数字・記号'


def skey(y):
    return (y.translate(NORM).replace('ー', ''), y)


def esc(s):
    return html.escape(s, quote=True)


def main():
    terms = load_gloss(); meta = load_meta(); byid = {t['id']: t for t in terms}
    miss = [t['id'] for t in terms if t['id'] not in meta or not meta[t['id']].get('y')]
    assert not miss, '読みのない用語：%s' % miss
    # 本文の印から、くわしく扱う回・ステップを集める
    where = {t['id']: [] for t in terms}
    for no in sorted(EPS):
        f, label, name, steps = EPS[no]
        try:
            text = rd(steps)
        except FileNotFoundError:
            continue
        for st, gid, _ in marks_by_step(text):
            if gid in where and (no, st) not in where[gid]:
                where[gid].append((no, st))
    unlinked = [t for t in terms if not where[t['id']]]
    arts = []
    for t in terms:
        m = meta[t['id']]; h = t['head']; mm = re.match(r'^(.*?)（(.*)）$', h)
        name, par = (mm.group(1), mm.group(2)) if mm else (h, '')
        lvl = '中級' if t['grp'] >= 100 else '入門'
        home = EPS.get(t['grp'])
        links = ['<a href="%s#s%d">%s ステップ %d</a>' % (EPS[no][0], st, EPS[no][1], st) for no, st in where[t['id']]]
        if home and not any(no == t['grp'] for no, _ in where[t['id']]):
            links.append('<a href="%s">%s %s</a>' % (home[0], home[1], esc(home[2])))
        rel = ''.join('<a href="#%s">%s</a>' % (r, re.sub(r'（.*）$', '', byid[r]['head'])) for r in m.get('rel', []) if r in byid)
        bad = [r for r in m.get('rel', []) if r not in byid]
        assert not bad, '%s：関係する用語の ID がない %s' % (t['id'], bad)
        alt = m.get('alt', [])
        a = '<article class="term" id="%s" data-y="%s" data-g="%d" data-l="%s">' % (t['id'], esc(m['y']), t['grp'], lvl)
        a += '<h3>%s<span class="lv lv%s">%s</span></h3>' % (name, 'm' if lvl == '中級' else 'i', lvl)
        yo = '<span class="k">読み</span>%s' % esc(m['y']) if re.match('[ぁ-ん]', m['y']) else ''      # 英字で始まる語には、読みを出さない
        if yo or par:
            a += '<p class="yo">' + yo + ('　' if yo and par else '') + ('<span class="k">英語・別の表記</span>%s' % par if par else '') + '</p>'
        a += '<p class="de">%s</p>' % t['desc']
        if alt:
            a += '<p class="al"><span class="k">別の言い方</span>%s</p>' % '、'.join(alt)
        if rel:
            a += '<p class="re"><span class="k">関係する用語</span>%s</p>' % rel
        if links:
            a += '<p class="wh"><span class="k">詳しく扱う回</span>%s</p>' % ''.join(links)
        a += '</article>'
        arts.append((skey(m['y']), row_of(m['y']), a))
    arts.sort(key=lambda x: (x[1] == '英字・数字・記号', x[0]))
    body = ''; cur = None
    for _, row, a in arts:
        if row != cur:
            if cur is not None:
                body += '</section>'
            body += '<section class="grp"><h2>%s</h2>' % row; cur = row
        body += a
    body += '</section>'
    tpl = rd('tpl_head.html')
    roots = ''.join(re.findall(r'^:root(?:\[data-theme="dark"\])?\{.*?^\}\n', tpl, flags=re.S | re.M))
    assert roots.count('{') == 2
    epj = json.dumps({str(k): [v[1], v[2], v[0]] for k, v in sorted(EPS.items())}, ensure_ascii=False)
    out = PAGE.replace('%%ROOTS%%', roots).replace('%%BODY%%', body).replace('%%EPS%%', epj).replace('%%N%%', str(len(terms)))
    wr(DOCS / 'glossary.html', out)
    print('glossary.html', len(out.encode('utf-8')), '用語', len(terms), '（入門 %d、中級 %d）' % (sum(1 for t in terms if t['grp'] < 100), sum(1 for t in terms if t['grp'] >= 100)),
          '本文からリンクのある用語', len(terms) - len(unlinked), 'ない用語', len(unlinked))
    if '--table' in sys.argv:
        style = (SRC.parent / 'STYLE.md').read_text(encoding='utf-8'); heads = ' '.join(t['head'] for t in terms); miss = []; n = 0
        for ln in style.split('\n'):
            mm = re.match(r'^\| (.+?) \| (.+?) \|$', ln)
            if not mm or mm.group(1) in ('今の言い方', '---') or set(mm.group(1)) <= set('-'):
                continue
            for w in re.split(r'[／、]', re.sub(r'（[^）]*）', '', mm.group(2))):
                w = w.strip()
                if w:
                    n += 1
                    if w not in heads:
                        miss.append(w)
        print('対応表の右の用語 %d 語のうち、用語集の見出しにないもの %d 語：%s' % (n, len(miss), '、'.join(miss)))
    if '--unlinked' in sys.argv:
        for t in unlinked:
            print('  ', t['id'], t['head'])


PAGE = r"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>用語集 — レーダ 入門・中級シミュレータ</title>
<style>
%%ROOTS%%*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-size:14px;line-height:1.75;
  font-family:"Yu Gothic UI","Meiryo UI","Meiryo","Hiragino Sans","Noto Sans JP","Noto Sans CJK JP",system-ui,sans-serif}
button,input{font:inherit;color:inherit}
a{color:var(--accent)}
header.top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:10px;padding:7px 14px;background:var(--surface);border-bottom:1px solid var(--border)}
header.top h1{font-size:16px;margin:0;font-weight:700;flex:1;min-width:0}
.btn{border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:4px 10px;cursor:pointer;line-height:1.4;white-space:nowrap;text-decoration:none;color:var(--text);display:inline-block}
.btn:hover{border-color:var(--accent)}
.btn.sm{padding:2px 8px;font-size:12.5px}
.btn:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.wrap{max-width:980px;margin:0 auto;padding:12px 16px 60px}
.lead{margin:4px 0 10px;color:var(--text2);font-size:13px}
.tools{position:sticky;top:41px;z-index:20;background:var(--bg);padding:8px 0;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;border-bottom:1px solid var(--border)}
.tools input[type=search]{flex:1;min-width:180px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface)}
.seg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--border);border-radius:6px;overflow:hidden;background:var(--surface)}
.seg button{border:0;background:none;padding:3px 12px;cursor:pointer;font-size:13px;border-left:1px solid var(--border);white-space:nowrap}
.seg button:first-child{border-left:0}
.seg button[aria-pressed=true]{background:var(--accent-bg);color:var(--accent);font-weight:700}
.cnt{font-size:12.5px;color:var(--muted);white-space:nowrap}
.jump{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 0;font-size:12.5px}
.jump a{border:1px solid var(--border);border-radius:999px;padding:0 9px;background:var(--surface);text-decoration:none;white-space:nowrap}
section.grp>h2{font-size:15px;margin:22px 0 6px;color:var(--accent);border-bottom:2px solid var(--border);padding-bottom:2px;scroll-margin-top:110px}
article.term{background:var(--surface);border:1px solid var(--border);border-left:5px solid var(--border);border-radius:8px;padding:8px 14px 9px;margin:8px 0;scroll-margin-top:110px}
article.term h3{font-size:15.5px;margin:0;line-height:1.5;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
article.term p{margin:2px 0}
article.term .k{display:inline-block;font-size:11px;font-weight:700;color:var(--text2);border:1px solid var(--border);border-radius:4px;padding:0 5px;margin-right:6px;line-height:1.5;white-space:nowrap}
article.term .yo,article.term .al,article.term .re,article.term .wh{font-size:12.5px;color:var(--text2)}
article.term .de{margin:4px 0 5px}
article.term .re a,article.term .wh a{display:inline-block;margin-right:12px}
.lv{font-size:11px;font-weight:700;border-radius:4px;padding:0 7px;line-height:1.6;white-space:nowrap;border:1px solid var(--accent);color:var(--accent)}
.lv.lvm{background:var(--accent);color:var(--surface)}
article.term:target,article.term.hit{border-color:var(--accent);border-left-color:var(--hl);background:var(--accent-bg);box-shadow:0 0 0 2px var(--accent)}
article.term.hit h3::before{content:"▶";color:var(--hl);font-size:12px}
.none{margin:20px 0;color:var(--muted)}
[hidden]{display:none!important}
@media print{header.top .btn,.tools{display:none}}
</style>
</head>
<body>
<header class="top">
  <a class="btn sm" href="00_index.html" title="シリーズの目次へ">← 目次</a>
  <h1>用語集（入門・中級）</h1>
  <button class="btn sm" id="themeBtn" type="button" title="ライト／ダーク表示を切り替える">表示: ライト</button>
</header>
<div class="wrap">
<p class="lead">入門（第0〜17回）と中級（第1〜8回）で使う %%N%% 語をまとめています。各回の本文で下線の付いた用語を押すと短い説明が表示され、そこからこのページの該当する用語を開けます。説明は Radar Handbook 3rd ed. の用語を言い換えたもので、「基礎の用語」は一般的な知識による補足です。</p>
<div class="tools">
  <input type="search" id="q" placeholder="用語を検索（見出し・読み・英語・別の言い方・説明）" aria-label="用語をさがす">
  <span class="seg" role="group" aria-label="並べ方"><button type="button" data-v="kana" aria-pressed="true">五十音順</button><button type="button" data-v="ep" aria-pressed="false">回ごと</button></span>
  <span class="seg" role="group" aria-label="入門と中級"><button type="button" data-l="" aria-pressed="true">すべて</button><button type="button" data-l="入門" aria-pressed="false">入門</button><button type="button" data-l="中級" aria-pressed="false">中級</button></span>
  <span class="cnt" id="cnt" aria-live="polite"></span>
</div>
<nav class="jump" id="jump" aria-label="見出しへ移動"></nav>
<main id="list">%%BODY%%</main>
<p class="none" id="none" hidden>該当する用語がありません。</p>
</div>
<script>
'use strict';
const EPS = %%EPS%%;
const $ = s => document.querySelector(s), list = $('#list');
const arts = [...document.querySelectorAll('article.term')], kana = arts.slice();
let view = 'kana', lvl = '';
const rowOf = y => { const c = y.charAt(0), R = [['あ', 'あいうえおぁぃぅぇぉゔ'], ['か', 'かきくけこがぎぐげご'], ['さ', 'さしすせそざじずぜぞ'], ['た', 'たちつてとだぢづでどっ'], ['な', 'なにぬねの'], ['は', 'はひふへほばびぶべぼぱぴぷぺぽ'], ['ま', 'まみむめも'], ['や', 'やゆよゃゅょ'], ['ら', 'らりるれろ'], ['わ', 'わをん']]; for (const r of R) if (r[1].indexOf(c) >= 0) return r[0] + '行'; return '英字・数字・記号'; };
function layout(){
  const groups = [], put = (name, a) => { let g = groups.find(x => x[0] === name); if (!g){ g = [name, []]; groups.push(g); } g[1].push(a); };
  if (view === 'kana') for (const a of kana) put(rowOf(a.dataset.y), a);
  else { const by = arts.slice().sort((a, b) => Number(a.dataset.g) - Number(b.dataset.g)); for (const a of by){ const g = a.dataset.g, e = EPS[g]; put(e ? e[0] + ' ' + e[1] : '基礎の用語', a); } }
  list.innerHTML = ''; let k = 0;
  for (const g of groups){ const s = document.createElement('section'); s.className = 'grp'; const h = document.createElement('h2'); h.textContent = g[0]; h.id = 'sec' + (k++); s.appendChild(h); for (const a of g[1]) s.appendChild(a); list.appendChild(s); }
  filter();
}
function filter(){
  const q = $('#q').value.trim().toLowerCase(); let n = 0;
  for (const a of arts){ const hit = (!lvl || a.dataset.l === lvl) && (!q || (a.textContent + ' ' + a.dataset.y).toLowerCase().indexOf(q) >= 0); a.hidden = !hit; if (hit) n++; }
  let j = '';
  for (const s of list.children){ const any = [...s.querySelectorAll('article.term')].some(a => !a.hidden); s.hidden = !any; if (any){ const h = s.firstElementChild; j += '<a href="#' + h.id + '">' + h.textContent + '</a>'; } }
  $('#jump').innerHTML = j; $('#cnt').textContent = n + ' 語'; $('#none').hidden = n > 0;
}
function show(id, jump){
  const a = document.getElementById(id); if (!a || !a.classList.contains('term')) return false;
  if (a.hidden){ $('#q').value = ''; lvl = ''; for (const b of document.querySelectorAll('.seg button[data-l]')) b.setAttribute('aria-pressed', String(b.dataset.l === '')); filter(); }
  for (const e of document.querySelectorAll('article.term.hit')) e.classList.remove('hit');
  a.classList.add('hit'); if (jump) a.scrollIntoView({block: 'center'}); a.tabIndex = -1; a.focus({preventScroll: true});
  return true;
}
function fromHash(){ const id = decodeURIComponent((location.hash || '').slice(1)); if (id) show(id, true); }
$('#q').addEventListener('input', filter);
document.querySelector('.tools').addEventListener('click', e => {
  const b = e.target.closest ? e.target.closest('.seg button') : null; if (!b) return;
  if (b.dataset.v !== undefined){ view = b.dataset.v; for (const x of document.querySelectorAll('.seg button[data-v]')) x.setAttribute('aria-pressed', String(x === b)); layout(); }
  else { lvl = b.dataset.l; for (const x of document.querySelectorAll('.seg button[data-l]')) x.setAttribute('aria-pressed', String(x === b)); filter(); }
});
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let theme = mq && mq.matches ? 'dark' : 'light';
const applyTheme = t => { document.documentElement.setAttribute('data-theme', t); $('#themeBtn').textContent = '表示: ' + (t === 'dark' ? 'ダーク' : 'ライト'); };
$('#themeBtn').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(theme); });
applyTheme(theme); layout(); fromHash();
window.addEventListener('hashchange', fromHash);
</script>
</body>
</html>
"""

if __name__ == '__main__':
    main()
