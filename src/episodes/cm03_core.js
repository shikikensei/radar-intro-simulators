/* ============================================================
   中級 第3回 波形とあいまいさ：計算部分（共通の計算は cm_common.js）
   もとにした資料：Radar Handbook 3rd ed.
     第4章 §4.1（p.4.1–4.2：あいまいにならない距離 Ru = c/(2·fR)、低・中・高 PRF の区別）、§4.4 Range and Doppler Ambiguity Resolution（p.4.31–4.35：複数の PRF による測距、ゴースト）、
     §4.6（p.4.41、式4.17：エクリプシング。中級 第1回）、第8章 §8.2（p.8.3–8.8：LFM、距離とドップラの結びつき −fd·T/B、表8.1・8.2：重み付け）
   入門 第3回（legacy/pcore.js・pchecks.js）、第1回（legacy/core.js）で確かめてある式と値を使う：
     Ru = c/(2·fR)、最初のブラインド速度（あいまいにならない速度の幅）= fR·λ/2、
     LFM のドップラによるピークのずれ = −fd·T/B（p.8.4）、
     表8.2：重みなしの 3 dB 幅 0.886/B、テイラー（40 dB）の 3 dB 幅 1.25/B、ミスマッチ損失 1.15 dB
   モデル（補足）：
   ・あいまいにならない距離と速度の幅の積 = c·λ/4（上の 2 式を掛けたもの）。
   ・複数の PRF：それぞれの PRF で見かけの距離を測り、c/(2·fR) ずつ足した候補が、すべての PRF で（許容の範囲で）そろう距離を、本当の距離とする。
     組み合わせた、あいまいにならない距離は c/(2·gcd(fR))。
   ・エクリプシング：送信している時間の割合（デューティ比）だけ、距離が見えなくなる。平均の損失は式4.17（N = 1/デューティ比）。
   ・要求の値（最大距離 150 km、近づく・遠ざかる速さ ±600 m/s、距離の細かさ 20 m）は説明用。
   ============================================================ */
const REQ = {rmax: 150, vmax: 600, dr: 20, duty: 10};
const TAY = {w3: 1.25, w3u: 0.886, loss: 1.15};      // 表8.2（テイラー 40 dB、重みなし）
const DEFAULTS = {fp: 1, tau: 4, bw: 10, R: 43.7, v: 600, npr: 2, wt: 1};
const S = Object.assign({}, DEFAULTS);
const ruOf = fpk => C0 / (2 * fpk * 1e3) / 1000;                 // [km]。fpk：PRF [kHz]
const vuOf = (fpk, lam) => fpk * 1e3 * lam / 2;                   // あいまいにならない速度の幅 [m/s]
const eclApprox = N => 12 * N / (7 * N - 6);                      // 式4.17
const gcd = (a, b) => b < 1e-9 ? a : gcd(b, a % b);
const PRFSET = {2: [10, 9], 3: [10, 9, 8]};                       // [kHz]
function unfold(Rkm, fps, rmax, tol){      // 見かけの距離から候補を並べ、全部の PRF でそろう距離を探す
  const cand = fps.map(f => { const ru = ruOf(f), app = Rkm % ru, a = []; for (let k = 0; app + k * ru <= rmax + 1e-9; k++) a.push(app + k * ru); return {ru, app, a}; });
  const hits = cand[0].a.filter(x => cand.every(c => c.a.some(y => Math.abs(y - x) <= tol)));
  return {cand, hits};
}
function ghosts(Rs, fps, rmax, tol){        // 目標が複数あるとき：PRF ごとの候補を全部まぜて、全部の PRF でそろう距離を数える（本物でないものがゴースト）
  const per = fps.map(f => { const ru = ruOf(f), a = []; for (const R of Rs){ const app = R % ru; for (let k = 0; app + k * ru <= rmax + 1e-9; k++) a.push(app + k * ru); } return a; });
  const hits = []; for (const x of per[0]) if (per.every(a => a.some(y => Math.abs(y - x) <= tol)) && !hits.some(h => Math.abs(h - x) <= tol)) hits.push(x);
  return {per, hits, ghost: hits.filter(h => !Rs.some(R => Math.abs(R - h) <= tol))};
}
function eclPower(x, N){ const t = x * N, k = Math.floor(t), f = t - k; const v = k === 0 ? f : k === N - 1 ? 1 - f : Math.max(f, 1 - f); return v * v; }      // 中級 第1回と同じ（N が整数のとき）
function calc(s){
  s = s || S; const lam = EXR.lam, ru = ruOf(s.fp), vu = vuOf(s.fp, lam), duty = s.tau * 1e-6 * s.fp * 1e3, ng = 1 / duty, fd = 2 * s.v / lam, tb = s.bw * s.tau;
  const dr0 = C0 / (2 * s.bw * 1e6), dr = dr0 * (s.wt ? TAY.w3 : TAY.w3u), shiftT = fd * s.tau * 1e-6 / (s.bw * 1e6), shiftR = C0 * shiftT / 2;
  return {lam, ru, vu, prod: ru * 1000 * vu, nR: Math.ceil(REQ.rmax / ru - 1e-9), nV: Math.ceil(2 * REQ.vmax / vu - 1e-9), duty, ng, blind: C0 * s.tau * 1e-6 / 2, ecl: db10(eclApprox(ng)), fd, tb, tbdb: db10(tb), dr0, dr, wloss: s.wt ? TAY.loss : 0, shiftT, shiftR, pav: 0};
}
function verdict(s, c){ c = c || calc(s); return [['距離のアンビギュイティなし（1 つの PRF で）', c.nR <= 1], ['速度のアンビギュイティなし', c.nV <= 1], ['デューティ比 ' + REQ.duty + '% 以下', c.duty * 100 <= REQ.duty + 1e-9], ['距離分解能 ' + REQ.dr + ' m 以下', c.dr <= REQ.dr + 1e-9], ['時間帯域幅積 30 以上', c.tb >= 30 - 1e-9]]; }
const with_ = o => Object.assign({}, DEFAULTS, o);
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note}), nr = (a, b, t) => Math.abs(a - b) <= t ? 'ok' : 'ng';
  add('あいまいさのない最大距離（PRF 10 kHz）', 'Ru = c/(2·fR) = 15 km（入門 第3回の照合と同じ）', fx(ruOf(10), 3) + ' km', nr(ruOf(10), 15, 1e-9), '§4.1（p.4.1）');
  add('あいまいさのない速度幅（PRF 10 kHz、波長 3 cm）', 'fR·λ/2 = 150 m/s（入門 第3回の照合と同じ）', fx(vuOf(10, 0.03), 1) + ' m/s', nr(vuOf(10, 0.03), 150, 1e-9), '§4.1。入門 第2回の式2.1（ブラインド速度）と同じ形');
  { const c = calc(with_({fp: 1})); add('例のレーダ（PRF 1 kHz、波長 10 cm）：あいまいさのない最大距離と速度幅', '150 km、50 m/s（入門 第16回、中級 第2回と同じ値）', fx(c.ru, 1) + ' km、' + fx(c.vu, 1) + ' m/s', nr(c.ru, 150, 1e-9) === 'ok' && nr(c.vu, 50, 1e-9) === 'ok' ? 'ok' : 'ng', '回をまたいでも、同じ条件であれば同じ値'); }
  { let mx = 0; for (const f of [0.5, 1, 5, 25, 100]){ const c = calc(with_({fp: f})); mx = Math.max(mx, Math.abs(c.prod / (C0 * EXR.lam / 4) - 1)); } add('最大距離と速度幅の積（PRF を 0.5〜100 kHz に変えて）', '（基準なし）c·λ/4 = ' + sci(C0 * EXR.lam / 4, 2) + ' m²/s で一定', 'PRF に依存せず一定（差の最大 ' + sci(mx, 0) + '）', mx < 1e-12 ? 'ref' : 'ng', '2 つの式の積。補足'); }
  { const u = unfold(43.7, [10, 9], 150, 0.05), g = C0 / (2 * gcd(10000, 9000)) / 1000; add('2 つの PRF（10 kHz、9 kHz）で、43.7 km の目標の距離を決定', '（基準なし）見かけの距離 13.7 km と 10.37 km。組み合わせた場合のあいまいさのない最大距離 = c/(2·gcd) = 150 km', '見かけの距離 ' + fx(u.cand[0].app, 2) + ' km／' + fx(u.cand[1].app, 2) + ' km。一致する距離：' + u.hits.map(h => fx(h, 1)).join('、') + ' km（1 つだけ）。組合せ ' + fx(g, 0) + ' km', u.hits.length === 1 && Math.abs(u.hits[0] - 43.7) < 0.05 ? 'ref' : 'ng', '§4.4（p.4.31–4.32）の手順（候補を並べて一致する距離を探す）を、この教材の計算で実行'); }
  { const g2 = ghosts([43.7, 57], [10, 9], 150, 0.05), g3 = ghosts([43.7, 57], [10, 9, 8], 150, 0.05); add('目標が 2 つ（43.7 km、57 km）の場合のゴースト', '検出が複数あるとゴーストが生じることがある。PRF の数を増やして防ぐ（p.4.32）', 'PRF 2 つ：一致する距離 ' + g2.hits.length + ' 個（ゴースト ' + g2.ghost.length + '）。PRF 3 つ：' + g3.hits.length + ' 個（ゴースト ' + g3.ghost.length + '）', g2.ghost.length > 0 && g3.ghost.length === 0 ? 'ok' : 'info', '説明用の例。PRF 2 つでは ' + g2.ghost.map(h => fx(h, 1)).join(' km と ') + ' km に実在しない距離が現れる'); }
  { const c = calc(with_({fp: 25, tau: 4})); let a = 0; const n = 20000; for (let i = 0; i < n; i++) a += eclPower((i + 0.5) / n, 10) / n; add('エクリプシングとストラドルの平均損失（デューティ比 10%、N = 10）', '式4.17：12N/(7N − 6) = 2.73 dB（中級 第1回 ステップ 6 と同じ値）', fx(c.ecl, 2) + ' dB（出力の電力を平均して確認した値 ' + fx(-db10(a), 2) + ' dB）', nr(c.ecl, 2.73, 0.005), 'p.4.41。P_d が高い場合、損失はこれより大きい（中級 第1回）'); }
  add('距離分解能（3 dB 幅）と重み付け：帯域幅 10 MHz', '表8.2：重み付けなし 0.886/B、テイラー（40 dB）1.25/B、ミスマッチ損失 1.15 dB（入門 第1回の照合と同じ値）', '重み付けなし ' + fx(C0 / 2e7 * TAY.w3u, 2) + ' m、テイラー ' + fx(C0 / 2e7 * TAY.w3, 2) + ' m（c/(2B) = 15 m）', nr(C0 / 2e7 * TAY.w3, 18.75, 1e-9), '第8章 表8.2（p.8.8）。値は入門 第1回でシミュレーションと照合済み');
  { const c = calc(with_({tau: 100, bw: 1, v: 600})); add('LFM の距離ドップラ結合：パルス幅 100 µs、帯域幅 1 MHz、速度 600 m/s（ドップラ 12 kHz）', '時間の偏移 = fd·T/B（p.8.4。入門 第1回 ステップ 7）', fx(c.shiftT * 1e6, 2) + ' µs → 距離で ' + fx(c.shiftR, 0) + ' m', nr(c.shiftR, 180, 0.01), '偏移の方向は周波数が上昇するチャープか下降するチャープかで決まる'); }
  { const c = calc(with_({fp: 25, tau: 4, bw: 10})); add('例の波形（PRF 25 kHz、4 µs、10 MHz）：アンビギュイティ数、デューティ比、時間帯域幅積', '（基準なし）', '距離 ' + c.nR + ' 重、速度 ' + c.nV + ' 重、' + fx(c.duty * 100, 1) + '%、' + fx(c.tb, 0) + '（' + fx(c.tbdb, 1) + ' dB）', 'ref', '説明用の例'); }
  return R;
}
