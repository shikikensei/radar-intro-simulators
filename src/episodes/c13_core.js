/* ============================================================
   第13回 ビームのスケジューリング：計算部分
   もとにした資料：M. R. Smouse, E. P. Liu, J. J. Sylvester, "Integrated Air and Missile Defense Resource Management,"
                   Johns Hopkins APL Technical Digest, Vol. 35, No. 2 (2020), p.99–106 の前半（1 台のレーダのスケジューリング。p.99–104）
                   Radar Handbook 3rd ed. 第24章（p.24.44–24.45：スケジューラと追尾の連携、更新間隔の選び方）、第7章 §7.3（p.7.22）
   方針：記事が「抽象的な原理」として示している考え方だけを扱う。特定の装置の値や動作は使わない。数値はすべて説明用。
   簡略化：時間（占有）だけを扱い、送信電力・デューティ・波形の選択は扱わない。追尾の要求時刻は、目標ごとに一定の間隔で決まるものとする
           （実際のスケジュールの結果は、次の要求時刻に反映しない）。記事にある「緊急の固定タスクによる割り込み」は入れていない。
   追尾の割合：レーダの処理が 100 ms の周期で回るとし、「毎周期照射する目標」と「8 周期に 1 回照射する目標」の 2 種類を置いた（説明用の値）。
   「従来方式」の細部は記事に書かれていないので、次のように決めた：決まった長さの周期（区間、RSI）ごとに、優先度の高い待ち行列から順に、前から詰めて置く。
           追尾は、その周期に照射すると決めた目標を、毎周期の目標 → 8 周期に 1 回の目標の順に、周期の頭から並べる。
           柔軟タスクは、優先度の順に、遅れているぶんだけ、その後ろに並べる。1 回の照射は、周期の境目をまたげない。
   「新方式」で記事に書かれていない細部も、次のように決めた：一巡が終わった時刻を、次の一巡の開始時刻とする。
           次の固定タスクを後ろへずらすときは、すでに要求が出ている後続の固定タスク（区間の長さの上限まで先）が期限に間に合う範囲にとどめる。
           全部は間に合わないと分かったときは、優先度の低い固定タスクを、時間が来る前に管理側へ返す。
   時間の単位はミリ秒。
   ============================================================ */
const QS = {
  A: {n: '毎周期の追尾', kind: 'fix', len: 5, per: 100},
  B: {n: '8 周期に 1 回の追尾', kind: 'fix', len: 6, per: 800},
  H: {n: '水平線の捜索', kind: 'flex', len: 5, cnt: 20, dft: 1000},
  V: {n: '広域の捜索', kind: 'flex', len: 10, cnt: 200, dft: 5000},
  C: {n: 'クラッタマップ', kind: 'flex', len: 10, cnt: 40, dft: 10000}};
const FIXQ = ['A', 'B'], FLEXQ = ['H', 'V', 'C'], ALLQ = ['A', 'B', 'H', 'V', 'C'];
for (const k of FLEXQ){ QS[k].pl = QS[k].len * QS[k].cnt; QS[k].rate = QS[k].pl / QS[k].dft; }
const TSIM = 30000, RC = 100, NA0 = 3;      // RC：従来方式の周期（区間の長さ）[ms]。NA0：毎周期で追う目標の数（標準）
const DEFAULTS = {n: 24, slack: 20, na: NA0, sa: 1, done: 1.0, now: 0};
const S = Object.assign({}, DEFAULTS);
const naOf = na => na === undefined ? NA0 : na;
const fixLoad = (n, na) => naOf(na) * QS.A.len / QS.A.per + n * QS.B.len / QS.B.per;        // 追尾が使う時間の割合（n：8 周期に 1 回で追う目標の数）
const flexLoad = () => FLEXQ.reduce((s, k) => s + QS[k].rate, 0);                              // 捜索などが望みどおりに回るのに要る時間の割合
const demand = (n, na) => fixLoad(n, na) + flexLoad();
const frameBudget = (k, n, na) => { const left = 1 - fixLoad(n, na), need = flexLoad(); return left >= need ? QS[k].dft : left > 0 ? QS[k].dft * need / left : Infinity; };   // 残った時間を、望みの割合に比例して分けた場合のフレーム時間
const ftdOf = (pl, dft, elapsed, done) => pl / dft * elapsed - done;                           // 柔軟タスクの遅れ（FTD）。記事 p.102
function workload(n, na, seed){      // 追尾の要求。毎周期の目標：周期の頭から順に。8 周期に 1 回の目標：8 つの周期に均等に割りふり、周期の中の時刻は目標ごとに決める（乱数は固定）
  na = naOf(na); const r = mulberry32(1300 + (seed || 1)), W = {T: TSIM, A: [], B: [], n, na}, ph = []; for (let j = 0; j < 120; j++) ph.push(r());
  for (let k = 0; k * RC < TSIM; k++) for (let a = 0; a < na; a++) W.A.push({req: k * RC + a * QS.A.len, q: 'A', tg: a, cy: k});
  for (let i = 0; i < n; i++){ const c0 = i % 8, off = na * QS.A.len + ph[i] * (RC - QS.B.len - na * QS.A.len); for (let k = 0; (c0 + 8 * k) * RC < TSIM; k++) W.B.push({req: (c0 + 8 * k) * RC + off, q: 'B', tg: i, cy: c0 + 8 * k}); }
  W.B.sort((a, b) => a.req - b.req); for (let i = 1; i < W.B.length; i++) if (W.B[i].req < W.B[i - 1].req + QS.B.len) W.B[i].req = W.B[i - 1].req + QS.B.len;      // 希望時刻が重ならないようにずらす（追尾を管理する側の役目）
  return W; }
function newRes(){ return {bnd: [], ev: [], gaps: [], drop: {A: 0, B: 0}, wasted: 0, tot: {A: 0, B: 0, H: 0, V: 0, C: 0}}; }
function schedLegacy(W){      // 従来方式：決まった長さの周期（区間）を、優先度の高い順に、前から詰めて埋める
  const R = RC, T = W.T, res = newRes(), done = {H: 0, V: 0, C: 0}, by = {A: [], B: []};
  for (const q of FIXQ) for (const r of W[q]) (by[q][r.cy] = by[q][r.cy] || []).push(r);
  for (let j = 0, t0 = 0; t0 < T - 1e-9; j++, t0 += R){ const t1 = Math.min(T, t0 + R); let c = t0, behind = false; res.bnd.push(t0);
    const put = (len, q, r) => { res.ev.push(r ? {t: c, len, q, req: r.req, tg: r.tg, cy: r.cy} : {t: c, len, q}); res.tot[q] += len; c += len; };
    for (const q of FIXQ) for (const r of (by[q][j] || [])){ if (c + QS[q].len <= t1 + 1e-9) put(QS[q].len, q, r); else res.drop[q]++; }      // 追尾：毎周期の目標 → 8 周期に 1 回の目標。入りきらなければ落とす
    for (const q of FLEXQ){ const len = QS[q].len, want = QS[q].rate * t1; while (done[q] < want - 1e-9 && c + len <= t1 + 1e-9){ put(len, q); done[q] += len; } if (want - done[q] >= len - 1e-9) behind = true; }      // 捜索など：優先度の順に、遅れているぶんだけ
    if (t1 - c > 1e-9){ res.gaps.push({t: c, len: t1 - c, w: behind}); if (behind) res.wasted += t1 - c; } }
  return res;
}
function schedNew(W, o){      // 新方式：次の固定タスクで区間（DRSI）を作り、すき間を「遅れ」の大きい柔軟タスクから埋める
  const s = o.slack, dmax = o.dmax || 100, T = W.T, res = newRes(), ptr = {A: 0, B: 0}, used = {A: W.A.map(() => 0), B: W.B.map(() => 0)}, fx = {}; for (const k of FLEXQ) fx[k] = {pst: 0, cyc: 0};
  res.cases = [0, 0, 0, 0]; res.frames = {H: [], V: [], C: []};
  const ftd = (k, t) => QS[k].rate * (t - fx[k].pst) - fx[k].cyc, anyBehind = t => FLEXQ.some(k => ftd(k, t) >= QS[k].len - 1e-9);
  const gap = (a, b) => { if (b - a > 1e-9){ const w = anyBehind(a); res.gaps.push({t: a, len: b - a, w}); if (w) res.wasted += b - a; } };
  const fill = (t, lim) => { let c = t; const ord = FLEXQ.map(k => [k, ftd(k, t)]).sort((a, b) => b[1] - a[1]);      // 遅れ（FTD）の大きい順
    for (const [k] of ord){ const len = QS[k].len; while (ftd(k, t) > 1e-9 && c + len <= lim + 1e-9){ res.ev.push({t: c, len, q: k}); res.tot[k] += len; c += len; fx[k].cyc += len; if (fx[k].cyc >= QS[k].pl - 1e-9){ res.frames[k].push(c - fx[k].pst); fx[k].pst = c; fx[k].cyc = 0; } } }
    return c; };
  let t = 0;
  while (t < T - 1e-9){ res.bnd.push(t);
    let P = [];      // これから時間の来る固定タスク（区間の長さの上限まで先を見る）。期限の近い順に並べる
    for (const q of FIXQ){ while (ptr[q] < W[q].length && used[q][ptr[q]]) ptr[q]++; for (let i = ptr[q]; i < W[q].length && W[q][i].req - s < t + dmax; i++) if (!used[q][i]) P.push({q, i, req: W[q][i].req, len: QS[q].len, dl: W[q][i].req + s + QS[q].len}); }
    P.sort((a, b) => a.dl - b.dl);
    for (;;){ let c = t, bad = -1; for (let k = 0; k < P.length; k++){ const st = Math.max(c, P[k].req - s); if (st > P[k].req + s + 1e-9){ bad = k; break; } c = st + P[k].len; }      // 全部を期限内に実行できるか
      if (bad < 0) break; let v = -1; for (let k = bad; k >= 0; k--) if (P[k].q === 'B'){ v = k; break; } if (v < 0) v = bad;      // できないときは、優先度の低いタスクを管理側に返す（ケース 3）
      used[P[v].q][P[v].i] = 2; res.drop[P[v].q]++; res.cases[3]++; P.splice(v, 1); }
    const nft = P[0], es = nft ? Math.max(t, nft.req - s) : Infinity;
    if (!nft || es - t > dmax){ const end = Math.min(t + dmax, T), c = fill(t, end);      // 区間の長さの上限：柔軟タスクだけで区間を閉じる
      if (c > t + 1e-9) t = c; else { let nx = Math.min(end, es); for (const k of FLEXQ){ const tk = fx[k].pst + fx[k].cyc / QS[k].rate + 1e-6; if (tk > t + 1e-9) nx = Math.min(nx, tk); } if (nx <= t + 1e-9) nx = end; gap(t, nx); t = nx; }
      continue; }
    let lim = Infinity; for (let k = P.length - 1; k >= 0; k--) lim = Math.min(P[k].req + s, lim - P[k].len);      // 次の固定タスクをどこまで後ろへずらせるか（後続の固定タスクが間に合う範囲）
    res.cases[nft.q === 'A' || !P.some(x => x.q === 'A') ? 1 : 2]++;
    const c = fill(t, Math.min(lim, T)), stt = Math.max(c, es); gap(c, stt);
    if (stt + nft.len > T + 1e-9){ gap(stt, T); break; }
    res.ev.push({t: stt, len: nft.len, q: nft.q, req: nft.req, tg: W[nft.q][nft.i].tg}); res.tot[nft.q] += nft.len; used[nft.q][nft.i] = 1; t = stt + nft.len;
  }
  return res;
}
function stats(res, W){      // 占有率、すき間、平均フレーム時間、落とした固定タスク
  const T = W.T, busy = ALLQ.reduce((s, k) => s + res.tot[k], 0), g = res.gaps.reduce((s, x) => s + x.len, 0), o = {occ: busy / T, gap: g / T, wasted: res.wasted / T, share: {}, frame: {}, ratio: {}, drop: res.drop, nfix: {A: W.A.length, B: W.B.length}};
  for (const k of ALLQ) o.share[k] = res.tot[k] / T;
  for (const k of FLEXQ){ o.frame[k] = res.tot[k] > 0 ? QS[k].pl * T / res.tot[k] : Infinity; o.ratio[k] = o.frame[k] / QS[k].dft; }
  o.dropRate = (res.drop.A + res.drop.B) / Math.max(1, W.A.length + W.B.length); o.sum = busy + g;
  let dv = 0, nd = 0; for (const e of res.ev) if (e.req !== undefined){ dv += Math.abs(e.t - e.req); nd++; } o.dev = nd ? dv / nd : 0;
  const last = {}, jt = {A: [0, 0], B: [0, 0]};      // 同じ目標の更新の間隔が、決めた間隔からどれだけずれたか（落としたために間隔が空いた分は数えない）
  for (const e of res.ev.slice().sort((a, b) => a.t - b.t)) if (e.tg !== undefined){ const key = e.q + e.tg, per = QS[e.q].per; if (last[key] !== undefined && e.t - last[key] < 1.5 * per){ jt[e.q][0] += Math.abs(e.t - last[key] - per); jt[e.q][1]++; } last[key] = e.t; }
  o.jit = (jt.A[0] + jt.B[0]) / Math.max(1, jt.A[1] + jt.B[1]); o.jitA = jt.A[0] / Math.max(1, jt.A[1]); o.jitB = jt.B[0] / Math.max(1, jt.B[1]);
  return o;
}
function verify(res, W, slack, leg){      // 重なりがないか。固定タスクが、従来方式では決めた周期の中に、新方式では許容の範囲に入っているか
  const ev = res.ev.slice().sort((a, b) => a.t - b.t); let ov = 0, out = 0; for (let i = 1; i < ev.length; i++) if (ev[i].t < ev[i - 1].t + ev[i - 1].len - 1e-6) ov++;
  for (const e of ev) if (e.req !== undefined && (leg ? Math.floor((e.t + 1e-6) / RC) !== e.cy : Math.abs(e.t - e.req) > slack + 1e-6)) out++; return {ov, out, n: ev.length};
}
/* 流れの例（要求 → 計画 → 照射 → 結果 → 次の要求）。従来方式の小さな例。
   時間の関係は、説明のために次のように置いた（記事にもハンドブックにも書かれていない。補足）：
   周期の頭から「締め切り」（cut）までに届いた要求を受け付け、周期の終わりに次の周期の計画を作る。次の周期では、計画のとおりに、優先度の高い順に前から照射する。
   照射の結果は、信号処理と追尾フィルタ（tp）のあとで出る。毎周期の目標は、その結果を見て次の周期の要求を出す。
   目標：every = 毎周期、slow = 8 周期に 1 回（照射する周期の直前の周期に要求）、urgent = 急ぎ。az・r = 模式図の中の位置（意味のある値ではない） */
const FLOW = {R: 100, NC: 5, cut: 70, tp: 20, len: 5, out: null,
  tg: [{id: 1, kind: 'every', az: -30, r: 0.72, y: 2.64}, {id: 2, kind: 'every', az: 14, r: 0.88, y: 2.36}, {id: 3, kind: 'slow', az: 38, r: 0.8, y: 2.5, arr: 112}, {id: 4, kind: 'urgent', az: 6, r: 0.46, y: 2.5, arr: 175}]};
function flowSim(){
  if (FLOW.out) return FLOW.out;
  const R = FLOW.R, L = FLOW.len, ev = [], rq = [], plans = [], fb = []; let si = 0, pend = [1, 2];      // pend：次の周期の計画に入る目標
  for (const g of FLOW.tg) if (g.arr !== undefined) rq.push({id: g.id, arr: g.arr, y: g.y, cy: Math.floor(g.arr / R) + (g.arr - Math.floor(g.arr / R) * R <= FLOW.cut ? 1 : 2), late: g.arr - Math.floor(g.arr / R) * R > FLOW.cut});
  for (let j = 0; j < FLOW.NC; j++){ const t0 = j * R; let c = t0; const ids = pend.concat(rq.filter(q => q.cy === j && q.id > 2).map(q => q.id)).sort(); pend = [];
    if (j > 0) plans.push({cy: j, t0: t0 - R + FLOW.cut, t1: t0, ids});
    for (const id of ids){ const g = FLOW.tg[id - 1]; ev.push({t: c, len: L, cy: j, id, az: g.az}); c += L;
      if (g.kind === 'every'){ const arr = c + FLOW.tp, ok = arr - t0 <= FLOW.cut; rq.push({id, arr, y: g.y, cy: j + (ok ? 1 : 2), from: c}); fb.push({x0: c, x1: arr, y: g.y}); pend.push(id); } }
    while (c + L <= t0 + R + 1e-9){ ev.push({t: c, len: L, cy: j, id: 0, az: -45 + 10 * (si % 10)}); c += L; si++; } }
  plans.push({cy: FLOW.NC, t0: FLOW.NC * R - R + FLOW.cut, t1: FLOW.NC * R, ids: pend});
  const e4 = ev.find(e => e.id === 4), q4 = rq.find(q => q.id === 4), e3 = ev.find(e => e.id === 3);
  return FLOW.out = {ev, rq, plans, fb, wait4: e4.t - q4.arr, t4: e4.t, t3: e3.t};
}
const CACHE = {};
function runBoth(n, slack, na){ na = naOf(na); const key = [n, slack, na].join('/'); if (!CACHE[key]){ const W = workload(n, na, 1), a = schedLegacy(W), b = schedNew(W, {slack}); CACHE[key] = {W, leg: a, neu: b, sl: stats(a, W), sn: stats(b, W)}; } return CACHE[key]; }
function pairCase(sl){      // ステップ 3：同じ希望時刻（100 ms）の 2 つの固定タスク（A：優先、長さ 10 ms／B：通常、長さ 6 ms）を、許容 sl で置けるか。新方式の選び方に従う
  const A = {req: 100, len: 10}, B = {req: 100, len: 6}, dA = A.req + sl + A.len, dB = B.req + sl + B.len;
  if (dB < dA && B.req - sl + B.len <= A.req + sl + 1e-9){ const b = B.req - sl; return {ok: true, cs: 2, b, a: Math.max(b + B.len, A.req - sl)}; }      // ケース 2：B を先に、A を直後に
  return {ok: false, cs: 3, a: A.req - sl, b: null};                                                                                                   // ケース 3：A だけを実行し、B は返す
}
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note}), pc = v => fx(v * 100, 1) + '%';
  { const v = ftdOf(3200, 8000, 4000, 1400); add('柔軟タスクの遅れ（FTD）の計算例：望みのフレーム時間 8 秒、一巡の長さ 3.2 秒、開始から 4 秒、実績 1.4 秒', 'この時点で済んでいるはずの量 1.6 秒、遅れ 0.2 秒', '済んでいるはずの量 ' + fx(3200 / 8000 * 4000 / 1000, 1) + ' 秒、遅れ ' + fx(v / 1000, 1) + ' 秒', Math.abs(v - 200) < 1e-6 ? 'ok' : 'ng', '記事 p.102'); }
  { const d = runBoth(40, 20), a = d.sl, b = d.sn; add('スケジューラの効率の定義：（全時間 − すき間の合計）÷ 全時間', '照射の時間の合計とすき間の合計を足すと、全時間になる', '従来 ' + fx(a.sum / 1000, 3) + ' 秒、新 ' + fx(b.sum / 1000, 3) + ' 秒（全時間 30 秒）。効率は 従来 ' + pc(a.occ) + '、新 ' + pc(b.occ), Math.abs(a.sum - TSIM) < 1e-3 && Math.abs(b.sum - TSIM) < 1e-3 ? 'ok' : 'ng', '記事 p.103。8 周期に 1 回で追う目標 40 のとき'); }
  { let ok = true; const t = []; for (const n of [24, 40, 56, 72]){ const d = runBoth(n, 20), a = verify(d.leg, d.W, 20, true), b = verify(d.neu, d.W, 20); if (a.ov + a.out + b.ov + b.out) ok = false; t.push(n + '：' + (a.ov + b.ov) + ' 件／' + (a.out + b.out) + ' 件'); }
    add('スケジュールの整合（照射の重なり／決めた周期や許容の範囲を外れた追尾）。目標 24・40・56・72', '（基準なし）どちらも 0 件', t.join('、'), ok ? 'ref' : 'ng', 'このシミュレータの 2 つのスケジューラの自己点検。従来方式は「決めた周期の中」、新方式は「希望時刻 ± 許容」で確かめた'); }
  { const a = pairCase(3), b = pairCase(2); add('次の固定タスクの選び方：同じ希望時刻の 2 つのタスク（優先：長さ 10 ms、通常：長さ 6 ms）', '優先度の低いタスクが先に終われるなら、それを先に置き、高いタスクを直後に置く（すき間なし）。両立できないなら高いタスクを取り、低いタスクは返す', '許容 3 ms：' + (a.ok ? '両方実行（通常 ' + fx(a.b, 0) + ' ms → 優先 ' + fx(a.a, 0) + ' ms、あいだのすき間 ' + fx(a.a - a.b - 6, 0) + ' ms）' : '優先だけ実行') + '、許容 2 ms：' + (b.ok ? '両方実行' : '優先だけ実行'), a.ok && Math.abs(a.a - a.b - 6) < 1e-9 && a.a <= 103 && !b.ok ? 'ok' : 'ng', '記事 p.102–103（ケース 2、ケース 3）。ステップ 3 の例'); }
  { const d = runBoth(32, 20).sn, t = FLEXQ.map(k => QS[k].n + ' ' + fx(d.ratio[k], 2) + ' 倍'); add('新方式：負荷が 100% 未満のとき、望みのフレーム時間を平均として守れるか（目標 32、要求の合計 ' + pc(demand(32)) + '）', '長い時間で平均すれば、おおむね守れる', t.join('、') + '（平均フレーム時間 ÷ 望みの値）', FLEXQ.every(k => d.ratio[k] < 1.05) ? 'ok' : 'info', '記事 p.104 の記述。30 秒間のシミュレーション'); }
  { const t = []; let ok = true; for (const n of [24, 40, 56]){ const d = runBoth(n, 20).sn; t.push(n + '：毎周期 ' + d.drop.A + '／' + d.nfix.A + '、8 周期に 1 回 ' + d.drop.B + '／' + d.nfix.B); if (d.drop.A / d.nfix.A > 0.02) ok = false; }
    add('新方式：落とした固定タスクの数（目標 24・40・56）', '落とすのは少数。優先度の高いタスクとぶつかった場合に限られる', t.join('、'), ok ? 'ok' : 'info', '記事 p.104 の記述。ずれの許容 ±20 ms のとき'); }
  { const t = []; for (const n of [24, 40, 56]){ const d = runBoth(n, 20); t.push(n + '：' + pc(d.sl.wasted) + ' → ' + pc(d.sn.wasted)); }
    add('遅れているタスクがあるのに使えなかった時間の割合（従来 → 新）。目標 24・40・56', '（記事に数値なし）すき間を残さずに区間を埋めるのが新方式のねらい', t.join('、'), 'ref', 'このシミュレータのモデルでの結果。従来方式の細部はこちらで決めたものなので、実際の装置の性能を表す値ではない'); }
  { const d = runBoth(56, 20), a = d.sl, b = d.sn; add('要求の合計が 100% を超えたとき（目標 56、' + pc(demand(56)) + '）の、クラッタマップ（優先度が最も低い）の平均フレーム時間 ÷ 望みの値', '（記事に数値なし）新方式は、1 つのタスクが優先度だけで時間を独占するのを防ぐ', '従来 ' + (isFinite(a.ratio.C) ? fx(a.ratio.C, 1) + ' 倍' : '実行されない') + '、新 ' + fx(b.ratio.C, 1) + ' 倍（広域の捜索は 従来 ' + fx(a.ratio.V, 2) + ' 倍、新 ' + fx(b.ratio.V, 2) + ' 倍）', 'ref', 'このシミュレータのモデルでの結果。記事 p.103–104 の説明に対応'); }
  { const d = runBoth(24, 20); add('同じ目標を照射する間隔が、決めた間隔からずれる量の平均（目標 24）', '（基準なし）', '従来 ' + fx(d.sl.jit, 1) + ' ms、新 ' + fx(d.sn.jit, 1) + ' ms', 'ref', '比べるために作った指標。従来方式は周期の頭から同じ順に並べるので、ずれない。新方式は許容（±20 ms）の範囲で動かす'); }
  { const F = flowSim(), ev = F.rq.filter(q => q.from !== undefined), ok = ev.every(q => q.cy === Math.floor(q.from / FLOW.R) + 1); add('流れの例（ステップ 2）：毎周期の目標は、照射の結果（照射の終わり ＋ ' + FLOW.tp + ' ms）が締め切り（周期の頭から ' + FLOW.cut + ' ms）に間に合い、次の周期で照射できるか', '（基準なし）', ev.length + ' 件の要求のうち、間に合ったもの ' + ev.filter(q => q.cy === Math.floor(q.from / FLOW.R) + 1).length + ' 件。8 周期に 1 回の目標 ③ は、' + fx(F.t3, 0) + ' ms に照射', ok ? 'ref' : 'ng', '周期・締め切り・計画・照射の時間の関係は、説明のために置いたもの（記事・ハンドブックにはない）'); }
  { const F = flowSim(); add('流れの例（ステップ 2）：締め切りの後（175 ms）に届いた急ぎの要求が、照射されるまでの時間。周期 100 ms', '（基準なし）次の次の周期で照射', fx(F.wait4, 0) + ' ms（照射は ' + fx(F.t4, 0) + ' ms。周期 ' + (Math.floor(F.t4 / FLOW.R) + 1) + '）', Math.floor(F.t4 / FLOW.R) === 3 ? 'ref' : 'ng', '同上'); }
  return R;
}
