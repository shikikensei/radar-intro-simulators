from conf import DOCS, GEN, SHOTS, LAUNCH, URL
import re, os, json, sys
from playwright.sync_api import sync_playwright
out=str(DOCS); files=sorted(f for f in os.listdir(out) if re.match(r'\d\d_.*\.html$', f))
d=json.load(open(GEN/'dump.json',encoding='utf8'))
def nsteps(f):
    v=d.get(f) or {}
    return len(v.get('steps',[])) if isinstance(v,dict) else 0
bad=[]; n=0
with sync_playwright() as p:
    b=p.chromium.launch(**LAUNCH); pg=b.new_page()
    for f in files:
        if f=='00_index.html': continue
        pg.goto(URL+f); pg.wait_for_timeout(150)
        ns=pg.evaluate('STEPS.length'); hrefs=set()
        for i in range(ns):
            pg.evaluate(f'goStep({i})'); pg.wait_for_timeout(30)
            for h in pg.evaluate("Array.from(document.querySelectorAll('a[href]')).map(a=>a.getAttribute('href'))"): hrefs.add(h)
        for h in hrefs:
            m=re.match(r'([\w.]+\.html)(?:#s(\d+))?$', h)
            if not m: 
                if not h.startswith('#'): bad.append((f,h,'form'))
                continue
            n+=1
            if not os.path.exists(out+'/'+m.group(1)): bad.append((f,h,'missing')); continue
            if m.group(2):
                pg2=b.new_page(); pg2.goto(URL+h); pg2.wait_for_timeout(120)
                tot=pg2.evaluate('STEPS.length'); cur=pg2.evaluate("(document.body.innerText.match(/ステップ\\s*(\\d+)\\s*\\/\\s*(\\d+)/)||['',''])[1]")
                if int(m.group(2))>tot or str(cur)!=m.group(2): bad.append((f,h,'step',cur,tot))
                pg2.close()
    b.close()
print('links checked',n,'bad',bad)
