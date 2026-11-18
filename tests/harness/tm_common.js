// 中級 第2回以降の計算部分を node で確かめる：node tests/harness/tm_common.js [回の番号 …]（省略すると、ある回を全部）
// (1) cm_common.js の値が、中級 第1回（cm01_core.js）と同じであること　(2) 各回の runChecks() に 'ng' がないこと
const fs = require('fs'), vm = require('vm');
function load(files){ const ctx = {console, Math, Map, Float64Array}; vm.createContext(ctx); vm.runInContext('function fx(v, d){ return v.toFixed(d); }\n' + files.map(f => fs.readFileSync(f, 'utf8')).join('\n').replace(/^const /gm, 'var '), ctx); return ctx; }
const U = 'src/framework/c_util.js', CM = 'src/episodes/cm_common.js', m1 = load([U, 'src/episodes/cm01_core.js']), cm = load([U, CM]), Z = m1.std();
const d = [cm.M1.s0 - Z.s0, cm.M1.s1 - Z.s1, cm.M1.ro / Z.ro - 1, cm.M1.r0 / Z.r0 - 1, cm.M1.r1 / Z.r1 - 1, cm.EXR.lt - Z.lt.tot].map(Math.abs);
let bad = 0; const r = cm.mulberry32(7); for (let i = 0; i < 500; i++){ const pd = 0.05 + 0.94 * r(), pfa = Math.pow(10, -3 - 6 * r()), N = 1 + Math.floor(r() * 16), ne = [1, N, 2, 2 * N][Math.floor(r() * 4)], s = Math.pow(10, -1 + 3 * r()); if (Math.abs(cm.snr423(pd, pfa, N) - m1.snr423(pd, pfa, N)) > 1e-12 || Math.abs(cm.snr425(pd, pfa, N, ne) / m1.snr425(pd, pfa, N, ne) - 1) > 1e-9 || Math.abs(cm.pd424(s, pfa, N, ne) - m1.pd424(s, pfa, N, ne)) > 1e-9 || Math.abs(cm.pd422(s, pfa, N) - m1.pd422(s, pfa, N)) > 1e-12) bad++; }
console.log('cm_common と 中級 第1回：標準の値の差の最大', Math.max(...d).toExponential(1), '（必要 S/N ' + cm.M1.s0.toFixed(3) + '／' + cm.M1.s1.toFixed(3) + ' dB、R_o ' + (cm.M1.ro / 1000).toFixed(2) + ' km）。式4.22〜4.25 を 500 通りで比べて、不一致', bad);
const want = process.argv.slice(2).map(Number), all = [2, 3, 4, 5, 6, 7, 8].filter(n => fs.existsSync('src/episodes/cm0' + n + '_core.js') && (!want.length || want.includes(n)));
for (const n of all){ const c = load([U, CM, 'src/episodes/cm0' + n + '_core.js']), k = c.runChecks(); console.log('中級 第' + n + '回：照合', k.length, '行', k.map(x => x.st).join(' '), k.some(x => x.st === 'ng') ? '← ng あり' : ''); }
