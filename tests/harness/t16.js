// 第16回の計算部分を node で確かめる：node tests/harness/t16.js（リポジトリのいちばん上で実行）
// (1) 写した式が、元の回（第15回 c15_core.js、第4回 legacy/ccore.js、第5回 c5_core.js）と同じ値を返すこと
// (2) ミッションの答えを、スライダーの刻みで探し直す　(3) runChecks() に 'ng' がないこと
const fs = require('fs'), vm = require('vm');
function load(files){ const ctx = {console, Math, Map, Float64Array}; vm.createContext(ctx); vm.runInContext('function fx(v, d){ return v.toFixed(d); }\n' + files.map(f => fs.readFileSync(f, 'utf8')).join('\n').replace(/^const /gm, 'var '), ctx); return ctx; }
const U = 'src/framework/c_util.js', c16 = load([U, 'src/episodes/c16_core.js']), c15 = load([U, 'src/episodes/c15_core.js']), c4 = load(['src/episodes/legacy/ccore.js']), c5 = load([U, 'src/episodes/c5_core.js']);
let bad = 0; const r = c16.mulberry32(16);
for (let i = 0; i < 2000; i++){
  const pt = 1e3 + r() * 1e7, g = Math.pow(10, 1.5 + r() * 3), ae = 0.1 + r() * 10, rcs = Math.pow(10, -2 + r() * 4), R = 1e3 + r() * 5e5;
  const p = {pav: 10 + r() * 1e4, g, ae, rcs, n: 1 + Math.floor(r() * 60), ei: 0.2 + 0.8 * r(), F: 0.5 + r(), Fn: 1 + r() * 9, fp: 100 + r() * 5000, snr1: 2 + r() * 50, Ls: 1 + r() * 30};
  const s = Math.pow(10, -1 + r() * 2.6), T = 3 + r() * 25, pd = 0.01 + 0.98 * r(), M = 1 + Math.floor(r() * 4), N = M + Math.floor(r() * 4);
  if (Math.abs(c16.prOf(pt, g, ae, rcs, R) / c15.prOf(pt, g, ae, rcs, R) - 1) > 1e-12 || Math.abs(c16.rmax15(p) / c15.rmax15(p) - 1) > 1e-12 || Math.abs(c16.pdNF(1, s, T) - c4.pdNF(1, s, T)) > 1e-12 || Math.abs(c16.pMofN(M, N, pd) - c5.pMofN(M, N, pd)) > 1e-12) bad++;
}
console.log('元の回との比較（第15回 prOf・rmax15、第4回 pdNF、第5回 pMofN）：2000 通り、不一致', bad);
{ const T = 6 * Math.LN10; let lo = 0, hi = 30; for (let i = 0; i < 50; i++){ const m = (lo + hi) / 2; if (c4.pdNF(1, Math.pow(10, m / 10), T) < 0.9) lo = m; else hi = m; } console.log('検出に要る S/N（Pd 0.9、Pfa 1e-6）：第4回の式', lo.toFixed(3), 'dB、第16回', c16.reqSnr(6).toFixed(3), 'dB、第15回の近似式', c15.albersheim(0.9, 1e-6, 1).toFixed(3), 'dB'); }
const W = o => Object.assign({}, c16.DEFAULTS, o), ch = o => c16.chain(W(o)), rng = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(Math.round(v * 1000) / 1000); return o; };
const first = (vals, ok) => { for (const v of vals) if (ok(v)) return v; return null; };
const trk = c16.trackSim(W({}));
const ans = {
  1: first(rng(30, 145, 5).reverse(), R => ch({R}).in_ >= 0),
  2: first(rng(30, 145, 5), R => Math.abs(ch({R}).delay - 0.5e-3) < 1e-9),
  3: first(rng(0, 10, 0.5).reverse(), fn => ch({fn}).in_ >= -10),
  4: c16.TBS[first(rng(0, 7, 1), tbi => ch({tbi}).afterMf >= 10)],
  5: first(rng(0, 50, 1), v => ch({v}).cl <= 3),
  6: first(rng(3, 12, 0.5), x => ch({x}).fa <= 1),
  7: first(rng(30, 145, 5).reverse(), R => c16.measErr(W({R})).sR <= 8),
  8: first(rng(1, 12, 1), k => trk.st[k - 1].conf && Math.abs(trk.st[k - 1].vEst - 20) <= 1),
  9: first(rng(30, 145, 5).reverse(), R => ch({R, rcs: 0.1}).pd >= 0.9)};
console.log('ミッションの答え', JSON.stringify(ans));
const c = ch({}); console.log('標準の場面の家計簿 [dB]：入り口', c.in_.toFixed(2), '整合フィルタ +' + c.mf.toFixed(2), '積分 +' + c.integ.toFixed(2), '重み −' + c.lw.toFixed(2), 'クラッタ −' + c.cl.toFixed(2), '処理後', c.out.toFixed(2), '要る S/N', c.req.toFixed(2));
const k = c16.runChecks(); console.log('照合', k.length, '行', k.map(x => x.st).join(' '), k.some(x => x.st === 'ng') ? '← ng あり' : '');
