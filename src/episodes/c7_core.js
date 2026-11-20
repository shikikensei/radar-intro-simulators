/* ============================================================
   第7回 フェーズドアレイアンテナ：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第13章 Phased Array Radar Antennas（p.13.1–13.62）
   モデル：等間隔の直線アレイ。パターン = 素子パターン × Σ a_n·exp(j(2π(s/λ)(f/f0)·n·sinθ − φ_n))。
           素子パターンは、整合した素子の電力パターン cosθ（式13.16・13.17）。相互結合や誤差は扱わない（誤差は照合の中でだけ使う）。
   ============================================================ */
const RAD = Math.PI / 180;
const DEFAULTS = {look: 0, n: 2, s: 0.5, th0: 0, wt: 'uni', bits: 0, df: 0, thj: 3, pol: false};
const S = Object.assign({}, DEFAULTS);
function taylorF(nbar, sll){ const A = Math.acosh(Math.pow(10, sll / 20)) / Math.PI, s2 = nbar * nbar / (A * A + (nbar - 0.5) * (nbar - 0.5)), F = [];
  for (let m = 1; m < nbar; m++){ let num = 1, den = 1; for (let n = 1; n < nbar; n++){ num *= 1 - m * m / (s2 * (A * A + (n - 0.5) * (n - 0.5))); if (n !== m) den *= 1 - m * m / (n * n); } F.push((m % 2 ? 1 : -1) * num / (2 * den)); } return F; }
const TAY5 = taylorF(5, 36);
const WT = {uni: {n: '一様', f: x => 1}, cos: {n: 'コサイン', f: x => Math.cos(Math.PI * x)}, han: {n: 'コサイン 2 乗（ハニング）', f: x => Math.cos(Math.PI * x) * Math.cos(Math.PI * x)},
  ham: {n: 'ハミング', f: x => 0.54 + 0.46 * Math.cos(2 * Math.PI * x)}, tay: {n: 'テイラー（n̄ = 5）', f: x => { let g = 1; for (let m = 0; m < TAY5.length; m++) g += 2 * TAY5[m] * Math.cos(2 * Math.PI * (m + 1) * x); return g; }}};
function weights(N, wt){ const a = new Float64Array(N); for (let n = 0; n < N; n++) a[n] = WT[wt].f((n + 0.5) / N - 0.5); return a; }
const effOf = a => { let s1 = 0, s2 = 0; for (const v of a){ s1 += v; s2 += v * v; } return s1 * s1 / (a.length * s2); };
function phases(N, s, th0, bits){ const p = new Float64Array(N), q = bits > 0 ? 2 * Math.PI / Math.pow(2, bits) : 0; for (let n = 0; n < N; n++){ let v = 2 * Math.PI * s * (n - (N - 1) / 2) * Math.sin(th0 * RAD); p[n] = q ? Math.round(v / q) * q : v; } return p; }
function fieldU(a, ph, s, df, u){ let re = 0, im = 0; const N = a.length, k = 2 * Math.PI * s * (1 + df) * u; for (let n = 0; n < N; n++){ const x = k * (n - (N - 1) / 2) - ph[n]; re += a[n] * Math.cos(x); im += a[n] * Math.sin(x); } return re * re + im * im; }
function pat(o){           // o: {n, s, th0, wt, bits, df, el, a?, ph?} → 角度 −90〜90° の電力パターン（正面・誤差なしのピークを 1 とする）
  const a = o.a || weights(o.n, o.wt), ph = o.ph || phases(o.n, o.s, o.th0, o.bits || 0); let sa = 0; for (const v of a) sa += v; const th = [], p = [], step = o.step || 0.2;
  for (let t = -90; t <= 90.0001; t += step){ const u = Math.sin(t * RAD); th.push(t); p.push(fieldU(a, ph, o.s, o.df || 0, u) / (sa * sa) * (o.el === false ? 1 : Math.max(0, Math.cos(t * RAD)))); }
  return {th, p, a, ph}; }
const toDbArr = (p, ref, flo) => p.map(v => Math.max(flo === undefined ? -60 : flo, 10 * Math.log10(v / (ref || 1) + 1e-30)));
function scanU(a, ph, s, df, u0, u1, n){ const us = [], ps = []; for (let i = 0; i <= n; i++){ const u = u0 + (u1 - u0) * i / n; us.push(u); ps.push(fieldU(a, ph, s, df, u)); } return {us, ps}; }
function mainLobe(a, ph, s, df, uc, lite){       // u = sinθ の空間で、uc の近くのピーク、3 dB 幅、両側の最初のヌル、ピークサイドローブを求める
  const N = a.length, w = 2 / (N * s), g = scanU(a, ph, s, df, uc - w, uc + w, lite ? 600 : 3000); let ip = 0; for (let i = 1; i < g.ps.length; i++) if (g.ps[i] > g.ps[ip]) ip = i; const pk = g.ps[ip], up = g.us[ip];
  const cross = dir => { let i = ip; while (i > 0 && i < g.ps.length - 1 && g.ps[i] > pk / 2) i += dir; const j = i - dir; return g.us[j] + (g.us[i] - g.us[j]) * (pk / 2 - g.ps[j]) / (g.ps[i] - g.ps[j]); };
  const uL = cross(-1), uR = cross(1); if (lite) return {up, pk, uL, uR, bwDeg: (Math.asin(Math.max(-1, Math.min(1, uR))) - Math.asin(Math.max(-1, Math.min(1, uL)))) / RAD}; const u0 = Math.max(-1, up - 12 / (N * s)), u1 = Math.min(1, up + 12 / (N * s)), f = scanU(a, ph, s, df, u0, u1, 4800); let jp = Math.round((up - u0) / (u1 - u0) * 4800), l = jp, r = jp;   /* 可視領域（|u| ≤ 1）の中だけでサイドローブを探す */ while (l > 1 && f.ps[l - 1] < f.ps[l]) l--; while (r < f.ps.length - 2 && f.ps[r + 1] < f.ps[r]) r++;
  let sl = 0; for (let i = 0; i < f.ps.length; i++) if ((i < l || i > r) && f.ps[i] > sl) sl = f.ps[i];
  return {up, pk, uL, uR, sl: 10 * Math.log10(sl / pk), bwDeg: (Math.asin(Math.max(-1, Math.min(1, uR))) - Math.asin(Math.max(-1, Math.min(1, uL)))) / RAD}; }
const bwBroad = (N, s, k) => (k || 50.8) / (N * s);                               // 式13.5・表13.1：ビーム幅 [度] = k·λ/a
const glLimit = th0 => 1 / (1 + Math.abs(Math.sin(th0 * RAD)));                    // 式13.9
function glAngles(s, th0){ const out = []; for (const n of [-2, -1, 1, 2]){ const u = Math.sin(th0 * RAD) + n / s; if (Math.abs(u) <= 1) out.push(Math.asin(u) / RAD); } return out; }   // 式13.10
const squint = (df, th0) => -df * Math.tan(th0 * RAD) / RAD;                       // 式13.26 [度]
const quantLoss = P => -10 * Math.log10(1 - Math.PI * Math.PI / (3 * Math.pow(4, P)));   // 式13.25 [dB]
function nullW(N, s, th0, thj, jnr){      // 妨害 1 個に対する適応重み w = R⁻¹·s、R = I + JNR·v·vᴴ（1 個なので逆行列は式で書ける）
  const wr = new Float64Array(N), wi = new Float64Array(N), u0 = Math.sin(th0 * RAD), uj = Math.sin(thj * RAD); let cr = 0, ci = 0;
  for (let n = 0; n < N; n++){ const d = 2 * Math.PI * s * (n - (N - 1) / 2) * (u0 - uj); cr += Math.cos(d); ci += Math.sin(d); }       // vᴴ·s
  const k = jnr / (1 + jnr * N);
  for (let n = 0; n < N; n++){ const x = 2 * Math.PI * s * (n - (N - 1) / 2), s0 = x * u0, sj = x * uj; wr[n] = Math.cos(s0) - k * (Math.cos(sj) * cr - Math.sin(sj) * ci); wi[n] = Math.sin(s0) - k * (Math.cos(sj) * ci + Math.sin(sj) * cr); }
  return {wr, wi}; }
function patW(w, s, step){ const N = w.wr.length, th = [], p = []; for (let t = -90; t <= 90.0001; t += step || 0.2){ const u = Math.sin(t * RAD); let re = 0, im = 0; for (let n = 0; n < N; n++){ const x = 2 * Math.PI * s * (n - (N - 1) / 2) * u; re += w.wr[n] * Math.cos(x) + w.wi[n] * Math.sin(x); im += w.wr[n] * Math.sin(x) - w.wi[n] * Math.cos(x); } th.push(t); p.push((re * re + im * im) / (N * N) * Math.max(0, Math.cos(t * RAD))); } return {th, p}; }
function respW(w, s, t){ const N = w.wr.length, u = Math.sin(t * RAD); let re = 0, im = 0; for (let n = 0; n < N; n++){ const x = 2 * Math.PI * s * (n - (N - 1) / 2) * u; re += w.wr[n] * Math.cos(x) + w.wi[n] * Math.sin(x); im += w.wr[n] * Math.sin(x) - w.wi[n] * Math.cos(x); } return (re * re + im * im) / (N * N); }
function polarXY(th, db, flo){ const x = [], y = []; for (let i = 0; i < th.length; i++){ const r = Math.max(0, (db[i] - flo) / -flo); x.push(r * Math.sin(th[i] * RAD)); y.push(r * Math.cos(th[i] * RAD)); } return {x, y}; }
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note}), ph0 = N => new Float64Array(N);
  { const a = weights(2, 'uni'), v = fieldU(a, ph0(2), 1, 0, 0.5) / 4, v2 = Math.pow(Math.cos(Math.PI * 1 * 0.25), 2); add('式13.1：2 素子（間隔 1 波長）のパターン。θ = 30° と 14.48°（sinθ = 0.25）', '|cos(π(s/λ)sinθ)|² = 0 と 0.5', sci(v + 1e-40, 0) + ' と ' + fx(fieldU(a, ph0(2), 1, 0, 0.25) / 4, 4), v < 1e-20 && Math.abs(fieldU(a, ph0(2), 1, 0, 0.25) / 4 - v2) < 1e-12 ? 'ok' : 'ng', '式13.1（p.13.10）。素子ごとの和を直接計算した値'); }
  { const N = 10, s = 0.5, u = 0.37, a = weights(N, 'uni'), d = fieldU(a, ph0(N), s, 0, u) / (N * N), f = Math.pow(Math.sin(N * Math.PI * s * u) / (N * Math.sin(Math.PI * s * u)), 2); add('式13.2：アレイファクタ（10 素子、半波長間隔、sinθ = 0.37）', fx(f, 6), fx(d, 6), near(d, f, 1e-12), '式13.2（p.13.11）'); }
  { const N = 200, s = 0.5, m = mainLobe(weights(N, 'uni'), ph0(N), s, 0, 0); add('式13.5：一様な重み付けのビーム幅と第 1 サイドローブ（200 素子、開口 100 波長）', '50.8°/(a/λ) = 0.508°、−13.3 dB', fx(m.bwDeg, 3) + '°、' + fx(m.sl, 2) + ' dB', Math.abs(m.bwDeg - 0.508) < 0.003 && Math.abs(m.sl + 13.3) < 0.1 ? 'ok' : 'ng', '式13.5（p.13.12）'); }
  add('式13.9：グレーティングローブが生じない素子間隔の上限。走査 90°／60°／45°', '0.5／0.53／0.59 波長', fx(glLimit(90), 3) + '／' + fx(glLimit(60), 3) + '／' + fx(glLimit(45), 3) + ' 波長', Math.abs(glLimit(60) - 0.53) < 0.01 && Math.abs(glLimit(45) - 0.59) < 0.01 ? 'ok' : 'ng', '式13.9（p.13.13）。ハンドブックの 0.53 は 0.536 を切り捨てた値');
  { const N = 24, s = 0.8, th0 = 30, g = glAngles(s, th0)[0], m = mainLobe(weights(N, 'uni'), phases(N, s, th0, 0), s, 0, Math.sin(g * RAD)); add('式13.10：グレーティングローブの方向（素子間隔 0.8 波長、30° に走査）', fx(g, 2) + '°', fx(Math.asin(m.up) / RAD, 2) + '°（パターンのピークを探索した値。レベルはメインビームの ' + fx(m.pk / (N * N) * 100, 0) + '%）', Math.abs(Math.asin(m.up) / RAD - g) < 0.05 ? 'ok' : 'ng', '式13.10（p.13.13）。素子パターンを掛ける前のアレイファクタ'); }
  { const N = 32, s = 0.5, b0 = mainLobe(weights(N, 'uni'), ph0(N), s, 0, 0).bwDeg, t = []; let ok = true; for (const th0 of [30, 45, 60]){ const m = mainLobe(weights(N, 'uni'), phases(N, s, th0, 0), s, 0, Math.sin(th0 * RAD)), f = b0 / Math.cos(th0 * RAD); t.push(th0 + '°：' + fx(m.bwDeg, 2) + '°（式 ' + fx(f, 2) + '°）'); if (Math.abs(m.bwDeg / f - 1) > 0.03) ok = false; }
    add('走査した場合のビーム幅（32 素子、正面で ' + fx(b0, 2) + '°）', '正面のビーム幅 ÷ cosθ₀', t.join('、'), ok ? 'ok' : 'info', '本文（p.13.3）。パターンから数値で求めた 3 dB 幅。60° では式よりわずかに広い（式は近似）'); }
  { const p = pat({n: 32, s: 0.5, th0: 60, wt: 'uni', step: 0.02}); let pk = 0; for (const v of p.p) if (v > pk) pk = v; add('式13.19：60° に走査した場合の利得の低下', 'cos 60° = 0.5（−3.0 dB）', fx(10 * Math.log10(pk), 2) + ' dB（素子パターンを掛けたパターンのピーク）', Math.abs(10 * Math.log10(pk) + 3.01) < 0.2 ? 'ok' : 'ng', '式13.14・13.19（p.13.14）'); }
  { const T = [['uni', 1, -13.3, 50.8], ['cos', 0.81, -23, 68.2], ['han', 0.67, -32, 82.5], ['ham', 0.73, -43, 74.2], ['tay', 0.8, -36, 67.5]]; const N = 120, s = 0.5; let ok = true; const t1 = [], t2 = [];
    for (const r of T){ const a = weights(N, r[0]), m = mainLobe(a, ph0(N), s, 0, 0), e = effOf(a), k = m.bwDeg * N * s; t1.push(WT[r[0]].n + '：' + r[1] + '／' + r[2] + '／' + r[3]); t2.push(fx(e, 2) + '／' + fx(m.sl, 1) + '／' + fx(k, 1)); if (Math.abs(e - r[1]) > 0.015 || Math.abs(m.sl - r[2]) > 1.5 || Math.abs(k - r[3]) > 1.5) ok = false; }
    add('表13.1：重み付けごとの効率 η／ピークサイドローブ [dB]／ビーム幅の係数 k', t1.join('；'), t2.join('；'), ok ? 'ok' : 'info', '表13.1（p.13.29）。120 素子・半波長間隔のアレイで数値計算。テイラーは n̄ = 5、設計値 −36 dB。差はサイドローブ 0.5 dB 以内、係数 k は 1.2 以内'); }
  { const N = 100, s = 0.5, a = weights(N, 'ham'), sg = 0.2, g = gaussGen(41); let acc = 0, cnt = 0; const base = scanU(a, ph0(N), s, 0, 0.3, 1, 350);
    for (let tr = 0; tr < 60; tr++){ const ph = new Float64Array(N); for (let n = 0; n < N; n++) ph[n] = sg * g(); const q = scanU(a, ph, s, 0, 0.3, 1, 350), pk = fieldU(a, ph, s, 0, 0); for (let i = 0; i < q.ps.length; i++){ acc += q.ps[i] / pk; cnt++; } }
    let b = 0; for (const v of base.ps) b += v / fieldU(a, ph0(N), s, 0, 0); const ms = acc / cnt - b / base.ps.length, f = sg * sg / (effOf(a) * N * (1 - sg * sg));
    add('式13.22：ランダムな位相誤差（rms 0.2 rad）による平均サイドローブレベル（100 素子、ハミング）', fx(10 * Math.log10(f), 1) + ' dB', fx(10 * Math.log10(ms), 1) + ' dB（60 通りの乱数。設計上のサイドローブの寄与を引いた値）', Math.abs(10 * Math.log10(ms / f)) < 0.8 ? 'ok' : 'info', '式13.22（p.13.30）'); }
  { const t = [], N = 64, s = 0.5; let ok = true; for (const P of [2, 3, 4]){ let sum = 0, c = 0; for (let th0 = 2.3; th0 < 60; th0 += 1.7){ const a = weights(N, 'uni'), id = fieldU(a, phases(N, s, th0, 0), s, 0, Math.sin(th0 * RAD)), m = mainLobe(a, phases(N, s, th0, P), s, 0, Math.sin(th0 * RAD), true); sum += m.pk / id; c++; } const L = -10 * Math.log10(sum / c); t.push(P + ' ビット：' + fx(L, 2) + ' dB'); if (Math.abs(L - quantLoss(P)) > 0.12) ok = false; }
    add('式13.25：移相器の量子化による利得の低下。2／3／4 ビット', '1.0／0.23／0.06 dB', t.join('、') + '（64 素子、34 通りの走査角の平均）', ok ? 'ok' : 'info', '式13.23〜13.25（p.13.34）'); }
  { const t = [], N = 128, s = 0.5, th0 = 1.3; let ok = true; for (const P of [3, 4, 5, 6]){ const a = weights(N, 'ham'), m = mainLobe(a, phases(N, s, th0, P), s, 0, Math.sin(th0 * RAD), true), g = scanU(a, phases(N, s, th0, P), s, 0, -1, 1, 5000); let sl = 0; for (let i = 0; i < g.us.length; i++) if (Math.abs(g.us[i] - m.up) > 6 / (N * s) && g.ps[i] > sl) sl = g.ps[i]; const d = 10 * Math.log10(sl / m.pk); t.push(P + ' ビット：' + fx(d, 1) + ' dB'); if (Math.abs(d + 6.02 * P) > 2.5) ok = false; }
    add('図13.23：位相の量子化によるピークのローブ（小さい走査角、誤差が三角波になる場合）。3／4／5／6 ビット', '−18／−24／−30／−36 dB', t.join('、') + '（128 素子、1.3° に走査、ハミング）', ok ? 'ok' : 'info', '図13.23（p.13.37）。図の読み取り値'); }
  { const N = 64, s = 0.5, t = []; let ok = true; for (const th0 of [30, 60]){ const m = mainLobe(weights(N, 'uni'), phases(N, s, th0, 0), s, 0.01, Math.sin(th0 * RAD)), d = Math.asin(m.up) / RAD - th0, f = squint(0.01, th0); t.push(th0 + '°：' + fx(d, 3) + '°（式 ' + fx(f, 3) + '°）'); if (Math.abs(d / f - 1) > 0.03) ok = false; }
    add('式13.26：周波数を 1% 上げた場合のビームの方向の変化（移相器の設定は変えない）', 'Δθ₀ = −(Δf/f)·tanθ₀', t.join('、'), ok ? 'ok' : 'ng', '式13.26（p.13.39）'); }
  { const b = 2, df = (b / Math.cos(60 * RAD) / 4) * RAD / Math.tan(60 * RAD); add('帯域の基準：60° 走査でビームの方向の誤差が走査したビーム幅の ±1/4 になる周波数の幅（正面のビーム幅 2° の場合）', '帯域 [%] = ビーム幅 [度] → 2%', fx(2 * df * 100, 2) + '%', Math.abs(2 * df * 100 - 2) < 0.1 ? 'ok' : 'ng', '本文（p.13.39）。式13.26 から計算'); }
  { const N = 16, s = 0.5, w = nullW(N, s, 0, 25, 1e5), q = nullW(N, s, 0, 25, 0); add('ヌルの形成の例：16 素子、正面を向いたビーム、25° の方向の妨害（妨害対雑音比 50 dB）', '（ハンドブックに数値例なし。自由度は受信機の数 − 1）', '妨害の方向の応答：適応前 ' + fx(10 * Math.log10(respW(q, s, 25)), 1) + ' dB → 適応後 ' + fx(10 * Math.log10(respW(w, s, 25) + 1e-30), 1) + ' dB。正面の利得の変化 ' + fx(10 * Math.log10(respW(w, s, 0) / respW(q, s, 0)), 2) + ' dB', 'ref', '補足（ステップ 9 の計算の確認）。係数は w = R⁻¹·s の形'); }
  return R;
}
