// 中級 第8回の計算部分（cm08_core.js）が、第2〜7回の計算部分と同じ値になることを確かめる：node tests/harness/tm08.js
const fs = require('fs'), vm = require('vm');
function load(files){ const ctx = {console, Math, Map, Float64Array}; vm.createContext(ctx); vm.runInContext('function fx(v, d){ return v.toFixed(d); }\n' + files.map(f => fs.readFileSync(f, 'utf8')).join('\n').replace(/^const /gm, 'var '), ctx); return ctx; }
const U = 'src/framework/c_util.js', CM = 'src/episodes/cm_common.js', L = n => load([U, CM, 'src/episodes/cm0' + n + '_core.js']);
const m2 = L(2), m4 = L(4), m5 = L(5), m6 = L(6), m7 = L(7), m8 = L(8);
let worst = 0, n = 0; const cmp = (a, b, t) => { if (process.env.DBG && Math.abs(a - b) / Math.max(1e-12, Math.abs(b)) > 1e-9) console.log(t, a, b); worst = Math.max(worst, Math.abs(a - b) / Math.max(1e-12, Math.abs(b))); n++; };
for (let R = 30; R <= 120; R += 5){
  const c2 = m2.calc(Object.assign({}, m2.DEFAULTS, {R})); cmp(m8.csOf(R), c2.cs, 'cs'); cmp(m8.csOf(R) + m2.CL.voc, c2.ireq); cmp(m8.snrFree(R), c2.snr);
  cmp(m8.angErr(m8.snrFree(R)), m4.thermal910(4.5 * Math.PI / 180, 1.6, m4.snrAt(R), 2));
  cmp(m8.rainDb(25.4, R), 2 * m6.rainAtt(4, 25.4) * R); cmp(m8.rainDb(10, R), 2 * m6.rainAtt(4, 10) * R);
}
for (let th = 0; th <= 60; th += 5) cmp(Math.pow(10, -m8.scanDb(th) / 20), m5.scanLoss(th), 'scan');
for (let ha = 10; ha <= 40; ha += 5) for (let ht = 20; ht <= 1000; ht += 70) cmp(m8.losKm(ha, ht), m6.los(ha, ht, m6.kOf(-39)), 'los');
for (let ns = 8; ns <= 32; ns += 4) for (let k = 0; k <= 90; k += 15){ const a = m8.calc(Object.assign({}, m8.DEFAULTS, {ns, n: k})), b = m7.calc(Object.assign({}, m7.DEFAULTS, {ns, n: k})); cmp(a.dem, b.dem, 'dem'); cmp(a.lw, b.lw, 'lw'); }
cmp(m8.vBlind(), m2.vBlind(0.1, 1000), 'vb');
for (let v = 501; v < 700; v += 7) cmp(Math.pow(2 * Math.sin(Math.PI * v / 50), 4), m2.mtiResp(v / 50, 3), 'mti');
const ng = m8.runChecks().filter(r => r.st === 'ng').length;
console.log('中級 第8回と、第2・4・5・6・7回の計算部分：' + n + ' 通りを比べて、相対差の最大 ' + worst.toExponential(1) + '、照合の不一致 ' + ng);
if (worst > 1e-9 || ng) process.exit(1);
