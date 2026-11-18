/* ============================================================
   第10回 レーダ断面積（RCS）：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第14章 Radar Cross Section（p.14.1–14.46）
   簡略化：金属球はミー級数（厳密解）。平板は物理光学の式（式14.14。正面から 30° 以内で有効）。
           複雑な目標は「点の反射点の集まり」で表し、反射点どうしの影や多重反射は考えない。
           吸収材はサリスバリースクリーン（垂直に入る波、抵抗膜 377 Ω）の伝送線路モデル。
   ============================================================ */
const RAD = Math.PI / 180, C0 = 299792458;
const DEFAULTS = {sig: 0, Ls: 0.3, lk: -0.5, dsep: 0.3, D: 2, tilt: 0, ns: 6, Lt: 1, f: 3};
const S = Object.assign({}, DEFAULTS);
function sphJY(x, N){      // 球ベッセル関数 j_n、y_n（n = 0〜N）。j は下向きの漸化式、y は上向き
  const j = new Float64Array(N + 2), y = new Float64Array(N + 2), M = N + 30 + Math.ceil(x); let a = 0, b = 1e-30; const t = new Float64Array(M + 2); t[M + 1] = 0; t[M] = b;
  for (let n = M; n >= 1; n--){ t[n - 1] = (2 * n + 1) / x * t[n] - t[n + 1]; if (Math.abs(t[n - 1]) > 1e250){ for (let q = n - 1; q <= M; q++) t[q] *= 1e-250; } }
  const j0 = Math.sin(x) / x, j1 = Math.sin(x) / (x * x) - Math.cos(x) / x, sc = Math.abs(t[0]) > Math.abs(t[1]) ? j0 / t[0] : j1 / t[1]; for (let n = 0; n <= N + 1; n++) j[n] = t[n] * sc;
  y[0] = -Math.cos(x) / x; y[1] = -Math.cos(x) / (x * x) - Math.sin(x) / x; for (let n = 1; n <= N; n++) y[n + 1] = (2 * n + 1) / x * y[n] - y[n - 1];
  return {j, y};
}
function mieSphere(x){      // 金属球の RCS ÷ πa²（x = ka）
  const N = Math.ceil(x + 4 * Math.cbrt(x) + 3), b = sphJY(x, N); let sr = 0, si = 0;
  for (let n = 1; n <= N; n++){ const jn = b.j[n], yn = b.y[n], dj = x * b.j[n - 1] - n * jn, dy = x * b.y[n - 1] - n * yn;      // a_n = j/h、b_n = (x j)'/(x h)'、h = j + i y
    const d1 = jn * jn + yn * yn, ar = jn * jn / d1, ai = -jn * yn / d1, d2 = dj * dj + dy * dy, br = dj * dj / d2, bi = -dj * dy / d2, s = (n % 2 ? -1 : 1) * (2 * n + 1); sr += s * (ar - br); si += s * (ai - bi); }
  return (sr * sr + si * si) / (x * x);
}
const sinc = x => Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x;
const plateRcs = (A, l, lam, th) => 4 * Math.PI * Math.pow(A * Math.cos(th) / lam * sinc(2 * Math.PI / lam * l * Math.sin(th)), 2);      // 式14.14
const plateEnv = (A, l, lam, th) => { const x = 2 * Math.PI / lam * l * Math.sin(th); return 4 * Math.PI * Math.pow(A * Math.cos(th) / lam, 2) * (Math.abs(x) < 1 ? 1 : 1 / (x * x)); };   // 山をつないだ線（包絡線）
function besselJ1(x){ let s = 0; const n = 400; for (let i = 0; i < n; i++){ const t = Math.PI * (i + 0.5) / n; s += Math.cos(t - x * Math.sin(t)); } return s / n; }
const diskRcs = (A, d, lam, th) => { const x = 2 * Math.PI / lam * d * Math.sin(th); return 16 * Math.PI * Math.pow(A * Math.cos(th) / lam * (Math.abs(x) < 1e-6 ? 0.5 : besselJ1(x) / x), 2); };   // 式14.15
const SHAPES = {      // 表14.1。L：代表の大きさ [m]
  sph: {n: '球（直径 L）', f: (L, lam) => Math.PI * L * L / 4},
  cyl: {n: '円柱（長さ L、直径 L/2。真横から）', f: (L, lam) => 2 * Math.PI * (L / 4) * L * L / lam},
  plt: {n: '正方形の平板（一辺 L。正面から）', f: (L, lam) => 4 * Math.PI * Math.pow(L, 4) / (lam * lam)},
  tri: {n: '三角コーナーリフレクタ（開口の辺 L）', f: (L, lam) => Math.PI * Math.pow(L, 4) / (3 * lam * lam)}
};
const shipRcs = (fMHz, Dkt) => 52 * Math.sqrt(fMHz) * Math.pow(Dkt, 1.5);      // 式14.3
function scatterers(n, L, seed){ const r = mulberry32(4000 + seed), a = []; for (let i = 0; i < n; i++) a.push({x: n === 2 ? (i - 0.5) * L : (r() - 0.5) * L, a: n === 2 ? 1 : 0.5 + r()}); if (n > 2){ a[0].x = -L / 2; a[1].x = L / 2; } return a; }
function rcsOf(sc, lam, th){ let re = 0, im = 0; const k2 = 4 * Math.PI / lam * Math.sin(th); for (const s of sc){ re += s.a * Math.cos(k2 * s.x); im += s.a * Math.sin(k2 * s.x); } return re * re + im * im; }      // 往復なので位相は 2k·x·sinθ
function pattern(sc, lam, a0, a1, n){ const th = [], v = []; for (let i = 0; i <= n; i++){ const t = a0 + (a1 - a0) * i / n; th.push(t); v.push(rcsOf(sc, lam, t * RAD)); } return {th, v}; }
function peakStats(p){ let np = 0, sum = 0, mx = 0, mn = Infinity, f = NaN, l = NaN; for (let i = 0; i < p.v.length; i++){ sum += p.v[i]; mx = Math.max(mx, p.v[i]); mn = Math.min(mn, p.v[i]); if (i > 0 && i < p.v.length - 1 && p.v[i] > p.v[i - 1] && p.v[i] >= p.v[i + 1]){ np++; if (np === 1) f = p.th[i]; l = p.th[i]; } } const mean = sum / p.v.length; let below = 0; for (const x of p.v) if (x < mean / 10) below++;
  return {np, mean, mx, mn, spacing: np > 1 ? (l - f) / (np - 1) : NaN, below: below / p.v.length}; }
const farField = (D, lam) => 2 * D * D / lam;                                  // 式14.20
const salisbury = fr => { const x = Math.PI / 2 * fr, c = Math.cos(x) / Math.sin(x); return c * c / (4 + c * c); };      // 反射される電力の割合。fr = 周波数 ÷ 設計周波数
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  { const a = mieSphere(30), b = mieSphere(60), c = mieSphere(100); add('式14.2：光学領域の金属球の RCS（ka = 30／60／100 でのミー級数）', 'σ = πa²（σ/πa² = 1）', fx(a, 3) + '／' + fx(b, 3) + '／' + fx(c, 3), Math.abs(a - 1) < 0.05 && Math.abs(c - 1) < 0.02 ? 'ok' : 'ng', '式14.2（p.14.6）、図14.2'); }
  { const a = mieSphere(0.1), b = mieSphere(0.2); add('レイリー領域：ka を 2 倍にしたときの σ/πa² の増え方（ka = 0.1 → 0.2）', '4 乗（16 倍）で増える', fx(b / a, 1) + ' 倍（σ/πa² = ' + sci(a, 2) + ' → ' + sci(b, 2) + '。9·(ka)⁴ の ' + fx(a / (9e-4), 2) + ' 倍）', Math.abs(b / a - 16) < 0.8 ? 'ok' : 'ng', '本文（p.14.5、p.14.20）。9·(ka)⁴ は補足'); }
  { let bx = 0, bv = 0, mx = 0, mv = 9; for (let x = 0.5; x <= 3; x += 0.005){ const v = mieSphere(x); if (v > bv){ bv = v; bx = x; } } for (let x = 1.2; x <= 2.5; x += 0.005){ const v = mieSphere(x); if (v < mv){ mv = v; mx = x; } }
    add('図14.2：共振領域の最初の山と、次の谷', '山は ka ≈ 1 で 約 3.6、谷は ka ≈ 1.7 で 約 0.28（図の読み取り）', '山：ka = ' + fx(bx, 2) + ' で ' + fx(bv, 2) + '、谷：ka = ' + fx(mx, 2) + ' で ' + fx(mv, 2), Math.abs(bv - 3.6) < 0.2 && Math.abs(mv - 0.28) < 0.05 ? 'ok' : 'info', '図14.2（p.14.5）。図の読み取りなので、誤差を含む'); }
  { const lam = 0.03, A = 0.25, l = 0.5, a = plateRcs(A, l, lam, 0), b = 4 * Math.PI * A * A / (lam * lam), d = diskRcs(A, Math.sqrt(4 * A / Math.PI), lam, 1e-9); add('式14.14・14.15：正面から見た平板と円板（面積 0.25 m²、波長 3 cm）', '表14.1 の 4πA²/λ² = ' + fx(b, 1) + ' m² と同じになる', '平板 ' + fx(a, 1) + ' m²、円板 ' + fx(d, 1) + ' m²', Math.abs(a / b - 1) < 1e-6 && Math.abs(d / b - 1) < 1e-3 ? 'ok' : 'ng', '式14.13〜14.15 と本文（p.14.22）、表14.1（p.14.10）'); }
  { const lam = C0 / 790e6, L = 96 * 0.0254, s = plateRcs(L * L, L, lam, 0); add('図14.7 の平板（一辺 96 インチ、790 MHz）の正面の RCS', '（図の説明：表14.1 の平板の式でよく予測できる）', fx(s, 0) + ' m²（' + fx(db10(s), 1) + ' dBsm）', 'ref', '表14.1 と本文（p.14.9）。図の縦軸の値は読み取っていない'); }
  { const lam = 0.03, l = 0.5, hw = f => { let lo = 0, hi = 0.1; for (let i = 0; i < 60; i++){ const m = (lo + hi) / 2; if (f(m) > 0.5) lo = m; else hi = m; } return 2 * lo / RAD; }, e = hw(t => Math.pow(sinc(2 * Math.PI / lam * l * Math.sin(t)), 2)), an = hw(t => Math.pow(sinc(Math.PI / lam * l * Math.sin(t)), 2));
    add('平板のエコーのローブの幅（長さ 0.5 m、波長 3 cm）', '同じ大きさのアンテナのビーム幅の半分', 'エコー ' + fx(e, 3) + '°、アンテナ（片道）' + fx(an, 3) + '°（比 ' + fx(e / an, 3) + '）', Math.abs(e / an - 0.5) < 0.01 ? 'ok' : 'ng', '本文（p.14.9）。往復なので、位相の変化が 2 倍になる'); }
  { const L = 24 * 0.0254, lam = 0.0125, a = Math.PI * Math.pow(L, 4) / (3 * lam * lam), Ae = L * L / (2 * Math.sqrt(3)), b = 4 * Math.PI * Ae * Ae / (lam * lam); add('三角コーナーリフレクタの軸上の RCS（図14.8 の例：開口の辺 24 インチ、波長 1.25 cm）', 'πL⁴/(3λ²) = ' + fx(a, 0) + ' m²', '表14.1 の 4πAeff²/λ²（Aeff = L²/(2√3)）= ' + fx(b, 0) + ' m²（' + fx(db10(b), 1) + ' dBsm）', Math.abs(a / b - 1) < 1e-9 ? 'ok' : 'ng', '本文と表14.1（p.14.10）。2 つの式が同じ値になることの確認'); }
  { add('縮尺模型の換算：1/3 模型の RCS から実物の RCS へ', '10·log(3×3) = 9.5 dB 高い', fx(10 * Math.log10(9), 2) + ' dB', 'ok', '本文（p.14.13）'); }
  { const s = shipRcs(3000, 10); add('式14.3：艦船の RCS の経験式（3000 MHz、満載排水量 10 キロトンの場合）', 'σ = 52·f^(1/2)·D^(3/2)（数値例なし）', sci(s, 1) + ' m²（' + fx(db10(s), 1) + ' dBsm）', 'ref', '式14.3（p.14.14）。図14.14 の船の位置（10⁴ m² 前後）と同じ桁'); }
  { const D = 1, lam = 0.03, Rr = farField(D, lam), ph = 2 * Math.PI / lam * (Math.sqrt(Rr * Rr + D * D / 4) - Rr) / RAD; add('式14.20：遠方界の距離 R = 2D²/λ での、目標の端と中心の位相のずれ', '22.5° 未満が基準', fx(ph, 2) + '°（D = 1 m、波長 3 cm、R = ' + fx(Rr, 1) + ' m）', Math.abs(ph - 22.5) < 0.1 ? 'ok' : 'ng', '式14.20 と本文（p.14.27）。道のりの差 D²/(8R) = λ/16'); }
  { add('背景の反射が目標と同じ強さで、同位相のときの測定値', '4 倍（+6 dB）', fx(20 * Math.log10(2), 2) + ' dB', 'ok', '本文（p.14.28、図14.21）'); }
  { let lo = 1, hi = 1; while (salisbury(lo) <= 0.01) lo -= 0.0005; while (salisbury(hi) <= 0.01) hi += 0.0005; add('サリスバリースクリーンの帯域（反射が −20 dB 以下の範囲）', '25% 程度', fx((hi - lo) * 100, 1) + '%（設計周波数の ' + fx(lo, 3) + '〜' + fx(hi, 3) + ' 倍）', Math.abs((hi - lo) - 0.25) < 0.02 ? 'ok' : 'info', '本文（p.14.36）。377 Ω の抵抗膜を 1/4 波長の位置に置いた伝送線路モデル（垂直に入る波）'); }
  { const lam = 0.03, d = 1, p = pattern(scatterers(2, d, 1), lam, -5, 5, 4000), st = peakStats(p), f = lam / (2 * d) / RAD; add('2 つの反射点（間隔 1 m、波長 3 cm）の RCS の山の間隔（角度）', '（この章に式なし）λ/(2d) = ' + fx(f, 3) + '°', fx(st.spacing, 3) + '°（±5° の範囲の山の数 ' + st.np + ' から）。山の高さは 1 点の ' + fx(st.mx, 2) + ' 倍', Math.abs(st.spacing / f - 1) < 0.08 ? 'ref' : 'ng', '補足：2 つの波の干渉の一般的な関係。平板の式14.14 の最初のヌル（sinθ = λ/(2ℓ)）と同じ形'); }
  { const sc = scatterers(12, 5, 3), p = pattern(sc, 0.03, -30, 30, 20000), st = peakStats(p); let ss = 0; for (const s of sc) ss += s.a * s.a; add('反射点 12 個の目標（長さ 5 m、波長 3 cm）：向きを変えたときの RCS の平均と、平均の 1/10 より小さくなる割合', '（この章に数値なし）平均は各点の RCS の和。指数分布なら 9.5%', '平均 ÷ 和 = ' + fx(st.mean / ss, 2) + '、割合 ' + fx(st.below * 100, 1) + '%', 'ref', '補足：第4回の Swerling モデル（ケース 1・2 は指数分布）とのつながりの確認'); }
  return R;
}
