"""用語集の仕組みのテスト（本文のリンク、その場の説明、右端のパネル、用語集のページ）。
使い方：python tests/gtest.py [回の HTML ...]（省略すると、本文に用語のリンクがある回すべて）
3 通りの画面（1366 幅、820 幅、ダーク）で確かめ、スクリーンショットを tests/_shots/gl_*.png に置く。"""
from conf import DOCS, SHOTS, LAUNCH, URL
import asyncio, sys, re
from playwright.async_api import async_playwright
files = sys.argv[1:] or sorted(f.name for f in DOCS.glob('*.html') if 'class=gt' in f.read_text(encoding='utf-8') and re.match(r'(\d\d|m\d\d)_', f.name) and f.name != '00_index.html')
gids = set(re.findall(r'<article class="term" id="(g-[a-z0-9-]+)"', (DOCS / 'glossary.html').read_text(encoding='utf-8')))
async def main():
    bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        for (w, h, scheme, tag) in [(1366, 768, 'light', 'a'), (820, 900, 'light', 'n'), (1366, 768, 'dark', 'd')]:
            ctx = await b.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme); pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            for f in files:
                await pg.goto(URL + f); await pg.wait_for_timeout(250)
                n = await pg.evaluate('STEPS.length'); nl = 0
                for i in range(n):
                    await pg.evaluate('goStep(%d)' % i); await pg.wait_for_timeout(60)
                    r = await pg.evaluate('''async () => { const o = {n: 0, bad: []}, as = [...document.querySelectorAll('a.gt')].filter(a => a.offsetParent !== null);
                      const seen = {};
                      for (const a of as){ o.n++; const id = a.dataset.g; seen[id] = (seen[id] || 0) + 1;
                        if (!GLOSS.some(t => t[3] === id)){ o.bad.push('用語がない ' + id); continue; }
                        a.click(); const pop = document.querySelector('.gpop');
                        if (!pop){ o.bad.push('説明が出ない ' + id); continue; }
                        const r = pop.getBoundingClientRect();
                        if (r.left < 0 || r.right > document.documentElement.clientWidth + 0.5 || r.width < 120) o.bad.push('説明が画面の外 ' + id + ' ' + Math.round(r.left) + '–' + Math.round(r.right));
                        if (a.getAttribute('aria-expanded') !== 'true') o.bad.push('aria-expanded ' + id);
                        if (!pop.querySelector('a[href="glossary.html#' + id + '"]')) o.bad.push('用語集へのリンクがない ' + id);
                        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
                        if (document.querySelector('.gpop')) o.bad.push('Esc で閉じない ' + id); }
                      o.dup = Object.keys(seen).filter(k => seen[k] > 1); o.ids = Object.keys(seen); o.docw = document.documentElement.scrollWidth; return o; }''')
                    nl += r['n']
                    for x in r['bad']: bad.append((tag, f, i + 1, x))
                    for x in r['ids']:
                        if x not in gids: bad.append((tag, f, i + 1, '用語集のページに ID がない ' + x))
                    if r['docw'] > w: bad.append((tag, f, i + 1, '横にはみ出す %d' % r['docw']))
                # キーボードで開閉、パネルで開く（最初のステップ）
                await pg.evaluate('goStep(0)'); await pg.wait_for_timeout(80)
                a = pg.locator('#read a.gt').first
                if await a.count():
                    await a.focus(); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(60)
                    vis = await pg.evaluate("!!document.querySelector('.gpop') && document.activeElement === document.querySelector('.gpop')")
                    await pg.screenshot(path=str(SHOTS / ('gl_%s_%s_pop.png' % (f.split('_')[0], tag))))
                    await pg.keyboard.press('Escape'); back = await pg.evaluate("!document.querySelector('.gpop') && document.activeElement.classList.contains('gt')")
                    await pg.keyboard.press(' '); await pg.wait_for_timeout(40); gid = await a.get_attribute('data-g')
                    await pg.click('.gpop [data-act=panel]'); await pg.wait_for_timeout(120)
                    pan = await pg.evaluate("(id) => { const g = document.querySelector('#gloss'), d = document.getElementById(id); if (g.hidden || !d || !d.classList.contains('hit')) return false; const r = d.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }", gid)
                    await pg.screenshot(path=str(SHOTS / ('gl_%s_%s_panel.png' % (f.split('_')[0], tag))))
                    if not (vis and back and pan): bad.append((tag, f, 1, 'キーボード／パネル %s %s %s' % (vis, back, pan)))
                print(tag, f, 'リンク', nl)
            # 用語集のページ
            await pg.goto(URL + 'glossary.html#g-snr'); await pg.wait_for_timeout(300)
            g = await pg.evaluate('''() => { const o = {}; const a = document.getElementById('g-snr'), r = a.getBoundingClientRect();
              o.hit = a.classList.contains('hit') && r.top >= 0 && r.bottom <= innerHeight; o.n = document.querySelectorAll('article.term').length;
              o.kana = [...document.querySelectorAll('section.grp > h2')].map(h => h.textContent).join(' '); return o; }''')
            await pg.screenshot(path=str(SHOTS / ('gl_page_%s_hash.png' % tag)))
            await pg.click('.seg button[data-v=ep]'); eps = await pg.evaluate("[...document.querySelectorAll('section.grp > h2')].length")
            await pg.fill('#q', 'ならす'); nq = await pg.evaluate("[...document.querySelectorAll('article.term')].filter(a => !a.hidden).length")
            await pg.fill('#q', ''); await pg.click('.seg button[data-l=中級]'); nm = await pg.evaluate("[...document.querySelectorAll('article.term')].filter(a => !a.hidden).length")
            await pg.evaluate("location.hash = '#g-radar-equation'"); await pg.wait_for_timeout(150)
            h2 = await pg.evaluate("(() => { const a = document.getElementById('g-radar-equation'); return !a.hidden && a.classList.contains('hit'); })()")
            ov = await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            hrefs = await pg.evaluate("[...document.querySelectorAll('article.term a[href]')].map(a => a.getAttribute('href'))")
            bl = [x for x in hrefs if not (x.startswith('#') and x[1:] in gids) and not (DOCS / x.split('#')[0]).exists()]
            await pg.click('.seg button[data-v=kana]'); await pg.click('.seg button[data-l=""]'); await pg.evaluate('window.scrollTo(0, 0)'); await pg.screenshot(path=str(SHOTS / ('gl_page_%s_top.png' % tag)))
            print(tag, 'glossary.html 用語', g['n'], '| # で開く', g['hit'], h2, '| 五十音の見出し', g['kana'], '| 回ごとの見出し', eps, '| 「ならす」で検索', nq, '語 | 中級', nm, '語 | はみ出し', ov, '| 切れたリンク', bl, '| errors', errs)
            if not (g['hit'] and h2) or ov > 0 or bl or errs or nq < 1: bad.append((tag, 'glossary.html', 0, 'ページ'))
        await b.close()
    print('gtest', '合格' if not bad else 'NG %s' % bad)
    sys.exit(1 if bad else 0)
asyncio.run(main())
