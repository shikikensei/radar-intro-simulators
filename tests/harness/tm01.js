// 中級 第1回の計算部分を node で確かめる：node tests/harness/tm01.js（リポジトリのいちばん上で実行。1 分ほどかかる）
// (1) 写した式が、入門の回（第15回 rmax15、第4回 pdNF）と同じ値を返すこと
// (2) 各ステップの答え（手計算の値）　(3) 近似式（式4.22〜4.25）と厳密な計算の差を、広い範囲で調べる　(4) runChecks() に 'ng' がないこと
const fs = require('fs'), vm = require('vm');
function load(files){ const ctx = {console, Math, Map, Float64Array}; vm.createContext(ctx); vm.runInContext('function fx(v, d){ return v.toFixed(d); }\n' + files.map(f => fs.readFileSync(f, 'utf8')).join('\n').replace(/^const /gm, 'var '), ctx); return ctx; }
const U = 'src/framework/c_util.js', m = load([U, 'src/episodes/cm01_core.js']), c15 = load([U, 'src/episodes/c15_core.js']), c4 = load(['src/episodes/legacy/ccore.js']);
let bad = 0; const r = m.mulberry32(101);
for (let i = 0; i < 2000; i++){
  const p = {pav: 10 + r() * 1e4, g: Math.pow(10, 1.5 + r() * 3), ae: 0.1 + r() * 20, rcs: Math.pow(10, -2 + r() * 4), n: 1 + Math.floor(r() * 60), ei: 0.2 + 0.8 * r(), F: 0.5 + r(), Fn: 1 + r() * 9, fp: 100 + r() * 5000, snr1: 2 + r() * 50, Ls: 1 + r() * 30};
  const n = 1 + Math.floor(r() * 16), s = Math.pow(10, -1 + r() * 2.6), T = n + r() * 30;
  if (Math.abs(m.rmax15(p) / c15.rmax15(p) - 1) > 1e-12 || Math.abs(m.pdNF(n, s, T) - c4.pdNF(n, s, T)) > 1e-9) bad++;
}
console.log('入門の回との比較（第15回 rmax15、第4回 pdNF）：2000 通り、不一致', bad);
{ let mx = 0; for (const pd of [0.1, 0.5, 0.9, 0.99]) for (const x of [4, 6, 8]) for (const N of [2, 4, 16, 32]){ const pfa = Math.pow(10, -x), s = Math.pow(10, m.snrExact(pd, pfa, N, 1) / 10); mx = Math.max(mx, Math.abs(m.pdSw1(s, pfa, N) - m.pdExact(s, pfa, N, 1))); } console.log('Swerling 1 の厳密な計算：数値的な平均と、閉じた式の差の最大', mx.toExponential(1)); }
const Z = m.std();
console.log('各ステップの答え：1) T_FR', Z.tfr.toFixed(3), '秒、P_FA', Z.pfa.toExponential(3), '2) η', m.etaOf(0.9, 1e-6).toFixed(4), 'S/N', Z.s0.toFixed(3), 'dB 3)', Z.s1.toFixed(3), 'dB、損失', Z.fl.toFixed(3), 'dB 4)', Z.s4.toFixed(3), 'dB、損失', Z.il.toFixed(3), 'dB 5)', Z.pdw.toFixed(4), (Z.pfw * 1e6).toFixed(4) + 'e-6 6)', m.db10(m.eclApprox(10)).toFixed(3), 'dB、', Z.lt.tot.toFixed(3), 'dB、', (Z.r0 / 1000).toFixed(2), 'km 7)', Z.c5.toFixed(4), Z.c3.toFixed(4), '8)', Z.ps[2].toFixed(4), Z.cum[2].toFixed(4));
console.log('R_o（損失なし）', (Z.ro0 / 1000).toFixed(2), 'km、R_o', (Z.ro / 1000).toFixed(2), 'km、Swerling 1 の探知距離', (Z.r1 / 1000).toFixed(2), 'km、累積 0.9 の距離（フレーム 4 秒、600 m/s）', (m.rCum(Z.ro, 1e-6, 1, 1, 2400, 0.9) / 1000).toFixed(1), 'km');
console.log('ステップ 9 のミッション：Swerling 1、N_pdi = 1／2／4 の探知距離', [1, 2, 4].map(n => (m.calc(m.with_({sw: 1, npdi: n})).r1 / 1000).toFixed(1)).join('／'), 'km');
const names = ['ゆらがない', 'Swerling 1', 'Swerling 2', 'Swerling 3', 'Swerling 4'];
console.log('近似式（式4.23・4.25）− 厳密な計算 [dB]。P_d 0.1〜0.99、P_FA 1e-4〜1e-8、N_pdi 1〜32（7 × 5 × 6 = 210 通り）');
for (const sw of [0, 1, 2, 3, 4]){ let mx = -9, mn = 9, m9x = -9, m9n = 9, ax = '', an = '';
  for (const pd of [0.1, 0.3, 0.5, 0.7, 0.9, 0.95, 0.99]) for (const x of [4, 5, 6, 7, 8]) for (const N of [1, 2, 4, 8, 16, 32]){ const pfa = Math.pow(10, -x), d = m.db10(m.snrApprox(pd, pfa, N, sw)) - m.snrExact(pd, pfa, N, sw); if (d > mx){ mx = d; ax = [pd, '1e-' + x, N].join('/'); } if (d < mn){ mn = d; an = [pd, '1e-' + x, N].join('/'); } if (pd >= 0.5 && pd <= 0.9){ m9x = Math.max(m9x, d); m9n = Math.min(m9n, d); } }
  console.log(' ', names[sw], '全体', mn.toFixed(2), '（' + an + '）〜', '+' + mx.toFixed(2), '（' + ax + '）。P_d 0.5〜0.9 では', m9n.toFixed(2), '〜 +' + m9x.toFixed(2)); }
console.log('P_d の式（式4.22・4.24）− 厳密な計算。P_FA 1e-4・1e-6・1e-8、N_pdi 1・4・16・32、S/N −10〜30 dB');
for (const sw of [0, 1, 2, 3, 4]){ let mx = 0, mp = 0; for (const x of [4, 6, 8]) for (const N of [1, 4, 16, 32]) for (let s = -10; s <= 30; s += 0.5){ const pfa = Math.pow(10, -x), e = m.pdExact(Math.pow(10, s / 10), pfa, N, sw), d = m.pdApprox(Math.pow(10, s / 10), pfa, N, sw) - e; if (Math.abs(d) > Math.abs(mx)) mx = d; if (sw === 0){ const dp = m.pd422print(Math.pow(10, s / 10), pfa, N) - e; if (Math.abs(dp) > Math.abs(mp)) mp = dp; } } console.log(' ', names[sw], '差の最大', mx.toFixed(3), sw === 0 ? '（式4.22 を原本の印刷どおり −1/2 で計算すると ' + mp.toFixed(3) + '）' : ''); }
const k = m.runChecks(); console.log('照合', k.length, '行', k.map(x => x.st).join(' '), k.some(x => x.st === 'ng') ? '← ng あり' : '');
