// 第15回の計算部分を node で確かめる：node tests/harness/t15.js（リポジトリのいちばん上で実行）
// (1) 第0回の prOf・sminOf・rmaxOf（c0_core.js）と、第15回の式1.3・式1.5 が同じ値を返すこと
// (2) ミッションの答え（いちばん小さい／大きい値）を、スライダーの刻みで探し直す
// (3) runChecks() に 'ng' がないこと
const fs = require('fs'), vm = require('vm');
const fx = 'function fx(v, d){ return v.toFixed(d); }\n';
function load(files){ const ctx = {console, Math}; vm.createContext(ctx); vm.runInContext(files.map(f => fs.readFileSync(f, 'utf8')).join('\n').replace(/^const /gm, 'var ') + '\n' + fx, ctx); return ctx; }
const c0 = load(['src/framework/c_util.js', 'src/episodes/c0_core.js']), c15 = load(['src/framework/c_util.js', 'src/episodes/c15_core.js']);
let bad = 0;
const r = c15.mulberry32(15);
for (let i = 0; i < 2000; i++){
  const pt = 1e5 + r() * 2e7, g = Math.pow(10, 1.5 + r() * 3), lam = 0.01 + r() * 0.5, rcs = Math.pow(10, -2 + r() * 4), R = 1e3 + r() * 5e5, B = 1e5 + r() * 1e7, Fn = 1 + r() * 9, snr = 2 + r() * 50;
  const ae = c0.aeOf(g, lam), sm0 = c0.sminOf(B, Fn, snr), sm15 = c15.sminOf(B, Fn, snr);
  const a = c0.prOf(pt, g, lam, rcs, R), b = c15.prOf(pt, g, ae, rcs, R), ra = c0.rmaxOf(pt, g, lam, rcs, sm0), rb = c15.rmax13(pt, g, ae, rcs, sm15);
  const tau = 1 / B, fp = 100 + r() * 5000, rc = c15.rmax15({pav: pt * fp * tau, g, ae, rcs, n: 1, ei: 1, F: 1, Fn, fp, snr1: snr, Ls: 1});
  if (Math.abs(a / b - 1) > 1e-12 || Math.abs(ra / rb - 1) > 1e-12 || Math.abs(ra / rc - 1) > 1e-12 || Math.abs(sm0 / sm15 - 1) > 1e-12){ bad++; if (bad < 5) console.log('mismatch', {pt, g, lam, R, a, b, ra, rb, rc}); }
}
console.log('第0回との比較：2000 通り、不一致', bad);
// ミッションの答え
const W = o => c15.rmaxOf(Object.assign({}, c15.DEFAULTS, o));
function search(k, vals, base, ok){ for (const v of vals) if (ok(W(Object.assign({}, base, {[k]: v})) / W(base))) return v; return null; }
const rng = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(Math.round(v * 1000) / 1000); return o; };
const ans = {
  1: search('pt', rng(0.5, 20, 0.5), {pt: 1}, x => x >= 2 - 1e-9),
  2: search('ae', rng(0.2, 10, 0.1), {ae: 1.6}, x => x >= 2 - 1e-9),
  3: search('fn', rng(0, 10, 0.5).reverse(), {fn: 8}, x => x >= 1.2),
  4: search('snr', rng(3, 20, 0.5).reverse(), {snr: 13}, x => x >= 0.9),
  5: search('n', rng(1, 64, 1), {n: 1, mode: 'nc'}, x => x >= 1.5),
  6: search('tau', rng(0.5, 8, 0.5), {tau: 1}, x => x >= 1.5),
  7: search('ls', rng(0, 20, 1).reverse(), {ls: 0}, x => x >= 0.5),
  8: search('ts', rng(1, 20, 0.5), {form: 'srch', ts: 4}, x => x >= 1.2)};
console.log('ミッションの答え', JSON.stringify(ans));
console.log('ステップ 9（有効開口面積 4 m²、そろえずに足す 10 個、損失 10 dB）', (W({ae: 4, mode: 'nc', n: 10, ls: 10}) / 1000).toFixed(1), 'km（はじめは', (W({mode: 'nc', n: 10, ls: 10}) / 1000).toFixed(1), 'km）');
const ch = c15.runChecks(); console.log('照合', ch.length, '行', ch.map(x => x.st).join(' '), ch.some(x => x.st === 'ng') ? '← ng あり' : '');
