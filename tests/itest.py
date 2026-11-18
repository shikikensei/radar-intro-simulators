from conf import DOCS, GEN, SHOTS, LAUNCH, URL
import asyncio, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(**LAUNCH)
        for (w,h,scheme,tag) in [(1366,768,'light','a'),(820,900,'light','n'),(1366,768,'dark','d'),(390,800,'light','m')]:
            ctx=await b.new_context(viewport={'width':w,'height':h},color_scheme=scheme); pg=await ctx.new_page(); errs=[]; ext=[]
            pg.on('pageerror',lambda e: errs.append(str(e)))
            pg.on('request',lambda r: ext.append(r.url) if not r.url.startswith('file:') else None)
            await pg.goto(URL+'00_index.html'); await pg.wait_for_timeout(300)
            hrefs=await pg.evaluate("[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))")
            bad=[x for x in hrefs if not (DOCS/x.split('#')[0]).exists()]
            ov=await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            await pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
            await pg.screenshot(path=str(SHOTS/f'00_{tag}.png'),full_page=True)
            await pg.click('#glTab'); vis=await pg.is_visible('#gloss'); n=await pg.evaluate("document.querySelectorAll('#gloss dt').length")
            await pg.fill('#glFind','CFAR'); nh=await pg.evaluate("[...document.querySelectorAll('#gloss dt')].filter(d=>!d.hidden).length")
            await pg.keyboard.press('Escape'); vis2=await pg.is_visible('#gloss')
            await pg.click('#themeBtn'); th=await pg.evaluate("document.documentElement.dataset.theme")
            print(tag,'links',len(hrefs),'bad',bad,'overflowX',ov,'gloss',vis,n,nh,vis2,'theme->',th,'errs',errs,'ext',ext)
            if tag=='a':
                # follow a deep link and the back link
                await pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
                await pg.click('a[href="03_pulse_doppler.html#s9"]'); await pg.wait_for_timeout(500)
                t=await pg.evaluate("document.querySelector('#read h2').textContent"); print('  deep link ->',pg.url.split('/')[-1],t[:40])
                await pg.click('header a.btn'); await pg.wait_for_timeout(300); print('  back ->',pg.url.split('/')[-1])
        await b.close()
asyncio.run(main())
