"""文章の検査（STYLE.md の決まりを、機械で数える）。
使い方：python tests/jlint.py m04_measurement_accuracy.html 15_radar_equation.html   # 回を指定
        python tests/jlint.py --all                                                  # 全回と用語集
        付けられるもの：-v（該当した文をすべて出す）、--gloss-all（用語集の全用語を調べる。指定しないと、調べる回からリンクのある用語だけ）
先に python tests/dump.py を実行しておく（src/generated/dump.json を読む）。

数えるもの（合格の線は 0 件。残す理由がある所は tests/jlint_allow.txt に書く）：
  読点  ：助詞（は・が・を・に・で・も・と）で終わる 8 字以下の句の直後の読点
  読点4 ：読点が 4 つ以上ある文（括弧の中の読点は数えない）
  長文  ：120 字を超える文
  体言止：解説の欄（what、ana、cond、fail、mis、why、solve、memo）で、述語で終わらない文。式の行（= ≈ → を含む文）と、「」で終わる文は除く
  用語  ：STYLE.md の対応表の左の語（たとえ話 ana の中は除く）
  話し言：話し言葉（だから、／〜ぶん／要る／高くつく／得を　など）
  文体  ：入門の回に「である」調の文、中級の回に「です」「ます」
補足の一覧（hosoku）も、ほかの欄と同じに調べる（項目は名詞で止めてよい）。指導者向けメモの「」の中（声かけの例）は、用語だけを調べる。
画面に出ていない文字（条件によって出る文など）は、ステップ定義と計算部分の文字列から拾い、用語・話し言葉・文体だけを調べる（欄は「src」）。"""
import sys, re, json
from pathlib import Path
from conf import GEN, ROOT
sys.path.insert(0, str(ROOT / 'src' / 'build'))
from gterm import load_gloss            # noqa: E402
from sims import SIMS, LEGACY           # noqa: E402
from msims import MSIMS                 # noqa: E402

EXPL = {'what', 'ana', 'cond', 'fail', 'mis', 'why', 'solve', 'memo'}
PARTS = 'はがをにでもと'
CONN = {'逆に', 'さらに', '次に', '同様に', '一般に', '特に', '最後に', '第一に', '第二に', '第三に', 'そこで', 'ここで', '一方で', 'ところで', '実際に', '反対に', '同時に', '最初に', '具体的に', '結果的に', 'その結果', 'とくに', 'ほかに', 'また', 'なお', '厳密に'}
HNOUN = ('これ', 'それ', 'あれ', 'どれ', 'ここ', 'そこ', 'もの', 'こと', 'とき', 'ほう', 'ため', 'ところ', 'ほか', 'それぞれ', 'どちら', 'いずれ', 'すべて', 'これら', 'それら', 'ふつう', 'あと', 'まえ', 'うち', 'なか', 'ほど', 'だけ', 'など')
# 対応表の左の語（STYLE.md と同じ内容。語を足したら、両方を直す）
TERMS = [
    ('ゆらぐ／ゆらぎ', r'ゆら[ぐがぎい]'), ('足し合わせ', r'足し合わ'), ('そろえて足す／そろえずに足す', r'そろえ(て|ずに)足|そろえ(て|ない)場合'), ('ならす', r'なら(す|し|され|さな|せば|せる)'),
    ('細かさ', r'細かさ'), ('見分ける', r'見分け'), ('谷', r'谷'), ('山', r'(?<![火登氷])山(?![田本口])'), ('消え残り', r'消え残'), ('役目', r'役目'),
    ('向き', r'(?<![下上横逆前内外右左])向き(?!合)'), ('（ビームを）振る', r'(?<!割り)(?<!割)振(る|り|っ|ら|れ)(?!舞)'), ('見て回る／1 巡', r'見て回|[0-9０-９] ?巡'), ('照らす', r'照ら'), ('はね返る', r'はね返|跳ね返'),
    ('強さ', r'強さ'), ('速さ', r'速さ'), ('誤報', r'誤報'), ('床', r'(?<![一-龥])床'), ('刻み／段数', r'刻み|段数'), ('ずれ', r'(?<![いれ])ずれ'), ('ふらつき', r'ふらつ'),
    ('広がり', r'広がり(?![、ま（])|拡がり'), ('重み', r'重み(?!付け|係数)'), ('見通し', r'見通し(?!距離|線|内|外)'), ('閉じ込める', r'閉じ込め'), ('近くが見えない距離', r'近くが見えない'),
    ('あいまいにならない', r'あいまいにならない'), ('すき間', r'すき間'), ('誤差の傾き', r'誤差の傾き'), ('頭打ち', r'頭打ち'), ('相手が雑音だけ', r'相手が'), ('遠くまで届く', r'遠くまで'),
    # 見本の 2 回で足した語
    ('効き目', r'効き目'), ('見る範囲／見続ける', r'見る範囲|見続け|見る時間|見て回'), ('足し方', r'足し方'), ('決め手', r'決め手'), ('薄まる', r'薄ま'), ('縮む', r'縮[むみまん]'),
    ('かたより／かたよる', r'かたよ'), ('すそ', r'すそ'), ('見かけの中心', r'見かけの中心'), ('引っぱる／引きずる／引き込む', r'引っぱ|引きず|引き込'), ('打つ手／手', r'打つ手|減らす手|[るの]手[はをがも]'), ('つぶれた', r'つぶれ'), ('拾う', r'拾[うい]|拾っ'),
]
COLLOQ = [
    ('だから、', r'だから、'), ('〜ぶん', r'ぶん'), ('要る', r'要[るりら]|要れば|要っ[てた]'), ('高くつく', r'[高安]くつ'), ('得をする', r'(?<![一-龥])得を(し|す)|(?<![一-龥])得する'), ('ずっと', r'ずっと'), ('かなり', r'(?<!し)かなり(?!ませ|ます)'),
    ('とても', r'とても'), ('けた違い', r'けた違い|桁違い'), ('けれど', r'けれど'), ('でも、', r'(^|。)でも、'), ('いちばん', r'いちばん|一番'), ('もっと', r'もっと'), ('たくさん', r'たくさん'),
    ('ぎりぎり', r'ぎりぎり'), ('ばらばら', r'ばらばら'), ('ちゃんと／ちょっと／すごく／だんだん／ずいぶん', r'ちゃんと|ちょっと|すごく|だんだん|ずいぶん'), ('〜てね', r'てね[。）」]|てね$'),
    ('わけ', r'わけ(では|でも|です|だ)'), ('ほんの／ごく', r'ほんの'), ('〜っぱなし／〜ちゃう', r'ちゃ[うっ]'), ('なので、（文頭）', r'(^|。)なので、'), ('いくら〜ても', r'いくら[^。]{0,12}ても|いくらでも'),
]
POLITE = re.compile(r'です|(?<!ま)ます|ません|でした|ました|ましょう|ください|でしょう')
POLITE_END = ('です', 'ます', 'ません', 'でした', 'ました', 'ましょう', 'ください', 'でしょう', 'ですか', 'ますか', 'でしょうか', 'ませんか', 'ですね')
PLAIN_LAST = set('るいただうくすつむぶぐぬか')


def strip(s):
    s = re.sub(r'\[\[[^|\]]+\|([^\]]+)\]\]', r'\1', str(s)); s = re.sub(r'\{\{g-[a-z0-9-]+\|([^{}|]+)\}\}', r'\1', s)
    s = s.replace('{H}', '').replace('<br>', '\n')
    s = re.sub(r'</t[dh]>|</tr>|</h3>|</p>', '\n', s)      # 表の升目と見出しは、1 つずつ別の行として調べる
    s = re.sub(r'<sup>([^<]*)</sup>', r'^\1', s); s = re.sub(r'<[^>]+>', '', s)
    return s.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')


def sentences(text):
    """段落（||）と文に分ける。（）と「」の中では切らない"""
    out = []
    for para in re.split(r'\|\||\n', strip(text)):      # 段落（||）と、行（<br>。箇条書きの 1 項目）
        buf = ''; dp = 0; dq = 0
        for ch in para:
            buf += ch
            if ch in '（(':
                dp += 1
            elif ch in '）)':
                dp = max(0, dp - 1)
            elif ch == '「':
                dq += 1
            elif ch == '」':
                dq = max(0, dq - 1)
            elif ch in '。？！?' and dp == 0 and dq == 0:
                out.append(buf.strip()); buf = ''
        if buf.strip():
            out.append(buf.strip())
    return out


def is_noun_end(stem):
    if not stem:
        return False
    c = stem[-1]
    if re.match(r'[一-龥々ァ-ヶーA-Za-z0-9０-９%°）)\]₀-₉⁰-⁹α-ωΑ-Ω²³/′″µ]', c):
        return True
    return any(stem.endswith(h) for h in HNOUN)


def short_commas(sent):
    """助詞で終わる 8 字以下の句の直後の読点"""
    hits = []; start = 0; dp = 0
    for i, ch in enumerate(sent):
        if ch in '。「」（）()：；—？！':
            start = i + 1
        elif ch == '、':
            ph = sent[start:i].replace(' ', '').replace('　', ''); start = i + 1
            if not ph or len(ph) > 8 or ph[-1] not in PARTS or ph in CONN:
                continue
            stem = ph[:-1]
            if ph[-1] in 'でにと' and re.search(r'[はが]', stem):      # 「倍率は 1 で、」のような節の切れ目
                continue
            if is_noun_end(stem) or (len(stem) > 1 and stem[-1] in 'にでとのへ' and is_noun_end(stem[:-1])) or (stem.endswith('から') and is_noun_end(stem[:-2])) or (stem.endswith('まで') and is_noun_end(stem[:-2])):
                hits.append(ph + '、')
    return hits


def comma_count(sent):
    n = 0; dp = 0
    for ch in sent:
        if ch in '（(「':
            dp += 1
        elif ch in '）)」':
            dp = max(0, dp - 1)
        elif ch == '、' and dp == 0:
            n += 1
    return n


def tail(sent):
    """文末の句点と、うしろの括弧を取った残り"""
    s = sent.rstrip('。？！? 　')
    while True:
        m = re.search(r'（[^（）]*）$|\([^()]*\)$', s)
        if not m:
            break
        s = s[:m.start()].rstrip()
    return s


def has_pred(sent, polite):
    t = tail(sent)
    if not t or t.endswith('」') or t.endswith('』'):
        return True
    if polite:
        return t.endswith(POLITE_END)
    return t[-1] in PLAIN_LAST and not t.endswith(('ほか', 'なか', 'しか', 'ばか'))


def no_quote(s):
    return re.sub(r'「[^「」]*」', '「」', s)


class Lint:
    def __init__(self, allow):
        self.items = []; self.allow = allow; self.used = set()

    def add(self, f, st, field, cat, snip, sent=''):
        for k, a in enumerate(self.allow):
            if a[0] in ('*', f) and a[1] == cat and a[2] in (snip + '｜' + sent):
                self.used.add(k); return
        self.items.append((f, st, field, cat, snip, sent))

    def check(self, f, st, field, text, mid, gloss=False):
        if not text or not re.search(r'[ぁ-んァ-ヶ一-龥]', str(text)):
            return
        polite = gloss or not mid
        raw = strip(text); words_only = False
        body = raw if field != 'memo' else no_quote(raw)
        if field != 'ana':
            for name, rx in TERMS:
                for m in re.finditer(rx, raw):
                    self.add(f, st, field, '用語', name + '：' + raw[max(0, m.start() - 8):m.end() + 8], raw[max(0, m.start() - 30):m.end() + 30])
        if words_only:
            return
        for name, rx in COLLOQ:
            for m in re.finditer(rx, body):
                self.add(f, st, field, '話し言', name + '：' + body[max(0, m.start() - 8):m.end() + 8], body[max(0, m.start() - 30):m.end() + 30])
        if field == 'eq':
            return
        for s in sentences(body if field == 'memo' else text):
            for h in short_commas(s):
                self.add(f, st, field, '読点', h, s)
            if comma_count(s) >= 4 and not re.match(r'[(（]\d+[)）]|・', s) and field not in ('sheet', 'tiles', 'fixT', 'fixed', 'pcfg', 'small', 'legend'):      # 箇条書きの項目は、名詞の並びを許す
                self.add(f, st, field, '読点4', '読点 %d' % comma_count(s), s)
            n = len(re.sub(r'\s', '', s))
            if n > 120:
                self.add(f, st, field, '長文', '%d 字' % n, s)
            ends = s[-1:] in '。？！?'
            eqline = bool(re.search(r'[=≈→]', s))
            item = bool(re.match(r'[(（]\d+[)）]|・', s))      # 箇条書きの項目は、名詞で止めてよい
            if field in EXPL and not eqline and not item and not has_pred(s, polite):
                self.add(f, st, field, '体言止', tail(s)[-12:], s)
            if polite:
                t = tail(s)
                if ends and s.endswith('。') and t and not t.endswith(('」', '』')) and t[-1] in PLAIN_LAST and not t.endswith(POLITE_END) and not t.endswith(('ますか', 'ですか', 'ほか', 'なか')) and field not in ('sym',) and not eqline:
                    self.add(f, st, field, '文体', t[-10:] + '。', s)
            else:
                m = POLITE.search(no_quote(s))
                if m:
                    self.add(f, st, field, '文体', no_quote(s)[max(0, m.start() - 8):m.end() + 2], s)


def js_strings(src):
    """JS の文字列リテラル（日本語を含むもの）を取り出す。コメントは除く"""
    out = []; i = 0; n = len(src); prev = ''
    while i < n:
        c = src[i]
        if c == '/' and src[i + 1:i + 2] == '/':
            j = src.find('\n', i); i = n if j < 0 else j; continue
        if c == '/' and src[i + 1:i + 2] == '*':
            j = src.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if c == '/' and prev in '(,=:[!&|?{};\n' + '':
            j = i + 1; cls = False
            while j < n and (src[j] != '/' or cls) and src[j] != '\n':
                if src[j] == '\\':
                    j += 1
                elif src[j] == '[':
                    cls = True
                elif src[j] == ']':
                    cls = False
                j += 1
            i = j + 1; prev = '/'; continue
        if c in '\'"`':
            j = i + 1; buf = ''
            while j < n and src[j] != c:
                if src[j] == '\\':
                    buf += src[j + 1:j + 2]; j += 2; continue
                buf += src[j]; j += 1
            if re.search(r'[ぁ-んァ-ヶ一-龥]', buf):
                out.append(buf)
            i = j + 1; prev = c; continue
        if not c.isspace():
            prev = c
        i += 1
    return out


def ep_sources(fname):
    """回の HTML の名前 → (中級か, ソースの一覧)"""
    for n, v in list(SIMS.items()) + list(LEGACY.items()):
        if v[0] == fname:
            return False, list(v[2]) + [v[3]], n
    for n, v in MSIMS.items():
        if v[0] == fname:
            return True, [c for c in v[2] if c != 'cm_common.js'] + [v[3]], 100 + n
    raise SystemExit('回が見つからない：' + fname)


def find_src(name):
    for d in ('episodes', 'episodes/legacy', 'framework', 'generated'):
        p = ROOT / 'src' / d / name
        if p.exists():
            return p.read_text(encoding='utf-8')
    raise FileNotFoundError(name)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]; verbose = '-v' in sys.argv
    dump = {e['file']: e for e in json.load(open(GEN / 'dump.json', encoding='utf-8'))}
    files = sorted(dump) if '--all' in sys.argv else args
    if not files:
        raise SystemExit(__doc__)
    ap = Path(__file__).with_name('jlint_allow.txt'); allow = []
    if ap.exists():
        for ln in ap.read_text(encoding='utf-8').splitlines():
            if ln.strip() and not ln.startswith('#'):
                p = ln.split('|')
                allow.append((p[0].strip(), p[1].strip(), p[2].strip(), p[3].strip() if len(p) > 3 else ''))
    L = Lint(allow); used_ids = set(); nsent = {}
    for f in files:
        e = dump[f]; mid, srcs, no = ep_sources(f); seen = []

        def ck(st, field, text):
            if isinstance(text, (list, tuple)):
                for t in text:
                    ck(st, field, t)
                return
            if text is None or text == '':
                return
            seen.append(strip(text)); L.check(f, st, field, text, mid)
        ck(0, 'title', e['title']); ck(0, 'pret', e.get('pret', [])); ck(0, 'ct', [[c[1]] + c[2] for c in e.get('ct', [])])
        cnt = 0
        for i, s in enumerate(e['steps'], 1):
            for k in ('short', 'title', 'q', 'ch', 'why', 'memo', 'do', 'solve', 'mission', 'ctl', 'fixed', 'fixT', 'acts', 'plots', 'tiles', 'small', 'seg', 'legend', 'pcfg', 'sheet', 'uiq', 'hosoku'):
                ck(i, k, s.get(k))
            for k, v in (s.get('read') or {}).items():
                ck(i, k, v)
            for a in s.get('ask', []):
                ck(i, 'ask', a['label']); ck(i, 'hint', a['hints'])
            for k in ('q', 'why', 'memo', 'solve'):
                cnt += len(sentences(s.get(k) or ''))
            for k in ('ana', 'what', 'cond', 'fail', 'mis'):
                cnt += len(sentences((s.get('read') or {}).get(k) or ''))
        nsent[f] = cnt
        for row in e.get('checks', []):
            ck(len(e['steps']), 'checks', row)
        # 画面に出ていない文字：ソースの文字列から
        seen_all = '\n'.join(seen)
        for sname in srcs + (['fw_m_add.js'] if mid else ['fw_core2.js']):
            text = find_src(sname)
            for m in re.finditer(r'data-g=(g-[a-z0-9-]+)|\{\{(g-[a-z0-9-]+)\|', text):
                used_ids.add(m.group(1) or m.group(2))
            for lit in js_strings(text):
                t = strip(lit)
                if t in seen_all or 'function' in lit:
                    continue
                for name, rx in TERMS + COLLOQ:
                    for m in re.finditer(rx, t):
                        L.add(f, 0, 'src:' + sname, '用語' if (name, rx) in TERMS else '話し言', name + '：' + t[max(0, m.start() - 8):m.end() + 8], t[:80])
                if mid and POLITE.search(no_quote(t)):
                    L.add(f, 0, 'src:' + sname, '文体', t[:24], t[:80])
                if not mid and re.search(r'(である|だ|ない|[^まで]した|する|なる|れる|いる|ある)。', no_quote(t)):
                    L.add(f, 0, 'src:' + sname, '文体', t[:24], t[:80])
                for s in sentences(t):
                    for h in short_commas(s):
                        L.add(f, 0, 'src:' + sname, '読点', h, s[:80])
    # 用語集
    terms = load_gloss(); gl_all = '--gloss-all' in sys.argv or '--all' in sys.argv; ng = 0
    for t in terms:
        if gl_all or t['id'] in used_ids:
            ng += 1
            L.check('glossary', 0, t['id'] + ' 見出し', t['head'], False, True)
            for s in [t['desc']]:
                L.check('glossary', 0, t['id'], s, False, True)
                for x in sentences(s):
                    if not re.search(r'[=≈→]', x) and not has_pred(x, True):
                        L.add('glossary', 0, t['id'], '体言止', tail(x)[-12:], x)
    cats = ['読点', '読点4', '長文', '体言止', '用語', '話し言', '文体']
    print('回・用語集'.ljust(34), ' '.join(c.rjust(5) for c in cats), '   計')
    tot = 0
    for f in files + ['glossary']:
        row = [sum(1 for it in L.items if it[0] == f and it[3] == c) for c in cats]; tot += sum(row)
        print((f + ('（%d 語）' % ng if f == 'glossary' else '（解説の文 %d）' % nsent.get(f, 0))).ljust(34), ' '.join(str(x).rjust(6) for x in row), str(sum(row)).rjust(5))
    if verbose or tot:
        last = None
        for it in sorted(L.items, key=lambda x: (x[0], x[1], x[2], x[3])):
            if (it[0], it[1]) != last:
                print('\n== %s ステップ %s' % (it[0], it[1] or '—')); last = (it[0], it[1])
            print('  [%s] %s｜%s%s' % (it[3], it[2], it[4], ('　… ' + it[5][:110]) if verbose and it[5] else ''))
    unused = [allow[k] for k in range(len(allow)) if k not in L.used and (allow[k][0] == '*' or allow[k][0] in files + ['glossary'])]
    print('\n除外の一覧（jlint_allow.txt）：%d 行、使われたもの %d 行' % (len(allow), len(L.used)) + (('、使われなかったもの：%s' % [a[2] for a in unused]) if unused else ''))
    print('jlint', '合格（0 件）' if tot == 0 else '%d 件' % tot)
    sys.exit(1 if tot else 0)


if __name__ == '__main__':
    main()
