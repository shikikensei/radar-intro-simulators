/* ============================================================
   第9回 電波の伝わり方（伝搬）：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第26章 The Propagation Factor, Fp, in the Radar Equation（p.26.1–26.28）
   簡略化：直接波と海面反射波の 2 つの波の干渉だけを扱う（等価地球半径の球面上）。
           海面の反射係数は一定で、反射で位相が 180° 変わるとする。回折・発散係数・大気による減衰・アンテナパターンは省略。
           見通し外は計算しない（影として表示）。ダクトは、平らに直した座標での光線の作図（概念的な表示）。
   ============================================================ */
const RAD = Math.PI / 180, C0 = 299792458, AE0 = 6371e3;
const DEFAULTS = {F: 0, dn: -39, h1: 20, h2: 10, ht: 100, f: 3, rho: 0.9, R: 20, td: 0};
const S = Object.assign({}, DEFAULTS);
const kOf = dn => { const d = 1 + AE0 * dn * 1e-9; return d > 1e-6 ? 1 / d : Infinity; };          // 式26.16。dn：屈折度の勾配 [N/km]
const horiz = (h, k) => Math.sqrt(2 * k * AE0 * Math.max(0, h));                                    // 水平線までの距離 [m]
const lfs = (fMHz, rkm) => 32.45 + 20 * Math.log10(fMHz) + 20 * Math.log10(rkm);                    // 式26.12
const lfsExact = (fMHz, rkm) => 20 * Math.log10(4 * Math.PI * rkm * 1000 / (C0 / (fMHz * 1e6)));    // 式26.11
function condOf(dn){ return dn > 0 ? 'サブリフラクション' : dn >= -79 ? (dn === -39 ? '標準' : '正常') : dn >= -157 ? 'スーパーリフラクション' : 'トラッピング'; }   // 表26.1
function twoRay(h1, h2, G, lam, rho, k){      // h1：アンテナの高さ、h2：目標の高さ、G：地表に沿った距離 [m]、k：等価地球半径係数
  const ae = k * AE0; if (G > horiz(h1, k) + horiz(h2, k)) return {vis: false, F: 0};
  const p = 2 / Math.sqrt(3) * Math.sqrt(ae * (h1 + h2) + G * G / 4), xi = Math.asin(Math.max(-1, Math.min(1, 2 * ae * G * (h2 - h1) / (p * p * p)))), G1 = G / 2 - p * Math.sin(xi / 3), G2 = G - G1;
  const a = Math.max(0, h1 - G1 * G1 / (2 * ae)), b = Math.max(0, h2 - G2 * G2 / (2 * ae)), del = Math.sqrt(G * G + (a + b) * (a + b)) - Math.sqrt(G * G + (b - a) * (b - a)), ph = 2 * Math.PI * del / lam + Math.PI;
  return {vis: true, F: Math.sqrt(1 + rho * rho + 2 * rho * Math.cos(ph)), del, ph, G1, psi: Math.atan2(a, G1), psi2: Math.atan2(b, G2)};
}
const fdb = F => 20 * Math.log10(Math.max(1e-3, F));
const lobeAng = (n, lam, h1) => Math.asin(Math.min(1, (2 * n - 1) * lam / (4 * h1))) / RAD;         // n 番目のローブの仰角 [度]（平らな海面）
const nullAng = (n, lam, h1) => Math.asin(Math.min(1, n * lam / (2 * h1))) / RAD;
function coverage(o){      // 距離 × 高度の伝搬因子 [dB]。見通し外は NaN。ローブが 1 マスより細かい所は、平均の電力（1 + ρ²）に近づける（細かすぎるローブによる模様を防ぐ）
  const db = new Float32Array(o.rows * o.cols), dh = o.hmax / o.rows, dG = o.rmax / o.cols, mean = 1 + o.rho * o.rho;
  for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++){ const G = dG * (c + 0.5), h = dh * (r + 0.5), cyc = Math.max(2 * o.h1 * dh / (G * o.lam), 2 * o.h1 * h * dG / (G * G * o.lam)), w = Math.max(0, Math.min(1, (0.45 - cyc) / 0.25)); let s = 0, n = 0;
    for (let q = 0; q < 3; q++){ const t = twoRay(o.h1, dh * (r + (q + 0.5) / 3), G, o.lam, o.rho, 4 / 3); if (t.vis){ s += t.F * t.F; n++; } }
    db[r * o.cols + c] = n ? 10 * Math.log10(Math.max(1e-6, w * s / n + (1 - w) * mean)) : NaN; }
  return db;
}
const DUCT = {g: 0.25, std: 0.118, h0: 10};      // ダクトの中の M の減り方 0.25 M/m、標準大気 +0.118 M/m、アンテナの高さ 10 m
const lmaxDuct = (dM, t) => dM > 0 ? 2.5e-3 * Math.sqrt(dM) * t : 0;                                // 式26.7 を ΔM（ダクトの中での M の減少）で書いた形
const critAng = dM => Math.sqrt(2e-6 * Math.max(0, dM)) / RAD;                                      // 閉じ込められる角度の上限 [度]
function ductRays(t, angs, xmax){      // 平らに直した座標での光線。d²h/dx² = dM/dh × 10⁻⁶
  const out = [], dx = 250, n = Math.round(xmax / dx);
  for (const a of angs){ let h = DUCT.h0, v = Math.tan(a * RAD), top = h; const x = [0], y = [h];
    for (let i = 0; i < n; i++){ const gr = (h < t ? -DUCT.g : DUCT.std) * 1e-6; v += gr * dx; h += v * dx; if (h < 0){ h = -h; v = -v; } if (h > top) top = h; if (i % 2 === 1){ x.push((i + 1) * dx / 1000); y.push(h); } }
    out.push({a, x, y, trapped: t > 0 && top <= t + 0.5, hend: h}); }
  return out;
}
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  { const k = kOf(-39); add('式26.16：等価地球半径係数 k（地球の半径 6371 km、屈折度の勾配 −39 N/km）', '1.33（約 4/3）', fx(k, 4), Math.abs(k - 1.33) < 0.005 ? 'ok' : 'ng', '式26.15・26.16 と本文（p.26.15）'); }
  { add('式26.5：標準の勾配 −39 N/km を M 単位に換算（M = N + 0.157 h）', '+118 M/km', fx(-39 + 157, 0) + ' M/km', 'ok', '式26.5 と本文（p.26.4）'); }
  { add('式26.6：M への換算係数（高度をフィートで表す場合）', '0.048 /ft', fx(0.157 * 0.3048, 4) + ' /ft', Math.abs(0.157 * 0.3048 - 0.048) < 0.0005 ? 'ok' : 'ng', '式26.6（p.26.4）。0.157 /m × 0.3048 m'); }
  { const kc = 1 + AE0 * -157 * 1e-9; add('表26.1：トラッピングの境界（電波の曲率が地球の曲率と等しくなる勾配）', '−157 N/km（M の勾配 0）', '1 + a·dn/dh = ' + fx(kc, 4) + '（ほぼ 0 → k が無限大）。地球の曲率 1/a = ' + fx(1e9 / AE0, 1) + ' ×10⁻⁹ /m', Math.abs(kc) < 0.001 ? 'ok' : 'ng', '表26.1（p.26.7）、臨界勾配の説明（p.26.7）'); }
  { const a = lfs(3000, 100), b = lfsExact(3000, 100); add('式26.12：自由空間の伝搬損失（3000 MHz、100 km）', fx(a, 2) + ' dB（式26.12）', fx(b, 2) + ' dB（式26.11 の (4πr/λ)² から計算）', Math.abs(a - b) < 0.01 ? 'ok' : 'ng', '式26.11・26.12（p.26.14）。定数 32.45 の確認'); }
  { const lam = 0.1; let mx = 0, mn = 9; for (let h = 5; h <= 600; h += 0.25){ const t = twoRay(20, h, 20000, lam, 1, 4 / 3); if (t.vis){ mx = Math.max(mx, t.F); mn = Math.min(mn, t.F); } } let mn9 = 9; for (let h = 5; h <= 600; h += 0.25){ const t = twoRay(20, h, 20000, lam, 0.9, 4 / 3); if (t.vis) mn9 = Math.min(mn9, t.F); }
    add('直接波と海面反射波の干渉による受信強度の変化（自由空間との比）', '最大で 6 dB 上、20 dB 以上下', '最大 +' + fx(fdb(mx), 2) + ' dB（反射係数 1）、最小 ' + fx(fdb(mn9), 1) + ' dB（反射係数 0.9）、反射係数 1 の場合 ' + (mn < 0.002 ? '−50 dB 以下' : fx(fdb(mn), 0) + ' dB'), Math.abs(fdb(mx) - 6.02) < 0.01 && fdb(mn9) <= -19.9 ? 'ok' : 'ng', '本文（p.26.5）。電界が 2 倍で +6.02 dB、0.1 倍で −20 dB'); }
  { const h1 = 20, lam = 0.1, G = 20000, k = 1e6, pk = []; let pv = 0, pp = 0; for (let h = 1; h <= 400; h += 0.05){ const F = twoRay(h1, h, G, lam, 0.9, k).F; if (pp < pv && F < pv) pk.push(Math.atan2(h - 0.05, G) / RAD); pp = pv; pv = F; }
    const f = [1, 2, 3].map(n => lobeAng(n, lam, h1)); add('ローブの仰角（アンテナ高 20 m、波長 10 cm、平面の海面）：下から 1〜3 番目', '（この章に式なし）sinθ = (2n − 1)·λ/(4·h₁)：' + f.map(v => fx(v, 4) + '°').join('、'), pk.slice(0, 3).map(v => fx(v, 4) + '°').join('、') + '（計算した伝搬因子のピークの位置）', pk.length >= 3 && f.every((v, i) => Math.abs(v - pk[i]) < 0.004) ? 'ref' : 'ng', '補足：2 波干渉の一般的な式。仰角はアンテナの真下の海面から測った角度（距離 20 km）。図26.2 のローブとヌルの構造に対応'); }
  { const d1 = horiz(20, 4 / 3) / 1000, d0 = horiz(20, 1) / 1000; add('見通し距離（アンテナ高 20 m、海面の目標）', '（この章に式なし）√(2·k·a·h)。k = 4/3 で 4.12·√h [km]', 'k = 4/3：' + fx(d1, 2) + ' km（4.12√h = ' + fx(4.12 * Math.sqrt(20), 2) + ' km）、k = 1：' + fx(d0, 2) + ' km（3.57√h）', Math.abs(d1 - 4.12 * Math.sqrt(20)) < 0.05 ? 'ref' : 'ng', '補足：等価地球半径（式26.15）を使った一般的な式。レーダ水平線の説明は p.26.5'); }
  { let ok = true, t = []; for (const [h2, G] of [[100, 20000], [500, 60000], [2000, 100000]]){ const r = twoRay(20, h2, G, 0.1, 0.9, 4 / 3); t.push(fx(r.psi / RAD, 4) + '°／' + fx(r.psi2 / RAD, 4) + '°'); if (Math.abs(r.psi - r.psi2) > 2e-5) ok = false; }
    add('球面上の反射点の計算（入射角 = 反射角になっているか）：3 つの配置', '（この章に式なし）2 つの角度が等しい', t.join('、'), ok ? 'ref' : 'ng', '補足：等価地球半径の球面での反射点を求める一般的な方法（3 次方程式の解）'); }
  { const dM = 5, t = 20, a = lmaxDuct(dM, t), dN = dM + 0.157 * t, h = dN / t - 0.57; add('式26.7：ダクトが捕捉する最大波長（厚さ 20 m、ダクトの中での M の減少 5）', 'λmax = 2.5×10⁻³·(δN/t − 0.57)^0.5·t^1.5 → ' + (h > 0 ? fx(2.5e-3 * Math.sqrt(h) * Math.pow(t, 1.5), 3) + ' m' : '括弧の中が負（δN/t = ' + fx(dN / t, 3) + '）であり計算できない'), fx(a, 3) + ' m（0.57 の代わりに 0.157 を使った場合。= 2.5×10⁻³·√ΔM·t）', 'info', '式26.7（p.26.8）。式のままでは、表26.1 のトラッピングの条件（−157 N/km より急）を満たす勾配でも −570 N/km より緩いと値が得られないため、表26.1 と整合する M への換算係数 0.157（式26.5）の形をシミュレータで使用'); }
  { const c = critAng(40); add('ダクトに捕捉される角度（ダクトの中での M の減少 40 の場合）', '通常 1° 未満', '±' + fx(c, 2) + '°（√(2·ΔM×10⁻⁶) から）', c < 1 ? 'ok' : 'info', '本文（p.26.7）。式は補足（光線の曲がりから導いた関係）'); }
  return R;
}
