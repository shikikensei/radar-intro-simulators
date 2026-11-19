"""数値が変わっていないことの検査。書き直す前の dump（tests/baseline/）と、今の dump（src/generated/dump.json）を比べる。
使い方：python tests/numdiff.py m04_measurement_accuracy.html 15_radar_equation.html   （--all で全回、-v で一致した欄の数も出す）
先に python tests/dump.py を実行しておく。

比べ方（ステップ・欄ごと）：
  ・文章の欄：数値（単位つき）の集まりが同じ。例：「13 dB」「0.5 倍」「10⁻⁶」「1/8」。語順が変わってもよい。
  ・式の欄（eq）：日本語の語を除いた文字が、そのまま同じ（日本語の語だけが変わった欄は、別に数えて出す）。
  ・答え（ans）、許容誤差（tol、tolType）、解の設定（sol）、ミッションの条件（msOk：判定の式）、選択肢の数：そのまま同じ。
  ・照合表：行の数と判定（一致／差あり／…）がそのまま同じで、行ごとの数値の集まりが同じ。
  ・操作部・タイル・計算書・図の中の文字：数値の集まりが同じ（計算が変わっていないことの確認）。
合わない所で、理由がある所は tests/numdiff_allow.txt に書く（ファイル|ステップ|欄|理由）。"""
import sys, re, json
from collections import Counter
from pathlib import Path
from conf import GEN

BASE = Path(__file__).with_name('baseline')
UNITS = ['dBW/Hz', 'dBsm', 'dBW', 'dBi', 'dB', 'W·m²', 'kW·m²', 'W/Hz', 'mrad', 'rad', 'MHz', 'kHz', 'GHz', 'Hz', 'km', 'cm', 'mm', 'm²', 'm/s', 'ms', 'µs', 'ns', 'MW', 'kW', 'mW', 'W', 'sr', 'K', 'ノット', 'kt',
         '%', '°', '度', '秒', '分', '倍', '個', '回', '乗根', '乗', 'ビット', 'ミリ度', 'g', 'm', 's']
NUM = re.compile(r'10[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹·]+|[−\-+]?\d+(?:[.,]\d+)*(?:[eE][−\-+]?\d+)?(?:\s?[×x]\s?10[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹·]+|\^[−\-]?\d+(?:\.\d+)?)?|[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+')
JP = re.compile(r'[ぁ-んァ-ヶー一-龥々、。「」（）・：〜？！]+')


def strip(s):
    s = re.sub(r'\[\[[^|\]]+\|([^\]]+)\]\]', r'\1', str(s)); s = re.sub(r'\{\{g-[a-z0-9-]+\|([^{}|]+)\}\}', r'\1', s)
    s = s.replace('{H}', '').replace('<br>', ' ')
    s = re.sub(r'<a [^>]*href="([^"]*)"[^>]*>', r' ', s)
    s = re.sub(r'<sup>([^<]*)</sup>', r'^\1 ', s); s = re.sub(r'<sub>([^<]*)</sub>', r'_\1 ', s); s = re.sub(r'<[^>]+>', '', s)
    return s


def nums(v):
    """文字の中の数値（単位つき）を数える"""
    if isinstance(v, (list, tuple)):
        c = Counter()
        for x in v:
            c += nums(x)
        return c
    if isinstance(v, dict):
        return nums(list(v.values()))
    if v is None:
        return Counter()
    s = strip(v); s = re.sub(r'_[A-Za-z0-9,]+ ', ' ', s)      # 添字（R_o、k_m の o、m）は数値として数えない
    s = re.sub(r'(?<=[A-Za-zα-ω)）])[₀-₉]+', '', s)
    out = Counter(); i = 0
    for m in NUM.finditer(s):
        t = m.group(0).replace('−', '-').replace(',', '').replace(' ', '')
        if re.fullmatch(r'[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+', m.group(0)):
            # べき（m²、F⁴ など）は、直前の文字と合わせて単位・記号の一部
            if m.start() > 0 and re.match(r'[A-Za-zα-ωΩστλ)）]', s[m.start() - 1]):
                continue
        rest = s[m.end():m.end() + 8].lstrip(' ')
        u = next((x for x in UNITS if rest.startswith(x)), '')
        if u in ('m', 's', 'g', 'K', 'W') and re.match(r'[A-Za-z]', rest[len(u):len(u) + 1] or ' '):
            u = ''
        if s[m.end():m.end() + 1] == '/' and re.match(r'\d', s[m.end() + 1:m.end() + 2] or ' '):
            pass
        out[t + (' ' + u if u else '')] += 1
    return out


def eqkey(s):
    return re.sub(r'\s+', '', JP.sub('〓', strip(s)))


def diff(a, b):
    d = []
    for k in sorted(set(a) | set(b)):
        if a[k] != b[k]:
            d.append('%s（前 %d → 後 %d）' % (k, a[k], b[k]))
    return d


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    cur = {e['file']: e for e in json.load(open(GEN / 'dump.json', encoding='utf-8'))}
    files = sorted(cur) if '--all' in sys.argv else args
    if not files:
        raise SystemExit(__doc__)
    ap = Path(__file__).with_name('numdiff_allow.txt'); allow = []
    if ap.exists():
        for ln in ap.read_text(encoding='utf-8').splitlines():
            if ln.strip() and not ln.startswith('#'):
                p = [x.strip() for x in ln.split('|')]; allow.append(p)
    used = set(); total = 0
    for f in files:
        b = json.load(open(BASE / f.replace('.html', '.json'), encoding='utf-8')); c = cur[f]; bad = []; nf = 0; eqjp = 0

        def rep(st, field, msg):
            for k, a in enumerate(allow):
                if a[0] == f and a[1] == str(st) and a[2] == field:
                    used.add(k); return
            bad.append((st, field, msg))

        def same(st, field, x, y):
            nonlocal nf
            nf += 1
            if x != y:
                rep(st, field, 'そのまま同じでない：前 %s → 後 %s' % (json.dumps(x, ensure_ascii=False)[:90], json.dumps(y, ensure_ascii=False)[:90]))

        def numsame(st, field, x, y):
            nonlocal nf
            nf += 1
            d = diff(nums(x), nums(y))
            if d:
                rep(st, field, '数値が違う：' + '、'.join(d[:8]))
        same(0, 'ステップの数', len(b['steps']), len(c['steps'])); same(0, 'pre', [p if isinstance(p, str) else [p['no'], p['step']] for p in b['pre']], [p if isinstance(p, str) else [p['no'], p['step']] for p in c['pre']])
        numsame(0, 'title', b['title'], c['title']); numsame(0, 'pret', b.get('pret'), c.get('pret')); numsame(0, 'ct', b.get('ct'), c.get('ct'))
        for i, (s, t) in enumerate(zip(b['steps'], c['steps']), 1):
            for k in ('short', 'title', 'q', 'why', 'memo', 'do', 'solve', 'mission', 'hosoku', 'src', 'ctl', 'fixed', 'fixT', 'acts', 'plots', 'tiles', 'small', 'outv', 'seg', 'legend', 'pcfg', 'sheet'):
                numsame(i, k, s.get(k), t.get(k))
            same(i, 'ch の数', len(s.get('ch') or []), len(t.get('ch') or []))
            for j, (x, y) in enumerate(zip(s.get('ch') or [], t.get('ch') or [])):
                numsame(i, 'ch%d' % (j + 1), x, y)
            for k in ('ans', 'sol', 'solClicks', 'free', 'nR', 'msOk'):
                same(i, k, s.get(k), t.get(k))
            rs, rt_ = s.get('read') or {}, t.get('read') or {}
            same(i, 'read の欄', sorted(rs), sorted(rt_))
            for k in rs:
                if k == 'eq':
                    same(i, 'eq', eqkey(rs[k]), eqkey(rt_.get(k, '')))
                    if strip(rs[k]) != strip(rt_.get(k, '')) and eqkey(rs[k]) == eqkey(rt_.get(k, '')):
                        eqjp += 1
                else:
                    numsame(i, k, rs[k], rt_.get(k))
            same(i, 'ask の数', len(s.get('ask') or []), len(t.get('ask') or []))
            for j, (x, y) in enumerate(zip(s.get('ask') or [], t.get('ask') or []), 1):
                same(i, 'ask%d 答え・許容' % j, [x['ans'], x['tol'], x['tolType'], x['unit']], [y['ans'], y['tol'], y['tolType'], y['unit']])
                numsame(i, 'ask%d label' % j, x['label'], y['label']); numsame(i, 'ask%d hints' % j, x['hints'], y['hints'])
        same(len(b['steps']), '照合表の行の数', len(b['checks']), len(c['checks']))
        for j, (x, y) in enumerate(zip(b['checks'], c['checks'])):
            v = lambda r: [z for z in r if z in ('一致', '差あり', '不一致', '参考', '基準なし', '判定') or re.fullmatch(r'[✓✔△×—\-]?\s*(一致|差あり|不一致|参考|基準なし)', z)]
            same(len(b['steps']), '照合表 %d 行目の判定' % (j + 1), v(x), v(y)); numsame(len(b['steps']), '照合表 %d 行目' % (j + 1), x, y)
        total += len(bad)
        print('%s：比べた欄 %d、合わない所 %d%s' % (f, nf, len(bad), '（式の欄で、日本語の語だけが変わったもの %d）' % eqjp if eqjp else ''))
        for st, field, msg in bad:
            print('   ステップ %s｜%s｜%s' % (st or '—', field, msg))
    unused = [a for k, a in enumerate(allow) if k not in used and a[0] in files]
    print('除外の一覧（numdiff_allow.txt）：%d 行、使われたもの %d 行' % (len(allow), len(used)) + ('、使われなかったもの：%s' % unused if unused else ''))
    print('numdiff', '一致' if total == 0 else '合わない所 %d' % total)
    sys.exit(1 if total else 0)


if __name__ == '__main__':
    main()
