const fs=require('fs'); global.fx=(v,d)=>Number(v).toFixed(d);
const src=['c_util.js','c13_core.js'].map(f=>fs.readFileSync(require('path').join(__dirname,'..','..','src',f==='c_util.js'?'framework':'episodes',f),'utf8')).join('\n');
(0,eval)(src.replace(/^const /gm,'var ').replace(/^let /gm,'var '));
const f=s=>'occ '+(s.occ*100).toFixed(1)+' wst '+(s.wasted*100).toFixed(1)+' H '+s.ratio.H.toFixed(2)+' V '+s.ratio.V.toFixed(2)+' C '+(isFinite(s.ratio.C)?s.ratio.C.toFixed(2):'inf')+' drop '+s.drop.A+'/'+s.drop.B+' jit '+s.jit.toFixed(1)+' dev '+s.dev.toFixed(1);
let t0=Date.now();
for(let n=0;n<=96;n+=4){ const d=runBoth(n,20), v1=verify(d.leg,d.W,20,true), v2=verify(d.neu,d.W,20); console.log(n,'dem',(demand(n)*100).toFixed(1),'| LEG',f(d.sl),'| NEW',f(d.sn),'| ver',v1.ov+v1.out,v2.ov+v2.out); }
console.log('ms',Date.now()-t0);
console.log('--- slack scan n=40'); for(let sl=0;sl<=30;sl+=2){const d=runBoth(40,sl); console.log(sl,'NEW',f(d.sn));}
console.log('--- na scan n=24'); for(let na=0;na<=10;na++){const d=runBoth(24,20,na); console.log(na,(demand(24,na)*100).toFixed(1),'LEG',f(d.sl),'| NEW',f(d.sn));}
const F=flowSim(); console.log(JSON.stringify(F.plans), F.wait4, F.t4, F.t3, F.rq.length, F.ev.length);
for(const r of runChecks())console.log(r.st,'|',r.item.slice(0,28),'|',r.calc.slice(0,150));
