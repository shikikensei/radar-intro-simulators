from conf import DOCS, GEN, SHOTS, LAUNCH, URL
import asyncio, sys, json
from playwright.async_api import async_playwright
import os
ALL=['00_basics.html','01_pulse_compression.html','02_mti.html','03_pulse_doppler.html','04_detection_cfar.html','05_tracking.html','06_amti.html','07_phased_array.html','08_monopulse.html','09_propagation.html','10_rcs.html','11_sar.html','12_eccm.html','13_scheduling.html','14_clutter_map.html','15_radar_equation.html','16_signal_chain.html','17_design_exercise.html','m01_detection.html']
FILES=[f for f in ALL if (DOCS/f).exists()]
JS = r"""
async () => {
  const out = {title: document.title, pre: PRE, steps: []};
  for (let i = 0; i < STEPS.length; i++){
    goStep(i); await new Promise(r => setTimeout(r, 60));
    const s = STEPS[i];
    const ctl = [...document.querySelectorAll('#ctls .ctl')].map(c => { const l = c.querySelector('label, .chk'); return l ? l.textContent.trim() : c.textContent.trim().slice(0, 30); });
    const fixed = [...document.querySelectorAll('#opCard .fixed span')].map(e => e.textContent.trim());
    const acts = [...document.querySelectorAll('#acts button')].map(e => e.textContent.trim());
    const nR = document.querySelectorAll('#ctls input[type=range]').length;
    out.steps.push({short: s.short, title: s.title, src: s.src, q: s.q, ch: s.ch, ans: s.ans, why: s.why, read: s.read, hosoku: s.hosoku || [], memo: s.memo, do: s.do || '',
      ask: (s.ask || []).map(a => ({label: a.label, unit: a.unit || '', ans: typeof a.ans === 'function' ? a.ans() : a.ans, tol: a.tol, tolType: a.tolType, hints: a.hints || []})), solve: s.solve || '', mission: s.mission ? s.mission.t : '', sol: s.solFn ? s.solFn() : (s.sol || null), solClicks: s.solClicks || null, free: !!s.free, ctl, fixed, acts, nR,
      readLen: document.querySelector('#read').textContent.length, plots: [...document.querySelectorAll('#plots .plot-t')].map(e => e.textContent.trim())});
  }
  goStep(STEPS.length - 1); await new Promise(r => setTimeout(r, 100));
  const tbs = document.querySelectorAll('#read table.t'), tb = tbs[tbs.length - 1];
  out.checks = tb ? [...tb.rows].map(r => [...r.cells].map(c => c.innerHTML.replace(/<br>\s*<small>/g, ' ／ ').replace(/<[^>]+>/g, '').trim())) : [];
  out.gloss = GLOSS; out.preq = PREQ; out.series = SERIES; out.no = SIM_NO; out.prelink = (typeof PREQLINK !== 'undefined') ? PREQLINK : null;
  return out;
}
"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(**LAUNCH)
        res=[]
        for f in FILES:
            pg=await (await b.new_context(viewport={'width':1366,'height':768})).new_page(); errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e)))
            await pg.goto(URL+f); await pg.wait_for_timeout(400)
            d=await pg.evaluate(JS); d['file']=f; d['errs']=errs; res.append(d)
            print(f, len(d['steps']), 'steps', len(d['checks']), 'check rows', errs)
        json.dump(res, open(GEN/'dump.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
        await b.close()
asyncio.run(main())
