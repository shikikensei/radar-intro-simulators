from conf import DOCS, GEN, SHOTS, LAUNCH, URL
import re, os, json, sys
from playwright.sync_api import sync_playwright
out=str(DOCS); files=sorted(f for f in os.listdir(out) if re.match(r'(\d\d|m\d\d)_.*\.html$', f))
d=json.load(open(GEN/'dump.json',encoding='utf8'))
def nsteps(f):
    v=d.get(f) or {}
    return len(v.get('steps',[])) if isinstance(v,dict) else 0
bad=[]; n=0
gl=open(out+'/glossary.html',encoding='utf8').read() if os.path.exists(out+'/glossary.html') else ''
gids=set(re.findall(r'<article class="term" id="(g-[a-z0-9-]+)"',gl)); ng=0
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
            mg=re.match(r'glossary\.html(?:#(g-[a-z0-9-]+))?$', h)
            if mg:      # 用語集のページへのリンク：ID が用語集にあること
                ng+=1
                if not gl or (mg.group(1) and mg.group(1) not in gids): bad.append((f,h,'glossary id'))
                continue
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
    # 用語集のページの中のリンク（くわしく扱う回・ステップ、関係する用語）
    nw=0; steps={}
    for h in set(re.findall(r'<a href="([^"]+)"',re.sub(r'<script>.*?</script>','',gl,flags=re.S))):
        nw+=1
        if h.startswith('#'):
            if h[1:] not in gids: bad.append(('glossary.html',h,'id'))
            continue
        m=re.match(r'([\w.]+\.html)(?:#s(\d+))?$', h)
        if not m or not os.path.exists(out+'/'+m.group(1)): bad.append(('glossary.html',h,'missing')); continue
        if m.group(2):
            if m.group(1) not in steps: pg.goto(URL+m.group(1)); pg.wait_for_timeout(120); steps[m.group(1)]=pg.evaluate('STEPS.length')
            if int(m.group(2))>steps[m.group(1)]: bad.append(('glossary.html',h,'step'))
    # 本文のリンクの ID（a.gt の data-g）が、用語集にあること
    for f in files:
        for g in set(re.findall(r'data-g=(g-[a-z0-9-]+)',open(out+'/'+f,encoding='utf8').read())):
            if g not in gids: bad.append((f,g,'gt id'))
    b.close()
print('links checked',n,'glossary links',ng,'in glossary',nw,'bad',bad)
