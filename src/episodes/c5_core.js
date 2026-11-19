/* ============================================================
   第5回 自動追尾：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第7章 7.3 Automatic Tracking（p.7.22–7.45）
   ============================================================ */
const G0 = 9.8;
const DEFAULTS = {ks: 1, stage: 1, mreq: 2, gate: 1, alpha: 0.3, acc: 0.5, lg: -1, mode: 'nn', filt: 'ab', pd: 1, nfa: 0, seed: 1};
const S = Object.assign({}, DEFAULTS);
/* ---- α-β フィルタ（式7.19〜7.21）と、表7.3 の誤差の式 ---- */
const bbBeta = a => a * a / (2 - a);                                    // Benedict–Bordner の関係（p.7.27）
function abStep(st, xm, a, b, T){ const xp = st.xp, r = xm - xp, xs = xp + a * r, vs = st.vs + b * r / T; return {xs, vs, xp: xs + vs * T}; }
const T73 = {
  sFilt: (a, b) => Math.sqrt((2 * a * a + b * (2 - 3 * a)) / (a * (4 - 2 * a - b))),
  sPred: (a, b) => Math.sqrt((2 * a * a + a * b + 2 * b) / (a * (4 - 2 * a - b))),
  sVel: (a, b, T) => Math.sqrt(2 * b * b / (a * (4 - 2 * a - b))) / T,
  lagFilt: (a, b, acc, T) => acc * T * T * (1 - a) / b,
  lagPred: (a, b, acc, T) => acc * T * T / b,
  lagVelFilt: (a, b, acc, T) => acc * T * (a / b - 0.5),
  lagVelPred: (a, b, acc, T) => acc * T * (a / b + 0.5)
};
const EX = {sig: 50, T: 2, acc: G0};                                    // ハンドブックの例：距離精度 50 m、更新間隔 2 秒、1 g（p.7.26）
function totalErr(a){ const b = bbBeta(a); return {s: 2.3 * EX.sig * T73.sPred(a, b), lag: T73.lagPred(a, b, EX.acc, EX.T), tot: 2.3 * EX.sig * T73.sPred(a, b) + T73.lagPred(a, b, EX.acc, EX.T)}; }
/* ---- 1 次元（位置・速度）のカルマンフィルタ。Q はモデル1（白色雑音の加速度、表7.4） ---- */
function qMat(model, T, s){ return model === 1 ? [s * T * T * T / 3, s * T * T / 2, s * T] : model === 2 ? [s * T * T * T * T / 4, s * T * T * T / 2, s * T * T] : [0, 0, s]; }   // [Q11, Q12, Q22]
function kfPredict(P, T, Q){ const p11 = P[0] + 2 * T * P[1] + T * T * P[2] + Q[0], p12 = P[1] + T * P[2] + Q[1], p22 = P[2] + Q[2]; return [p11, p12, p22]; }
function kfGain(P, R){ const s = P[0] + R; return [P[0] / s, P[1] / s]; }                     // [位置ゲイン α、速度ゲイン β/T]
function kfUpdate(P, K){ return [(1 - K[0]) * P[0], (1 - K[0]) * P[1], P[2] - K[1] * P[1]]; }
function kfSteady(model, gamma){            // 追尾指数 γ（式7.36、表7.4）から定常ゲイン (α, β) を求める。T = 1、σm = 1 として反復
  const Q = qMat(model, 1, gamma); let P = [1e6, 0, 1e6], K = [1, 1];
  for (let i = 0; i < 4000; i++){ P = kfPredict(P, 1, Q); K = kfGain(P, 1); P = kfUpdate(P, K); }
  return {a: K[0], b: K[1]};
}
const T74 = {1: a => 6 - 3 * a - Math.sqrt(3 * a * a - 36 * a + 36), 2: a => 2 * (2 - a) - 4 * Math.sqrt(1 - a), 3: a => a * a / (2 - a)};
function kfGainHist(gamma, n, missAt){      // ゲインの時間変化（T = 1、σm = 1）。最初の観測で位置、2 回目で速度が決まる
  const Q = qMat(1, 1, gamma), out = []; let P = [1, 0, 1e9];
  out.push({k: 1, a: 1, b: NaN});
  for (let k = 2; k <= n; k++){ P = kfPredict(P, 1, Q); if (k === missAt){ out.push({k, a: NaN, b: NaN, miss: true}); continue; } const K = kfGain(P, 1); P = kfUpdate(P, K); out.push({k, a: K[0], b: K[1]}); }
  return out;
}
/* ---- 航跡の開始：M/N の基準 ---- */
function binom(n, k){ let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
function pMofN(M, N, p){ let s = 0; for (let k = M; k <= N; k++) s += binom(N, k) * Math.pow(p, k) * Math.pow(1 - p, N - k); return s; }
function gammaFT(D, N, M){ return Math.pow(N - 1, D) * binom(N - 1, M - 1) * Math.pow(2, D * (M - 1)); }      // 式7.43
function expFalseTracks(lF, lP, Nc, D, N, M){ return lF * Math.pow(lP, M - 2) * Math.pow(Nc, M) * gammaFT(D, N, M); }   // 式7.40
const FT = {lF: 2e-3, lP: 1e-5, D: 2};                                  // 図7.37 の例の値（p.7.44）
/* ---- 対応付け：表7.6 の例 ---- */
const TAB76 = [[4.2, 1.2, Infinity], [5.4, 3.1, 7.2], [6.3, Infinity, Infinity]];   // 行＝航跡 1〜3、列＝検出 7〜9
function assignNN(M){ const nr = M.length, nc = M[0].length, ur = new Array(nr).fill(-1), usedC = new Array(nc).fill(false); let sum = 0;
  for (;;){ let best = Infinity, bi = -1, bj = -1; for (let i = 0; i < nr; i++) if (ur[i] < 0) for (let j = 0; j < nc; j++) if (!usedC[j] && M[i][j] < best){ best = M[i][j]; bi = i; bj = j; } if (bi < 0) break; ur[bi] = bj; usedC[bj] = true; sum += best; }
  return {a: ur, sum, n: ur.filter(v => v >= 0).length}; }
function assignGNN(M){ const nr = M.length, nc = M[0].length; let best = null;      // 割り当ての数が最大のものの中で、統計距離の合計が最小のもの（総当たり）
  const rec = (i, used, a, sum, n) => { if (i === nr){ if (!best || n > best.n || (n === best.n && sum < best.sum)) best = {a: a.slice(), sum, n}; return; }
    a[i] = -1; rec(i + 1, used, a, sum, n); for (let j = 0; j < nc; j++) if (!used[j] && isFinite(M[i][j])){ used[j] = true; a[i] = j; rec(i + 1, used, a, sum + M[i][j], n + 1); used[j] = false; } a[i] = -1; };
  rec(0, new Array(nc).fill(false), new Array(nr).fill(-1), 0, 0); return best; }
/* ---- 式7.39：速度の精度 ---- */
function velAcc(sig, Tobs, N){ return sig / Tobs * Math.sqrt(12 * (N - 1) / (N * (N + 1))); }
/* ---- 2 次元の追尾シミュレーション（簡略モデル）
   目標：速さ一定。まっすぐ → 一定の横加速度で 90° 旋回 → まっすぐ。観測：x・y に独立な誤差（標準偏差 sig）。
   探知確率 pd で検出、誤警報は表示範囲に一様に nfa 個／スキャン。対応付け：ゲート（半径 gate）内で予測位置にいちばん近い点。
   フィルタ：x・y を別々に、同じゲインの α-β またはカルマン（モデル1）で処理。
   grow = true のときは、検出なしが続いた回数に応じてゲートを広げる（予測の確かさが下がるぶん。簡略化）。 ---- */
const SC = {T: 2, sig: 50, v: 250, n: 46, turnAt: 12, x0: 1500, y0: 2500, W: 22000, Hh: 12000};
function truthPath(acc){ const p = [], dt = 0.05, w = acc > 0 ? acc * G0 / SC.v : 0; let x = SC.x0, y = SC.y0, h = 0, t = 0, turned = 0; const tT = SC.turnAt * SC.T;
  for (let k = 0; k < SC.n; k++){ const tk = k * SC.T; while (t < tk - 1e-9){ if (t >= tT && turned < Math.PI / 2 && w > 0){ h += w * dt; turned += w * dt; } x += SC.v * Math.cos(h) * dt; y += SC.v * Math.sin(h) * dt; t += dt; } p.push({x, y}); }
  return p; }
function runTrack(o){
  const tr = truthPath(o.acc), g = gaussGen(1000 + o.seed * 7), rnd = mulberry32(500 + o.seed * 13), n = SC.n, T = SC.T, out = {truth: tr, meas: [], fa: [], pred: [], filt: [], gain: [], used: [], err: [], lost: false, lostAt: -1};
  for (let k = 0; k < n; k++){ const det = k < 2 || rnd() < o.pd; out.meas.push(det ? {x: tr[k].x + o.sig * g(), y: tr[k].y + o.sig * g()} : null); const f = []; for (let i = 0; i < o.nfa; i++) f.push({x: rnd() * SC.W, y: rnd() * SC.Hh}); out.fa.push(f); }
  // 航跡の開始：最初の 2 回の検出から位置と速度を決める（ここでは開始済みとして扱う）
  let xs = out.meas[1].x, ys = out.meas[1].y, vx = (out.meas[1].x - out.meas[0].x) / T, vy = (out.meas[1].y - out.meas[0].y) / T, P = [o.sig * o.sig, o.sig * o.sig / T, 2 * o.sig * o.sig / (T * T)], coast = 0;
  const b = bbBeta(o.alpha), Q = qMat(1, T, o.q || 0), R = o.sig * o.sig;
  out.pred.push(null, null); out.filt.push({x: out.meas[0].x, y: out.meas[0].y}, {x: xs, y: ys}); out.gain.push(null, null); out.used.push(0, 0); out.err.push(0, 0);
  for (let k = 2; k < n; k++){
    const xp = xs + vx * T, yp = ys + vy * T; if (o.filt === 'kf') P = kfPredict(P, T, Q);
    out.pred.push({x: xp, y: yp});
    let best = null, bd = o.gate * (o.grow ? 1 + coast : 1), kind = 0; const cands = out.fa[k].map(f => ({p: f, t: 2})); if (out.meas[k]) cands.push({p: out.meas[k], t: 1});
    for (const c of cands){ const d = Math.hypot(c.p.x - xp, c.p.y - yp); if (d <= bd){ bd = d; best = c.p; kind = c.t; } }
    out.err.push(Math.hypot(tr[k].x - xp, tr[k].y - yp));
    if (best){ let a = o.alpha, bb = b; if (o.filt === 'kf'){ const K = kfGain(P, R); a = K[0]; bb = K[1] * T; P = kfUpdate(P, K); }
      const rx = best.x - xp, ry = best.y - yp; xs = xp + a * rx; ys = yp + a * ry; vx += bb * rx / T; vy += bb * ry / T; coast = 0; out.gain.push({a, b: bb}); }
    else { xs = xp; ys = yp; coast++; out.gain.push(null); }
    out.used.push(kind); out.filt.push({x: xs, y: ys});
    if (!out.lost && (coast >= (o.grow ? 4 : 3) || Math.hypot(tr[k].x - xs, tr[k].y - ys) > 3 * o.gate)){ out.lost = true; out.lostAt = k; }
  }
  let se = 0, c = 0; for (let k = 6; k < n; k++){ se += out.err[k] * out.err[k]; c++; } out.rms = Math.sqrt(se / c); out.maxErr = Math.max.apply(null, out.err.slice(6)); out.wrong = out.used.filter(u => u === 2).length; out.miss = out.used.slice(2).filter(u => u === 0).length;
  return out;
}
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  let st = abStep({xp: 1000, vs: 100}, 1040, 0.5, 0.2, 2);
  add('式7.19〜7.21 の 1 回分の計算（予測 1000 m、測定 1040 m、速度 100 m/s、α 0.5、β 0.2、T 2 秒）', '平滑位置 1020 m、平滑速度 104 m/s、次の予測 1228 m', '平滑位置 ' + fx(st.xs, 0) + ' m、平滑速度 ' + fx(st.vs, 0) + ' m/s、次の予測 ' + fx(st.xp, 0) + ' m', st.xs === 1020 && Math.abs(st.vs - 104) < 1e-9 && Math.abs(st.xp - 1228) < 1e-9 ? 'ok' : 'ng', '式7.19〜7.21（p.7.26）');
  // 表7.3：乱数での確認
  for (const a of [0.3, 0.75]){ const b = bbBeta(a), g = gaussGen(77), N = 200000; let s = {xp: 0, vs: 0}, sf = 0, sp = 0, sv = 0;
    for (let k = 0; k < N; k++){ const xm = g(); sp += s.xp * s.xp; s = abStep(s, xm, a, b, 1); sf += s.xs * s.xs; sv += s.vs * s.vs; }
    const mf = Math.sqrt(sf / N), mp = Math.sqrt(sp / N), mv = Math.sqrt(sv / N), tf = T73.sFilt(a, b), tp = T73.sPred(a, b), tv = T73.sVel(a, b, 1), ok = Math.abs(mf / tf - 1) < 0.02 && Math.abs(mp / tp - 1) < 0.02 && Math.abs(mv / tv - 1) < 0.02;
    add('表7.3：測定雑音による誤差（α = ' + a + '、β = ' + fx(b, 3) + '）。平滑位置／予測位置／速度（σ = 1、T = 1）', fx(tf, 3) + '／' + fx(tp, 3) + '／' + fx(tv, 3), fx(mf, 3) + '／' + fx(mp, 3) + '／' + fx(mv, 3), ok ? 'ok' : 'ng', '表7.3（p.7.26）。α-β フィルタに雑音だけを 20 万回入力して求めた標準偏差'); }
  { const a = 0.5, b = bbBeta(a), T = 2, acc = G0; let s = {xp: 0, vs: 0}, lf = 0, lp = 0, lvf = 0; for (let k = 0; k < 400; k++){ const t = k * T, x = 0.5 * acc * t * t; lp = x - s.xp; s = abStep(s, x, a, b, T); lf = x - s.xs; lvf = acc * t - s.vs; }
    add('表7.3：一定の加速度 1 g に対する遅れ（α = 0.5、T = 2 秒）。平滑位置／予測位置／平滑速度', fx(T73.lagFilt(a, b, acc, T), 1) + ' m／' + fx(T73.lagPred(a, b, acc, T), 1) + ' m／' + fx(T73.lagVelFilt(a, b, acc, T), 1) + ' m/s', fx(lf, 1) + ' m／' + fx(lp, 1) + ' m／' + fx(lvf, 1) + ' m/s', near(lf, T73.lagFilt(a, b, acc, T), 0.5) === 'ok' && near(lp, T73.lagPred(a, b, acc, T), 0.5) === 'ok' && near(lvf, T73.lagVelFilt(a, b, acc, T), 0.5) === 'ok' ? 'ok' : 'ng', '表7.3（p.7.26）。加速し続ける目標を α-β フィルタに入力し、十分に時間が経過した後の遅れ'); }
  let ba = 0, bt = 1e9; for (let a = 0.05; a <= 0.999; a += 0.005){ const t = totalErr(a).tot; if (t < bt){ bt = t; ba = a; } }
  add('図7.27：合計の誤差（2.3σ ＋ 遅れ）が最小になる α（精度 50 m、2 秒、1 g、β = α²/(2−α)）', '0.6 < α < 0.9 でよく、最小は 0.75 付近', 'α = ' + fx(ba, 2) + '（合計 ' + fx(bt, 0) + ' m）。α = 0.6 で ' + fx(totalErr(0.6).tot, 0) + ' m、0.9 で ' + fx(totalErr(0.9).tot, 0) + ' m', Math.abs(ba - 0.75) <= 0.06 ? 'ok' : 'info', '図7.27 と本文（p.7.27）。表7.3 の式から計算。図の縦軸の読み取り値（最小で 200 m 強）とは約 1 割以内の差');
  { const h = kfGainHist(0, 10, -1); let ok = true, txt = []; for (const k of [2, 3, 5, 10]){ const fa = 2 * (2 * k - 1) / (k * (k + 1)), fb = 6 / (k * (k + 1)), g = h[k - 1]; if (Math.abs(g.a - fa) > 1e-6 || Math.abs(g.b - fb) > 1e-6) ok = false; txt.push('k=' + k + '：' + fx(g.a, 3) + '、' + fx(g.b, 3)); }
    add('式7.34・7.35：機動なし（Q = 0）のカルマンフィルタの k 回目のゲイン（α、β）', 'k=2：1.000、1.000／k=3：0.833、0.500／k=5：0.600、0.200／k=10：0.345、0.055', txt.join('／'), ok ? 'ok' : 'ng', '式7.34・7.35（p.7.30）。カルマンフィルタの式（7.29〜7.33）を 1 次元で実行した結果と比較'); }
  for (const m of [1, 2, 3]){ let ok = true; const txt = []; for (const gm of [0.01, 1, 100]){ const s = kfSteady(m, gm), fb = T74[m](s.a); if (Math.abs(s.b - fb) > 2e-4) ok = false; txt.push('γ=' + gm + '：α ' + fx(s.a, 3) + '、β ' + fx(s.b, 3) + '（式 ' + fx(fb, 3) + '）'); }
    add('表7.4：モデル' + m + ' の定常ゲインの関係 ' + ({1: 'β = 6 − 3α − √(3α² − 36α + 36)', 2: 'β = 2(2 − α) − 4√(1 − α)', 3: 'β = α²/(2 − α)'})[m], '定常状態のカルマンゲインがこの関係を満たす', txt.join('／'), ok ? 'ok' : 'ng', '表7.4（p.7.31）、図7.28（p.7.33）。リカッチ方程式を反復して求めた定常ゲインと比較'); }
  { const l1 = kfSteady(1, 1e9), l2 = kfSteady(2, 1e9), l3 = kfSteady(3, 1e9);
    add('追尾指数を大きくした場合のゲインの極限（α、β）：モデル1／モデル2／モデル3', '(1, 3−√3 = 1.268)／(1, 2)／(1, 1)', '(' + fx(l1.a, 3) + ', ' + fx(l1.b, 3) + ')／(' + fx(l2.a, 3) + ', ' + fx(l2.b, 3) + ')／(' + fx(l3.a, 3) + ', ' + fx(l3.b, 3) + ')', near(l1.b, 3 - Math.sqrt(3), 2e-3) === 'ok' && near(l2.b, 2, 2e-3) === 'ok' && near(l3.b, 1, 2e-3) === 'ok' ? 'ok' : 'ng', '本文（p.7.33–7.34）'); }
  { const nn = assignNN(TAB76), nm = j => j < 0 ? '更新なし' : '検出' + (7 + j);
    add('表7.6 の例に最近傍法の割り当てを適用した結果（航跡 1／2／3）', '検出8／検出7／更新なし', nn.a.map(nm).join('／'), nn.a[0] === 1 && nn.a[1] === 0 && nn.a[2] === -1 ? 'ok' : 'ng', '表7.6 と本文（p.7.39）');
    const gn = assignGNN(TAB76); add('表7.6 の例で 3 つの航跡すべてに検出点を割り当て、統計距離の合計を最小にした結果', '（ハンドブックに結果の記載なし）', gn.a.map(nm).join('／') + '、合計 ' + fx(gn.sum, 1), 'ref', '補足：GNN の考え方（p.7.39）を表7.6 に適用した計算。すべてを割り当てられる組は 1 通りだけ'); }
  { const N = 6, T = 2, sig = 50, tx = []; for (let i = 0; i < N; i++) tx.push(i * T); const mt = tx.reduce((a, b) => a + b, 0) / N, sxx = tx.reduce((a, t) => a + (t - mt) * (t - mt), 0), ls = sig / Math.sqrt(sxx), f = velAcc(sig, (N - 1) * T, N);
    add('式7.39：速度の精度（精度 50 m、2 秒おきに 6 回の検出、観測時間 10 秒）', fx(f, 2) + ' m/s', fx(ls, 2) + ' m/s（等間隔の 6 点に直線を当てはめた場合の傾きの標準偏差）', near(f, ls, 1e-6), '式7.39（p.7.42）'); }
  { const nc = (M, N, E) => Math.pow(E / (FT.lF * Math.pow(FT.lP, M - 2) * gammaFT(FT.D, N, M)), 1 / M), r1 = nc(5, 8, 1) / nc(3, 5, 1), r2 = nc(5, 8, 1e-3) / nc(3, 5, 1e-3);
    add('式7.40〜7.43：航跡開始の基準を 3/5 から 5/8 にした場合に、許容できる誤警報の数の比（λ_F = 2×10⁻³、λ_P = 10⁻⁵、2 次元）', '1 桁以上増える（図7.37）', '偽航跡の期待値 1 本の場合 ' + fx(r1, 1) + ' 倍、10⁻³ 本の場合 ' + fx(r2, 1) + ' 倍', r2 >= 10 ? (r1 >= 10 ? 'ok' : 'info') : 'ng', '式7.40〜7.43、図7.37（p.7.42–7.45）。倍率は「偽航跡を何本まで許容するか」に依存。図の読み取り条件が不明のため、2 つの条件で計算'); }
  { const tr = runTrack({acc: 0, seed: 3, sig: 50, pd: 1, nfa: 0, filt: 'ab', alpha: 0.75, gate: 1e9}); let se = 0, c = 0; for (let s = 1; s <= 60; s++){ const t2 = runTrack({acc: 0, seed: s, sig: 50, pd: 1, nfa: 0, filt: 'ab', alpha: 0.75, gate: 1e9}); for (let k = 10; k < SC.n; k++){ const dx = t2.truth[k].x - t2.pred[k].x; se += dx * dx; c++; } }
    const m = Math.sqrt(se / c), th = 50 * T73.sPred(0.75, bbBeta(0.75)); add('2 次元の追尾シミュレーション（等速直線、α = 0.75）での予測位置の誤差（x 方向の標準偏差）', fx(th, 1) + ' m（表7.3 の式）', fx(m, 1) + ' m（60 通りの乱数、各 36 スキャン）', Math.abs(m / th - 1) < 0.06 ? 'ok' : 'ng', '表7.3（p.7.26）。ステップ 6・9 で使う 2 次元モデルの確認'); }
  return R;
}
