from conf import DOCS, GEN, SHOTS, LAUNCH, URL
import asyncio, sys, json
from playwright.async_api import async_playwright
async def main(f, w=1366, h=768, scheme='light', tag='a', shots=True):
    async with async_playwright() as p:
        b=await p.chromium.launch(**LAUNCH)
        ctx=await b.new_context(viewport={'width':w,'height':h},color_scheme=scheme); pg=await ctx.new_page(); errs=[]; reqs=[]
        pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        pg.on('request',lambda r: reqs.append(r.url) if not r.url.startswith('file:') else None)
        await pg.goto(URL+f); await pg.wait_for_timeout(300)
        n=await pg.evaluate('STEPS.length'); bad=[]
        for i in range(n):
            await pg.evaluate('goStep(%d)'%i); await pg.wait_for_timeout(120)
            r=await pg.evaluate('''async (i)=>{const st=STEPS[i],o={i:i+1,free:!st.q};
              o.locked0=document.querySelector('#opCard').classList.contains('locked');
              o.pre=st.mission?!!st.mission.ok(lastR):null;
              if(st.q){const bs=document.querySelectorAll('#choices button');bs[(st.ans+1)%bs.length].click();o.unlocked=!document.querySelector('#opCard').classList.contains('locked');}
              o.miss=[];
              const SOL=st.solFn?st.solFn():(st.sol||{});for(const k in SOL){const e=document.querySelector('#sim .ctl[data-k="'+k+'"]');if(!e){o.miss.push(k);continue;}const v=SOL[k];
                const rg=e.querySelector('input[type=range]'),sg=e.querySelector('.seg'),ck=e.querySelector('input[type=checkbox]');
                if(rg){if(v<Number(rg.min)||v>Number(rg.max))o.miss.push(k+' out of range');rg.value=v;rg.dispatchEvent(new Event('input'));}
                else if(sg){const bt=[...sg.children].find(x=>x.dataset.v===String(v));if(bt)bt.click();else o.miss.push(k+' no option');}
                else if(ck){if(ck.checked!==v)ck.click();}}
              for(const ci of (st.solClicks||[])){document.querySelectorAll('#acts button')[ci].click();}
              o.done=st.mission?document.querySelector('#msCard').classList.contains('done'):null;
              if(st.q){document.querySelector('#ansBtn').click();const t=document.querySelector('#ansBody');o.ans=!t.hidden&&t.textContent.includes(st.ch[st.ans].replace(/<[^>]*>/g,''));}
              const a=document.querySelector('#read a.term');if(a){a.click();o.hl=HLKEY||(document.querySelector('.flash')?'flash':null);o.hlok=!!(document.querySelector('.flash')||PLOTS.some(p=>p.cfg&&p.cfg.marks&&p.cfg.marks[HLKEY]));}
              const terms=[...document.querySelectorAll('#read a.term')].map(a=>a.dataset.hl);o.badterms=terms.filter(k=>!(k.startsWith('ctl:')?document.querySelector('#sim .ctl[data-k="'+k.slice(4)+'"]'):k.startsWith('tile:')?document.querySelectorAll('#tiles .tile')[Number(k.slice(5))]:PLOTS.some(p=>p.cfg&&p.cfg.marks&&p.cfg.marks[k])));
              o.rdlen=[...document.querySelectorAll('#read h3 ~ p, #read .mis')].map(e=>e.textContent).join('').length;
              o.ov=[];for(const e of document.querySelectorAll('.ctl,.tile,.card,.plot,#read,.ctl-h,header.top,.ch')){if(e.scrollWidth>e.clientWidth+1)o.ov.push((e.className||e.id)+':'+e.scrollWidth+'>'+e.clientWidth);}
              for(const q of document.querySelectorAll('.ctl-h output,.tile .v')){const r=q.getBoundingClientRect(),p=q.closest('.ctl,.tile').getBoundingClientRect();if(r.right>p.right+0.5)o.ov.push('out:'+q.textContent);}
              o.nan=[...document.querySelectorAll('.tile,.ctl output,.ctl small,#fixed')].filter(e=>/NaN|undefined|Infinity|null/.test(e.textContent)).map(e=>e.textContent.slice(0,60));
              o.docw=document.documentElement.scrollWidth;o.nctl=document.querySelectorAll('#sim .ctl input[type=range]').length;return o;}''',i)
            prob=[]
            if not r['free']:
                if not r['locked0']: prob.append('not locked initially')
                if not r['unlocked']: prob.append('not unlocked')
                if not r['ans']: prob.append('answer not shown')
            if r['pre']: prob.append('mission true at start')
            if r['done'] is False: prob.append('MISSION NOT DONE with sol')
            if r['miss']: prob.append('sol keys: %s'%r['miss'])
            if r.get('hlok') is False or r['badterms']: prob.append('term highlight: %s'%r['badterms'])
            if r['ov'] or r['nan'] or r['docw']>w: prob.append('layout %s %s %s'%(r['ov'],r['nan'],r['docw']))
            print(tag,'step',r['i'],'OK' if not prob else 'PROBLEM: '+'; '.join(prob),'| 読み物',r['rdlen'],'字 | スライダー',r['nctl'])
            if prob: bad.append(r['i'])
            if shots: await pg.wait_for_timeout(80); await pg.screenshot(path=str(SHOTS/('%s_%s_s%02d.png'%(f[:2],tag,i+1))),full_page=True)
        ms=await pg.evaluate("document.querySelector('#msbar b').textContent")
        await pg.click('#glBtn'); g1=await pg.evaluate("!document.querySelector('#gloss').hidden"); 
        if shots: await pg.screenshot(path=str(SHOTS/('%s_%s_gloss.png'%(f[:2],tag))))
        await pg.keyboard.press('Escape'); g2=await pg.evaluate("document.querySelector('#gloss').hidden")
        await pg.click('#themeBtn'); th=await pg.evaluate("document.documentElement.dataset.theme")
        print(tag,'missions',ms,'| glossary open/close',g1,g2,'| theme ->',th,'| errors',errs,'| external',reqs,'| problem steps',bad)
        await b.close()
a=sys.argv[1:]
asyncio.run(main(a[0], *( [int(a[1]),int(a[2]),a[3],a[4]] if len(a)>4 else [])))
