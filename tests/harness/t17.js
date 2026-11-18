// 第17回の計算部分を node で確かめる：node tests/harness/t17.js（リポジトリのいちばん上で実行）
// (1) 写した式が、元の回（第15回 rmax15・rmax16、第9回 horiz）と同じ値を返すこと
// (2) ミッションの答えを、スライダーの刻みで探し直す　(3) runChecks() に 'ng' がないこと
const fs = require('fs'), vm = require('vm');
function load(files){ const ctx = {console, Math, Map, Float64Array}; vm.createContext(ctx); vm.runInContext('function fx(v, d){ return v.toFixed(d); }\n' + files.map(f => fs.readFileSync(f, 'utf8')).join('\n').replace(/^const /gm, 'var '), ctx); return ctx; }
const U = 'src/framework/c_util.js', c17 = load([U, 'src/episodes/c17_core.js']), c15 = load([U, 'src/episodes/c15_core.js']), c9 = load([U, 'src/episodes/c9_core.js']);
let bad = 0; const r = c17.mulberry32(17);
for (let i = 0; i < 2000; i++){
  const p = {pav: 10 + r() * 1e4, g: Math.pow(10, 1.5 + r() * 3), ae: 0.1 + r() * 20, rcs: Math.pow(10, -2 + r() * 4), n: 1 + Math.floor(r() * 60), ei: 0.2 + 0.8 * r(), F: 0.5 + r(), Fn: 1 + r() * 9, fp: 100 + r() * 5000, snr1: 2 + r() * 50, Ls: 1 + r() * 30, ts: 1 + r() * 20, om: 0.1 + r() * 6}, h = r() * 100;
  if (Math.abs(c17.rmax15(p) / c15.rmax15(p) - 1) > 1e-12 || Math.abs(c17.rmax16(p) / c15.rmax16(p) - 1) > 1e-12 || Math.abs(c17.horiz(h, 4 / 3) - c9.horiz(h, 4 / 3)) > 1e-9) bad++;
}
console.log('元の回との比較（第15回 rmax15・rmax16、第9回 horiz）：2000 通り、不一致', bad);
{ const s = Object.assign({}, c15.DEFAULTS, {form: 'srch', pt: 0.065, tau: 65, fp: 500, ae: 10, fg: 3, rcs: 1, fn: 3, snr: 13, ls: 12, ts: 8, el: 30, mode: 'coh'}); console.log('標準の設計を第15回の画面の値に直して計算：', (c15.rmaxOf(s) / 1000).toFixed(3), 'km、第17回', c17.design(c17.with_({})).rs.toFixed(3), 'km（再訪 10 秒 × 捜索の時間 80% = 8 秒）'); }
const W = o => c17.with_(o), D = o => c17.design(W(o)), rng = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(Math.round(v * 1000) / 1000); return o; };
const first = (vals, ok) => { for (const v of vals) if (ok(v)) return v; return null; };
const ans = {
  1: first(rng(100, 400, 10).reverse(), R => D({R}).rs >= R),
  2: first(rng(5, 40, 1), h => D({h}).los >= 30),
  3: first(rng(1, 10, 0.25).reverse(), fg => { const d = D({fg}); return d.bw <= 2 && d.npulse >= 1; }),
  4: rng(5, 300, 5).filter(tau => { const d = D({tau}); return d.rs >= 200 && d.rmin <= 10 + 1e-9; }),
  5: first(rng(0, 60, 1).reverse(), ntrk => D({ntrk}).rs >= 200),
  6: first(rng(0, 20, 1).reverse(), ls => D({ls}).rs >= 200)};
console.log('ミッションの答え', JSON.stringify(ans));
{ let n = 0, ex = []; for (const h of rng(5, 40, 1)) for (const fg of rng(1, 10, 0.25)) for (const tau of rng(5, 300, 5)) for (const pt of rng(10, 100, 5)){ const s = W({h, fg, tau, pt}); if (c17.allOk(s)){ n++; if (ex.length < 3 || (pt === 65 && tau === 65 && fg === 3 && h === 20)) ex.push([h, fg, tau, pt]); } } console.log('ステップ 7：全部の行を満たす組み合わせ', n, '通り。例', JSON.stringify(ex.slice(0, 4))); }
{ const lo = rng(1, 10, 0.25).filter(fg => { const d = D({fg}); return d.bw <= 2 && d.npulse >= 1; }); console.log('追尾 20 目標のとき、ビーム幅とパルスの数を両方満たす周波数', lo.join('、'), 'GHz'); }
const d0 = D({}); console.log('標準の設計：捜索', d0.rs.toFixed(2), 'km、見通し', d0.los.toFixed(2), 'km、ビーム幅', d0.bw.toFixed(2), '°、向きの数', d0.nbeam.toFixed(0), '、パルス', d0.npulse.toFixed(2), '個、近く', d0.rmin.toFixed(2), 'km、平均電力', d0.pav.toFixed(1), 'W、電力開口積', d0.pa.toFixed(0), 'W·m²、要る値', d0.paReq.toFixed(0));
console.log('初期の設計（ステップ 7）', JSON.stringify(c17.rows(W({h: 10, fg: 6, tau: 150, pt: 40})).map(x => x.ok)));
const k = c17.runChecks(); console.log('照合', k.length, '行', k.map(x => x.st).join(' '), k.some(x => x.st === 'ng') ? '← ng あり' : '');
