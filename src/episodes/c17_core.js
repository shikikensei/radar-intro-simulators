/* ============================================================
   第17回 レーダを 1 台設計する（艦艇の多機能レーダを例に）：計算部分
   もとにした資料（すべて前の回で使ったもの）：Radar Handbook 3rd ed.
     第1章 §1.4（p.1.11–1.13、式1.5・1.6）→ 第15回／第1章 §1.6（p.1.14–1.17）→ 第0回／第26章（レーダ水平線）→ 第9回
     第13章（ビーム幅とアンテナの大きさ）→ 第7回／第8章（パルス圧縮）→ 第1回・第16回／第13回の記事（時間の割合）
   方針：一般的な原理だけを扱う。「船に載せて、1 台で捜索も追尾もするレーダ」という役目だけを例にする。
         要求の値も、設計の値も、すべて説明のために置いた値で、実在の装置の値ではない。似せてもいない。
   設計の手順の並べ方は、こちらで決めたもの（補足）。各ステップの式は、前の回の関数を写して使う。
   モデル（補足）：
   ・捜索の距離：第15回の式1.6（位相をそろえて足す、Ei = 1、F = 1）。追尾に使う時間のぶん、捜索に使える時間が減る
     （再訪時間は変えず、1 つの向きを見る時間が (1 − u) 倍になるとした。u：追尾に使う時間の割合）。
   ・見通し距離：第9回と同じ √(2·k·a·h)（k = 4/3）を、アンテナと目標の両方に使って足す。海面の反射は入れない。
   ・ビーム幅：ビームの立体角 Ω0 = λ²/Ae の平方根。見て回る向きの数：Ω/Ω0。ビームを振ったときの利得の低下は入れない。
   ・1 つの向きに当たるパルスの数：再訪時間 × (1 − u) ÷ 向きの数 × PRF。
   ・近くが見えない距離：c·τ/2（送信中は受信できない）。近距離用に短いパルスを別に送る方法は扱わない。
   ・追尾：目標 1 つにつき、1 秒ごとに 10 ms の照射（時間の 1%）。
   ============================================================ */
const C0 = 3e8, KT0 = 4e-21, AE0 = 6371e3, KE = 4 / 3;
/* 要求（説明のために置いた値）と、変えない設計の値 */
const REQ = {R: 200, rcs: 1, el: 30, ts: 10, lowR: 30, lowH: 10, bw: 2, nmin: 1, rmin: 10, ntrk: 20, ls: 12};
const FIX = {ae: 10, fp: 500, B: 5e6, fn: 3, snr: 13, trkDwell: 0.01, trkPeriod: 1};
const DEFAULTS = {R: 200, h: 20, fg: 3, tau: 65, pt: 65, ntrk: 20, ls: 12};
const S = Object.assign({}, DEFAULTS);
const lin = d => Math.pow(10, d / 10);
/* 第15回（c15_core.js）から写した式：式1.5、式1.6 */
function rmax15(p){ return Math.pow(p.pav * p.g * p.ae * p.rcs * p.n * p.ei * Math.pow(p.F, 4) / (16 * Math.PI * Math.PI * KT0 * p.Fn * p.fp * p.snr1 * p.Ls), 0.25); }
function rmax16(p){ return Math.pow(p.pav * p.ae * p.rcs * p.ei * Math.pow(p.F, 4) * p.ts / (4 * Math.PI * KT0 * p.Fn * p.snr1 * p.Ls * p.om), 0.25); }
/* 第9回（c9_core.js）から写した式：水平線までの距離 [m] */
const horiz = (h, k) => Math.sqrt(2 * k * AE0 * Math.max(0, h));
const OMEGA = 2 * Math.PI * Math.sin(REQ.el * Math.PI / 180);      // 見る範囲の立体角 [sr]（方位 360° × 仰角 0〜30°）
/* 今の設計から、設計表の値を作る */
function design(s){
  s = s || S;
  const lam = C0 / (s.fg * 1e9), tau = s.tau * 1e-6, pav = s.pt * 1e3 * FIX.fp * tau, u = s.ntrk * FIX.trkDwell / FIX.trkPeriod, share = Math.max(0, 1 - u);
  const om0 = lam * lam / FIX.ae, g = 4 * Math.PI / om0, nbeam = OMEGA / om0, bw = Math.sqrt(om0) * 180 / Math.PI, dwell = REQ.ts * share / nbeam, npulse = dwell * FIX.fp;
  const p16 = {pav, ae: FIX.ae, rcs: REQ.rcs, ei: 1, F: 1, ts: REQ.ts * share, Fn: lin(FIX.fn), snr1: lin(FIX.snr), Ls: lin(s.ls), om: OMEGA};
  const rs = share > 0 ? rmax16(p16) / 1000 : 0, pa = pav * FIX.ae, paReq = paNeed(s.R, s.ls, share);
  const los = (horiz(s.h, KE) + horiz(REQ.lowH, KE)) / 1000, rmin = C0 * tau / 2 / 1000, tb = FIX.B * tau;
  return {lam, tau, pav, u, share, om0, g, nbeam, bw, dwell, npulse, rs, pa, paReq, los, rmin, tb, p16, dR: C0 / (2 * FIX.B)};
}
/* 捜索の距離 R [km] を満たすのに要る電力開口積 [W·m²]（式1.6 を Pav·Ae について解いたもの） */
function paNeed(Rkm, lsDb, share){ const R = Rkm * 1000; return Math.pow(R, 4) * 4 * Math.PI * KT0 * lin(FIX.fn) * lin(FIX.snr) * lin(lsDb) * OMEGA / (REQ.rcs * REQ.ts * (share === undefined ? 1 : share)); }
/* 設計表の行：[項目, 要求, 今の設計, 足りているか, その行を決めるステップ] */
function rows(s, d){
  s = s || S; d = d || design(s);
  return [
    {k: '捜索の距離（1 m² の目標）', req: fx(s.R, 0) + ' km 以上', val: fx(d.rs, 0) + ' km', ok: d.rs >= s.R, st: 1},
    {k: '低く飛ぶ目標（高さ 10 m）の見通し', req: REQ.lowR + ' km 以上', val: fx(d.los, 1) + ' km', ok: d.los >= REQ.lowR, st: 2},
    {k: 'ビーム幅（角度の細かさ）', req: REQ.bw + '° 以下', val: fx(d.bw, 2) + '°', ok: d.bw <= REQ.bw, st: 3},
    {k: '1 つの向きに当たるパルス', req: REQ.nmin + ' 個以上', val: fx(d.npulse, 2) + ' 個', ok: d.npulse >= REQ.nmin, st: 3},
    {k: '近くが見えない距離', req: REQ.rmin + ' km 以下', val: fx(d.rmin, 2) + ' km', ok: d.rmin <= REQ.rmin + 1e-9, st: 4},
    {k: '追尾できる目標の数', req: REQ.ntrk + ' 以上', val: s.ntrk + '（時間の ' + fx(d.u * 100, 0) + '%）', ok: s.ntrk >= REQ.ntrk && d.u < 1, st: 5},
    {k: '見込むシステム損失', req: REQ.ls + ' dB 以上', val: fx(s.ls, 0) + ' dB', ok: s.ls >= REQ.ls, st: 6}];
}
const allOk = (s, d) => rows(s, d).every(r => r.ok);
const with_ = o => Object.assign({}, DEFAULTS, o);
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  { const a = paNeed(200, 0, 1), b = paNeed(400, 0, 1); add('式1.6：捜索の距離を 2 倍にするのに要る電力開口積', '16 倍（距離の 4 乗に比例）', fx(b / a, 3) + ' 倍（200 km：' + fx(a, 0) + ' W·m²、400 km：' + fx(b, 0) + ' W·m²。損失なし）', near(b / a, 16, 1e-9), '式1.6（p.1.12）。第15回 ステップ 8'); }
  { const d = design(with_({})), back = paNeed(d.rs, 12, d.share); add('式1.6 で求めた捜索の距離と、その距離に要る電力開口積', '今の設計の電力開口積に戻る', '距離 ' + fx(d.rs, 2) + ' km → 要る電力開口積 ' + fx(back, 1) + ' W·m²（今の設計：' + fx(d.pa, 1) + ' W·m²）', near(back / d.pa, 1, 1e-9), '式を逆に解いた paNeed の自己点検。標準の設計（65 kW、65 µs、500 Hz、10 m²）'); }
  { const d = design(with_({})), n15 = 4 * Math.PI * d.p16.ts / (d.g * OMEGA) * FIX.fp, r15 = rmax15({pav: d.pav, g: d.g, ae: FIX.ae, rcs: 1, n: n15, ei: 1, F: 1, Fn: d.p16.Fn, fp: FIX.fp, snr1: d.p16.snr1, Ls: d.p16.Ls}) / 1000; add('式1.5 に n/fp = 4π·ts/(G·Ω) を入れた値と、式1.6 の値（標準の設計）', '同じ値になる（式1.6 の導き方）', '式1.5：' + fx(r15, 3) + ' km、式1.6：' + fx(d.rs, 3) + ' km（n = ' + fx(n15, 2) + '）', near(r15, d.rs, 1e-6), '式1.5・1.6（p.1.12）。第15回の rmax15・rmax16 と同じ式。n は「1 つの向きに当たるパルス」と同じ値'); }
  { const rs = [2, 3, 6, 10].map(f => design(with_({fg: f})).rs), dd = Math.max(...rs) - Math.min(...rs); add('式1.6：周波数を 2／3／6／10 GHz に変えたときの捜索の距離（有効開口面積と平均電力は固定）', '変わらない（周波数があらわに出てこない）', rs.map(v => fx(v, 2)).join('／') + ' km', dd < 1e-9 ? 'ok' : 'ng', 'p.1.12。位相をそろえて足す（Ei = 1）とした場合。第15回 ステップ 8 と同じ注意'); }
  { const a = horiz(20, KE) / 1000, b = 4.12 * Math.sqrt(20); add('水平線までの距離（アンテナの高さ 20 m）', '第9回：√(2·k·a·h)。k = 4/3 で 4.12·√h [km]', fx(a, 2) + ' km（4.12√h = ' + fx(b, 2) + ' km）', Math.abs(a - b) < 0.05 ? 'ok' : 'ng', '第9回の horiz と同じ式（第26章には式がなく、第9回でも補足として使った）'); }
  { const d = design(with_({})); add('低く飛ぶ目標（高さ 10 m）の見通し距離（アンテナの高さ 20 m）', '（基準なし）', fx(d.los, 2) + ' km（アンテナの水平線 ' + fx(horiz(20, KE) / 1000, 2) + ' km + 目標の水平線 ' + fx(horiz(10, KE) / 1000, 2) + ' km）', 'ref', '補足のモデル。海面の反射や回折は入れていない（第9回 ステップ 3・4）'); }
  { const d = design(with_({})); add('パルス圧縮：時間帯域幅積と、距離の細かさ（帯域幅 5 MHz、長さ 65 µs）', '利得は時間帯域幅積（第1回、第16回 ステップ 4）。細かさは c/(2B)', fx(d.tb, 0) + '（' + fx(db10(d.tb), 1) + ' dB）、' + fx(d.dR, 0) + ' m', near(d.tb, 325, 1e-9) === 'ok' && near(d.dR, 30, 1e-9) === 'ok' ? 'ok' : 'ng', '式1.6 は平均電力で書かれているので、この利得は式の中に入っている'); }
  { const d = design(with_({})); add('平均電力（尖頭 65 kW、長さ 65 µs、PRF 500 Hz）', 'Pav = Pt·fp·τ（p.1.12）', fx(d.pav, 1) + ' W（デューティ比 ' + fx(FIX.fp * d.tau * 100, 2) + '%）', near(d.pav, 2112.5, 1e-9), '第15回 ステップ 6'); }
  { const d = design(with_({})); add('追尾に使う時間の割合（20 目標、1 秒ごとに 10 ms）', '照射の時間の合計 ÷ 全体の時間（第13回の占有率と同じ考え方）', fx(d.u * 100, 1) + '%（捜索に使える時間 ' + fx(d.share * 100, 1) + '%）', near(d.u, 0.2, 1e-12), '追尾 1 回の照射時間と更新の間隔は、説明用の値'); }
  { const a = design(with_({ls: 0})).rs, b = design(with_({ls: 12})).rs; add('システム損失 12 dB を入れたときの捜索の距離', '10 の −12/40 乗 = 0.501 倍（第15回 ステップ 7）', fx(b / a, 3) + ' 倍（' + fx(a, 1) + ' km → ' + fx(b, 1) + ' km）', Math.abs(b / a - Math.pow(10, -0.3)) < 1e-9 ? 'ok' : 'ng', 'p.1.12「すべての損失を数えると 10〜20 dB になることも珍しくない」'); }
  { const d = design(with_({})); add('標準の設計の、ビーム幅・向きの数・1 つの向きに当たるパルス', '（基準なし）', fx(d.bw, 2) + '°、' + fx(d.nbeam, 0) + ' 個、' + fx(d.npulse, 2) + ' 個', 'ref', '補足のモデル（Ω0 = λ²/Ae、ビーム幅 = √Ω0）。第15回・第16回と同じ置き方'); }
  return R;
}
