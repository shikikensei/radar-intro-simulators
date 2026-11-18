const fs=require('fs'); global.fx=(v,d)=>Number(v).toFixed(d);
const src=['c_util.js','c14_core.js'].map(f=>fs.readFileSync(require('path').join(__dirname,'..','..','src',f==='c_util.js'?'framework':'episodes',f),'utf8')).join('\n');
(0,eval)(src.replace(/^const /gm,'var ').replace(/^let /gm,'var '));
let t0=Date.now(); for(const r of runChecks())console.log(r.st,'|',r.item.slice(0,34),'|',r.calc.slice(0,150)); console.log('ms',Date.now()-t0);
console.log('fixed'); for(const t of [10,15,20,25,30,33,34,35,38]){const f=fixedStats(t); console.log(t,f.fa.toFixed(3),f.pdA.toFixed(3),f.pdB.toFixed(3));} const m=mapStats(); console.log('map',m.k.toFixed(2),m.fa,m.pdA.toFixed(3),m.pdB.toFixed(3));
console.log('k vs pfa a=.125'); for(let kd=8;kd<=14;kd+=0.25){const k=Math.pow(10,kd/10); console.log(kd, pfaOf(k,.125,1).toExponential(2), Math.exp(-k).toExponential(2));}
console.log('loss x=5'); for(let p=0;p<=6;p++){const a=alphaOf(p); console.log(p,a,leff(a),lossDb(5,a,1).toFixed(2),lossDb(5,a,4).toFixed(2), 'settle',settle(a), 'tr10', transient(a,4,20,1e-6,10)[9].toExponential(1), 'tr10 n1 x5', transient(a,1,20,1e-5,10)[9].toExponential(1));}
console.log('vel'); for(let v=0;v<=400;v+=25) console.log(v, cellsPerScan(v).toFixed(2), velResp(v).toFixed(3)); console.log('vcut',vCut());
console.log('mtd'); for(let c=0;c<=60;c+=1){const q=mtdOf(c); if(c%5===0||(c>=9&&c<=13)||(c>=49&&c<=53))console.log(c,q.pz.toFixed(3),q.pm.toFixed(3));}
console.log('ms',Date.now()-t0);
console.log('free'); for (const n of [1,4]) for (const x of [4,5,6,7]) for (const p of [2,3,4]){ const a=alphaOf(p); console.log('n',n,'x',x,'p',p,'loss',lossDb(x,a,n).toFixed(2),'p10',transient(a,n,20,Math.pow(10,-x),10)[9].toExponential(1)); }
console.log('ppi fixed'); for(const t of [6,10,12,20,26,30,32,33,34,35,36,37,38,40]){const f=fixedStats(t); console.log(t,f.fa.toFixed(3),f.pdA.toFixed(3),f.pdB.toFixed(3), ppiCross(t).x.length);} const mm=mapStats(); console.log('map',mm.k.toFixed(2),mm.fa,mm.pdA.toFixed(3),mm.pdB.toFixed(3));
