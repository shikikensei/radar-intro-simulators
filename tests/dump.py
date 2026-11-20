from conf import DOCS, GEN, SHOTS, LAUNCH, URL
import asyncio, sys, json
from playwright.async_api import async_playwright
import os
ALL=['00_basics.html','01_pulse_compression.html','02_mti.html','03_pulse_doppler.html','04_detection_cfar.html','05_tracking.html','06_amti.html','07_phased_array.html','08_monopulse.html','09_propagation.html','10_rcs.html','11_sar.html','12_eccm.html','13_scheduling.html','14_clutter_map.html','15_radar_equation.html','16_signal_chain.html','17_design_exercise.html']+['m%02d_%s'%(n,s) for n,s in [(1,'detection.html'),(2,'clutter_performance.html'),(3,'waveform_ambiguity.html'),(4,'measurement_accuracy.html'),(5,'array_practice.html'),(6,'propagation_coverage.html'),(7,'resource_budget.html'),(8,'performance_report.html')]]
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
      readLen: document.querySelector('#read').textContent.length, plots: [...document.querySelectorAll('#plots .plot-t')].map(e => e.textContent.trim()),
      // 画面に出る、そのほかの文字（文章の検査 jlint.py と、数値の検査 numdiff.py が使う）
      tiles: [...document.querySelectorAll('#tiles .tile')].map(e => [...e.children].map(c => c.textContent.trim())),
      small: [...document.querySelectorAll('#ctls .ctl small')].map(e => e.textContent.trim()).filter(Boolean),
      outv: [...document.querySelectorAll('#ctls .ctl output')].map(e => e.textContent.trim()),
      seg: [...document.querySelectorAll('#ctls .seg button')].map(e => e.textContent.trim()),
      legend: [...document.querySelectorAll('#plots .plot-lg span')].map(e => e.textContent.trim()),
      pcfg: (() => { const o = [], seen = new Set(), walk = (v, d) => { if (typeof v === 'string'){ if (/[ぁ-んァ-ヶ一-龥]/.test(v) && !seen.has(v)){ seen.add(v); o.push(v); } } else if (v && typeof v === 'object' && d < 5 && !ArrayBuffer.isView(v)){ if (Array.isArray(v) && v.length > 60) return; for (const k in v) walk(v[k], d + 1); } }; for (const p of PLOTS) walk(p.cfg, 0); return o; })(),
      sheet: (s.sheet || (typeof SHEET === 'function' ? SHEET : null)) ? (s.sheet || SHEET)(lastR).map(r => r.head ? [r.head] : [r.k, r.f || '', String(r.v), r.u || '']) : [],
      msOk: s.mission ? String(s.mission.ok) : '', fixT: s.fixT || [], uiq: [...document.querySelectorAll('#sim .hint, #sim .lockmsg, #sim .lbl, #read h3, #read .pre > b, #read .nextsim, #read details.memo summary')].map(e => e.textContent.trim())});
  }
  goStep(STEPS.length - 1); await new Promise(r => setTimeout(r, 100));
  const tbs = document.querySelectorAll('#read table.t'), tb = tbs[tbs.length - 1];
  out.checks = tb ? [...tb.rows].map(r => [...r.cells].map(c => c.innerHTML.replace(/<br>\s*<small>/g, ' ／ ').replace(/<[^>]+>/g, '').trim())) : [];
  out.ct = Object.keys(CT).map(k => [k, CT[k].l, (CT[k].seg || []).map(o => o[1])]); out.pret = PRE.filter(p => typeof p !== 'string').map(p => p.t); out.gloss = GLOSS; out.preq = PREQ; out.series = SERIES; out.no = SIM_NO; out.prelink = (typeof PREQLINK !== 'undefined') ? PREQLINK : null;
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
