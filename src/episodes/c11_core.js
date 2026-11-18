/* ============================================================
   第11回 合成開口レーダ（SAR）：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第17章 Synthetic Aperture Radar（p.17.1–17.38）
   簡略化：プラットフォームは一定の高さをまっすぐ、一定の速さで飛ぶ。地上の点目標だけを扱う。
           アジマス方向は、位相の変化（位相履歴）を実際に作り、参照信号との相関で圧縮する（1 次元）。
           距離方向の圧縮は、帯域幅で決まる応答（sinc 形）を式で与える。レンジマイグレーションと雑音は入れていない。
           2 次元の画像は「距離方向の応答 × アジマス方向の応答」を点目標ごとに足し合わせて作る。
   ============================================================ */
const RAD = Math.PI / 180, C0 = 299792458;
const EX = {lam: 0.03, D: 2, R: 100e3, V: 180};            // ハンドブックの例（p.17.5–17.6）
const SM = {lam: 0.03, R: 10e3, V: 100};                   // 位相履歴のシミュレーションに使う値（ステップ 4・8）
const DEFAULTS = {Lsa: 100, mode: 'slar', B: 100, La: 60, prf: 100, looks: 1, wt: 'uni', dcr: 3, tv: 0};
const S = Object.assign({}, DEFAULTS);
const rarRes = (lam, R, D) => R * lam / D;                 // 式17.1
const sarRes = (lam, R, L) => R * lam / (2 * L);           // 式17.2・17.8
const unfocRes = (lam, R) => Math.sqrt(lam * R) / 2;       // 非集束 SAR（p.17.3）
const rngRes = B => C0 / (2 * B);                          // 式17.7。B [Hz]
const tApert = (lam, R, V, d) => lam * R / (2 * V * d);    // 式17.6（スクイント 0）
const prfMin = (V, D) => 2 * V / D;                        // 式17.17
const prfMax = R => C0 / (2 * R);                          // 式17.19
const migr = (lam, R0, d) => lam * lam * R0 / (32 * d * d);// 式17.25
const MODES = {slar: {n: '実開口（SLAR）', f: () => rarRes(EX.lam, EX.R, EX.D)}, dbs: {n: 'DBS', f: () => sarRes(EX.lam, EX.R, 10)}, unf: {n: '非集束 SAR', f: () => unfocRes(EX.lam, EX.R)}, strip: {n: 'ストリップマップ', f: () => EX.D / 2}, spot: {n: 'スポットライト', f: () => sarRes(EX.lam, EX.R, 5000)}};
function taylorF(nbar, sll){ const A = Math.acosh(Math.pow(10, sll / 20)) / Math.PI, s2 = nbar * nbar / (A * A + (nbar - 0.5) * (nbar - 0.5)), F = [];
  for (let m = 1; m < nbar; m++){ let num = 1, den = 1; for (let n = 1; n < nbar; n++){ num *= 1 - m * m / (s2 * (A * A + (n - 0.5) * (n - 0.5))); if (n !== m) den *= 1 - m * m / (n * n); } F.push((m % 2 ? 1 : -1) * num / (2 * den)); } return F; }
const TAY35 = taylorF(5, 35);
const WTS = {uni: {n: '重みなし', f: x => 1}, tay: {n: 'テイラー（−35 dB、n̄ = 5）', f: x => { let g = 1; for (let m = 0; m < TAY35.length; m++) g += 2 * TAY35[m] * Math.cos(2 * Math.PI * (m + 1) * x); return g; }}, han: {n: 'ハン', f: x => Math.pow(Math.cos(Math.PI * x), 2)}};
function phaseHist(L, xt, n){      // 点目標（アジマス位置 xt）の位相履歴 [rad]。プラットフォームの位置 x = −L/2 〜 +L/2
  const x = [], ph = []; for (let i = 0; i <= n; i++){ const u = -L / 2 + L * i / n; x.push(u); ph.push(-4 * Math.PI / SM.lam * (Math.sqrt(SM.R * SM.R + (u - xt) * (u - xt)) - SM.R)); } return {x, ph}; }
function azIpr(L, o){      // アジマス圧縮の応答。o: {wt, v（目標の視線方向の速さ [m/s]）, umax, nu, focus（false で非集束：位相の 2 次の変化を補正しない）}
  o = o || {}; const dx = 0.25, N = Math.max(8, Math.round(L / dx)), wt = WTS[o.wt || 'uni'].f, umax = o.umax || 8, nu = o.nu || 800, k = 4 * Math.PI / SM.lam, u = [], re = [], im = [], xs = new Float64Array(N), ws = new Float64Array(N), r0 = new Float64Array(N); let sw = 0;
  for (let n = 0; n < N; n++){ xs[n] = -L / 2 + L * (n + 0.5) / N; ws[n] = wt((n + 0.5) / N - 0.5); sw += ws[n]; r0[n] = Math.sqrt(SM.R * SM.R + xs[n] * xs[n]) - (o.v ? o.v * xs[n] / SM.V : 0); }
  for (let i = 0; i <= nu; i++){ const uu = -umax + 2 * umax * i / nu; let a = 0, b = 0;      // 出力位置 uu に合わせた参照信号との相関。目標は u = 0 にある
    for (let n = 0; n < N; n++){ const ref = o.focus === false ? SM.R - xs[n] * uu / SM.R : Math.sqrt(SM.R * SM.R + (xs[n] - uu) * (xs[n] - uu)), p = -k * (r0[n] - ref); a += ws[n] * Math.cos(p); b += ws[n] * Math.sin(p); }
    u.push(uu); re.push(a / sw); im.push(b / sw); }
  return {u, re, im};
}
function iprStats(h){      // ピークの位置、最初のヌルまでの幅、3 dB 幅、第 1 サイドローブ
  const p = h.re.map((v, i) => v * v + h.im[i] * h.im[i]); let ip = 0; for (let i = 0; i < p.length; i++) if (p[i] > p[ip]) ip = i;
  let j = ip; while (j < p.length - 1 && p[j + 1] < p[j]) j++; const nul = h.u[j] - h.u[ip]; let sl = 0; for (let i = j; i < p.length; i++) sl = Math.max(sl, p[i]);
  let a = ip; while (a < p.length - 1 && p[a] > p[ip] / 2) a++; const fr = (p[a - 1] - p[ip] / 2) / (p[a - 1] - p[a] || 1), hw = h.u[a - 1] + (h.u[a] - h.u[a - 1]) * fr - h.u[ip];
  return {peak: h.u[ip], pk: p[ip], nul, w3: 2 * hw, psl: 10 * Math.log10(sl / p[ip]), p};
}
const sincn = x => Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
const SCENE = [{r: -6, x: -5, a: 1}, {r: -6, x: -3, a: 1}, {r: 5, x: 5, a: 1}, {r: 7, x: 5, a: 1}, {r: 0, x: 0, a: 1.3, mv: true}];      // 点目標（距離 r [m]、アジマス x [m]）。最後の 1 つは動く目標
function sarImage(B, L, v, wt, n, half){      // 2 次元の画像（電力 [dB]、最大を 0 dB）。n × n マス、範囲 ±half [m]
  const dr = rngRes(B * 1e6), umax = 2 * half + 4, h0 = azIpr(L, {wt, umax, nu: 600}), hm = v ? azIpr(L, {wt, v, umax, nu: 600}) : h0, db = new Float32Array(n * n), at = (h, u) => { const t = (u + umax) / (2 * umax) * 600, i = Math.max(0, Math.min(599, Math.floor(t))), f = t - i; return [h.re[i] + (h.re[i + 1] - h.re[i]) * f, h.im[i] + (h.im[i + 1] - h.im[i]) * f]; };
  let mx = 0; const pw = new Float64Array(n * n);
  for (let iy = 0; iy < n; iy++){ const r = -half + 2 * half * (iy + 0.5) / n; for (let ix = 0; ix < n; ix++){ const x = -half + 2 * half * (ix + 0.5) / n; let re = 0, im = 0;
    for (const t of SCENE){ const g = t.a * sincn((r - t.r) / dr), q = at(t.mv ? hm : h0, x - t.x), c = Math.cos(4 * Math.PI / SM.lam * t.r), s = Math.sin(4 * Math.PI / SM.lam * t.r); re += g * (q[0] * c - q[1] * s); im += g * (q[0] * s + q[1] * c); }
    const p = re * re + im * im; pw[iy * n + ix] = p; if (p > mx) mx = p; } }
  for (let i = 0; i < n * n; i++) db[i] = Math.max(-40, 10 * Math.log10(pw[i] / mx + 1e-12));
  return db;
}
function speckleImage(looks, seed){      // 一様な地面（明るさ 1）、暗い池（0.05）、明るい点 2 つ。画素ごとに指数分布のスペックルを付け、looks 回ぶん平均する
  const W = 120, H = 60, g = mulberry32(8000 + seed), db = new Float32Array(W * H); let s1 = 0, s2 = 0, c = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){ let m = 1; if (x > 70 && x < 105 && y > 14 && y < 40) m = 0.05; if ((x === 25 && y === 20) || (x === 40 && y === 42)) m = 60; let v = 0; for (let l = 0; l < looks; l++) v += -Math.log(1 - g() * 0.999999); v = v / looks * m; db[y * W + x] = 10 * Math.log10(v + 1e-6); if (m === 1 && x < 65){ s1 += v; s2 += v * v; c++; } }
  const mean = s1 / c; return {db, W, H, cv: Math.sqrt(s2 / c - mean * mean) / mean};
}
function nesz(o){ return 2 * Math.pow(4 * Math.PI, 3) * Math.pow(o.R, 3) * 1.38e-23 * 290 * o.F * o.loss * o.V * Math.cos(o.psi * RAD) / (o.P * Math.pow(10, o.G / 5) * Math.pow(o.lam, 3) * o.dr); }   // 式17.33
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  { const a = rarRes(EX.lam, EX.R, EX.D); add('式17.1：実開口のクロスレンジ分解能（波長 3 cm、アンテナ 2 m、距離 100 km）', '約 1.5 km', fx(a, 0) + ' m', Math.abs(a - 1500) < 1 ? 'ok' : 'ng', '式17.1 と本文の例（p.17.2）'); }
  { const a = sarRes(EX.lam, EX.R, 5000); add('式17.2：合成開口長 5 km のクロスレンジ分解能（同じ条件）', '約 30 cm', fx(a * 100, 0) + ' cm', Math.abs(a - 0.3) < 0.001 ? 'ok' : 'ng', '式17.2 と本文の例（p.17.2）'); }
  { const v = ['slar', 'dbs', 'unf', 'strip', 'spot'].map(k => MODES[k].f()), ref = [1500, 150, 27, 1, 0.3]; add('方式ごとのクロスレンジ分解能（SLAR／DBS／非集束／ストリップマップ／スポットライト）', '1500／150／27／1／0.3 m', v.map(x => x >= 10 ? fx(x, 0) : fx(x, 1)).join('／') + ' m', v.every((x, i) => Math.abs(x / ref[i] - 1) < 0.03) ? 'ok' : 'ng', '本文の例（p.17.5–17.6）。DBS は合成開口長 10 m、非集束は √(λR)/2、ストリップマップは D/2 で計算'); }
  { add('式17.7：距離分解能（帯域幅 1 GHz）', 'δr = c/2B', fx(rngRes(1e9), 3) + ' m', 'ok', '式17.7（p.17.7）。本文の例は 10 GHz で帯域 1 GHz（数値は書かれていない）'); }
  { const L = 150, h = azIpr(L, {umax: 4, nu: 4000}), st = iprStats(h), f = sarRes(SM.lam, SM.R, L); add('式17.8：位相履歴を作って圧縮したアジマス応答（合成開口長 150 m、距離 10 km、波長 3 cm）。ピークから最初のヌルまで', 'λR/(2·LSA) = ' + fx(f, 3) + ' m', fx(st.nul, 3) + ' m', Math.abs(st.nul / f - 1) < 0.01 ? 'ok' : 'ng', '式17.8（p.17.8）。位相履歴との相関による数値計算');
    add('重みなしの点像応答：3 dB 幅と第 1 サイドローブ', '3 dB 幅 0.886 δpn、第 1 サイドローブ −13.3 dB', fx(st.w3 / st.nul, 3) + ' δpn、' + fx(st.psl, 1) + ' dB', Math.abs(st.w3 / st.nul - 0.886) < 0.01 && Math.abs(st.psl + 13.3) < 0.2 ? 'ok' : 'ng', '本文（p.17.9、p.17.16）。同じ数値計算から'); 
    const t = iprStats(azIpr(L, {wt: 'tay', umax: 4, nu: 4000})), hn = iprStats(azIpr(L, {wt: 'han', umax: 4, nu: 4000}));
    add('重み付けした点像応答の 3 dB 幅（δpn = 重みなしのヌルまでの幅を単位に）と第 1 サイドローブ：テイラー（−35 dB、n̄ = 5）／ハン', '1.19 δpn（−35 dB）／1.43 δpn（−31.7 dB）', fx(t.w3 / st.nul, 2) + ' δpn（' + fx(t.psl, 1) + ' dB）／' + fx(hn.w3 / st.nul, 2) + ' δpn（' + fx(hn.psl, 1) + ' dB）', Math.abs(t.w3 / st.nul - 1.19) < 0.03 && Math.abs(hn.w3 / st.nul - 1.43) < 0.03 ? 'ok' : 'info', '本文（p.17.16）。ハンの第 1 サイドローブは、計算では −31.5 dB（本文 −31.7 dB）');
    const vv = 0.05, m = iprStats(azIpr(L, {v: vv, umax: 8, nu: 4000})), fd = vv * SM.R / SM.V; add('式17.40：視線方向に 0.05 m/s で動く目標の、クロスレンジ方向のずれ（プラットフォームの速さ 100 m/s、距離 10 km）', 'VLOS·R/V = ' + fx(fd, 2) + ' m', fx(Math.abs(m.peak), 2) + ' m（圧縮した応答のピークの位置）', Math.abs(Math.abs(m.peak) / fd - 1) < 0.02 ? 'ok' : 'ng', '式17.40（p.17.23）。位相履歴に目標の動きを入れて圧縮した結果'); }
  { const t = tApert(EX.lam, EX.R, EX.V, 0.3); add('式17.6：データを集める時間（距離 100 km、180 m/s、分解能 0.3 m）', 'tA = λR/(2·V·δcr)（合成開口長 5 km ÷ 180 m/s = 27.8 秒）', fx(t, 1) + ' 秒', Math.abs(t - 5000 / 180) < 0.05 ? 'ok' : 'ng', '式17.6（p.17.5）。本文の例の合成開口長 5 km と同じ値になることの確認'); }
  { const a = prfMin(180, 2), b = prfMax(150e3); add('式17.19：PRF の範囲（180 m/s、アンテナ 2 m、距離 150 km）', '180 Hz < fR < 1000 Hz', fx(a, 0) + ' Hz 〜 ' + fx(b, 0) + ' Hz', Math.abs(a - 180) < 0.5 && Math.abs(b - 1000) < 2 ? 'ok' : 'ng', '式17.17・17.19 と本文の例（p.17.14）'); }
  { const d = migr(0.03, 200e3, 1); add('式17.25：レンジマイグレーション（距離 200 km、波長 3 cm、分解能 1 m）', '5.6 m（距離分解能 1 m より大きい → 補正が必要）', fx(d, 2) + ' m', Math.abs(d - 5.6) < 0.05 ? 'ok' : 'ng', '式17.25 と本文の例（p.17.15）'); }
  { const a = C0 / (2 * 180), b = C0 / (4.7 * 180); add('式17.21・17.22：あいまいさのない距離 ÷ クロスレンジ分解能 の上限（180 m/s）', 'c/2V、より厳密には c/4.7V（数値例なし）', sci(a, 2) + '、' + sci(b, 2), 'ref', '式17.21・17.22（p.17.14）。分解能 1 m なら、あいまいさのない距離は約 ' + fx(b / 1000, 0) + ' km まで'); }
  { const v = nesz({R: 200e3, F: 2, loss: 5, V: 180, psi: 10, P: 700, G: 34, lam: 0.03, dr: 0.3}); add('式17.33：雑音等価 σ⁰（距離 200 km、F = 2、損失 5、180 m/s、グレージング角 10°、平均電力 700 W、利得 34 dB、波長 3 cm、δr = 0.3 m）', '−22 dB', fx(10 * Math.log10(v), 1) + ' dB', Math.abs(10 * Math.log10(v) + 22) < 0.5 ? 'ok' : 'info', '式17.33 と本文の例（p.17.17）'); }
  { const a = speckleImage(1, 1).cv, b = speckleImage(4, 1).cv, c = speckleImage(16, 1).cv; add('スペックルのばらつき（標準偏差 ÷ 平均）：1／4／16 ルック', '（この章に数値なし）1/√(ルック数) = 1／0.5／0.25', fx(a, 2) + '／' + fx(b, 2) + '／' + fx(c, 2), Math.abs(a - 1) < 0.08 && Math.abs(b - 0.5) < 0.05 && Math.abs(c - 0.25) < 0.03 ? 'ref' : 'ng', '補足：独立なルックの電力を平均したときの一般的な性質。マルチルックでスペックルが減ることは本文（p.17.20）'); }
  return R;
}
