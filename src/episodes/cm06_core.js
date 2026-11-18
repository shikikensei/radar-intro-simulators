/* ============================================================
   中級 第6回 伝搬と覆域：計算部分（共通の計算は cm_common.js）
   もとにした資料：Radar Handbook 3rd ed. 第26章 The Propagation Factor, Fp, in the Radar Equation（屈折・反射・ダクト・伝搬損失の部分。p.26.1–26.15、p.26.19–26.20）、
                   第19章 §19.3（雨による減衰。p.19.8–19.9、図19.1）
   入門 第9回（c9_core.js）で確かめてある式を写した：
     式26.16  等価地球半径係数 k = 1/(1 + a·dN/dh)（標準の勾配 −39 N/km で 1.33）
     式26.12  自由空間の伝搬損失 Lfs [dB] = 32.45 + 20·log f[MHz] + 20·log r[km]
     式26.7   ダクトが閉じ込める最大の波長（入門 第9回の形）λmax = 2.5×10⁻³·√(ΔM)·t（t：ダクトの厚さ [m]、ΔM：ダクトの中での M の減少）
     水平線までの距離 √(2·k·a·h)（第26章には式がなく、入門 第9回でも補足として使った一般的な式）
     直接波と反射波の干渉（球面の上の 2 波のモデル。入門 第9回の twoRay）、ローブの仰角 sin θ = (2n − 1)·λ/(4·h1)（補足）
   PDF のページを画像で見て読み取った値（図19.1、p.19.9。雨の強さ 1 インチ/時 = 25.4 mm/h での、片道の減衰）：
     4 GHz：約 0.035 dB/マイル（0.022 dB/km）、6 GHz：約 0.2 dB/マイル（0.12 dB/km）、11 GHz：約 1.2 dB/マイル（0.75 dB/km）
   モデル（補足）：
   ・伝搬因子 F（電界の比）は、レーダ方程式の受信電力に F⁴ で入る。探知距離（S/N が要る値に等しい距離）は、その場所の F 倍になる。
   ・平らな地面での近似：直接波と反射波の道のりの差 ≈ 2·h1·h2/R。差が λ/2 の奇数倍で山（F = 1 + ρ）、λ の整数倍で谷（F = 1 − ρ）。
   ・雨の減衰は、図19.1 の読み取り値に、雨の強さの 1.15 乗を掛けた（図の線の傾き）。例のレーダの 3 GHz には、4 GHz の線の値を使った（実際は、これより小さい）。
   ・回折の領域（水平線の少し先）の落ち込みは、計算していない（見通しの外は 0 とした）。
   ============================================================ */
const RAD = Math.PI / 180, AE0 = 6371e3;
const RAIN = {4: 0.022, 6: 0.12, 11: 0.75};      // 25.4 mm/h での片道の減衰 [dB/km]（図19.1 の読み取り）
const DEFAULTS = {ha: 20, ht: 100, rho: 0.9, R: 30, rain: 0, path: 50, band: 4, dM: 5, t: 20, dn: -39};
const S = Object.assign({}, DEFAULTS);
const kOf = dn => { const d = 1 + AE0 * dn * 1e-9; return d > 1e-6 ? 1 / d : Infinity; };      // 式26.16
const horiz = (h, k) => Math.sqrt(2 * k * AE0 * Math.max(0, h));                                // [m]
const los = (ha, ht, k) => (horiz(ha, k) + horiz(ht, k)) / 1000;                               // 見通し距離 [km]
const lfs = (fMHz, rkm) => 32.45 + 20 * Math.log10(fMHz) + 20 * Math.log10(rkm);               // 式26.12
function twoRay(h1, h2, G, lam, rho, k){      // 入門 第9回と同じ（球面の上の 2 波の干渉）
  const ae = k * AE0; if (G > horiz(h1, k) + horiz(h2, k)) return {vis: false, F: 0};
  const p = 2 / Math.sqrt(3) * Math.sqrt(ae * (h1 + h2) + G * G / 4), xi = Math.asin(Math.max(-1, Math.min(1, 2 * ae * G * (h2 - h1) / (p * p * p)))), G1 = G / 2 - p * Math.sin(xi / 3), G2 = G - G1;
  const a = Math.max(0, h1 - G1 * G1 / (2 * ae)), b = Math.max(0, h2 - G2 * G2 / (2 * ae)), del = Math.sqrt(G * G + (a + b) * (a + b)) - Math.sqrt(G * G + (b - a) * (b - a)), ph = 2 * Math.PI * del / lam + Math.PI;
  return {vis: true, F: Math.sqrt(1 + rho * rho + 2 * rho * Math.cos(ph)), del};
}
const lobeAng = (n, lam, h1) => Math.asin(Math.min(1, (2 * n - 1) * lam / (4 * h1))) / RAD;     // n 番目のローブの仰角 [度]（平らな海面）
const nullR = (n, lam, h1, h2) => 2 * h1 * h2 / (n * lam) / 1000;                               // n 番目の谷の距離 [km]（平らな地面の近似）
const peakR = (n, lam, h1, h2) => 4 * h1 * h2 / ((2 * n - 1) * lam) / 1000;                     // n 番目の山の距離 [km]
const lmaxDuct = (dM, t) => dM > 0 ? 2.5e-3 * Math.sqrt(dM) * t : 0;                            // [m]
const critAng = dM => Math.sqrt(2e-6 * Math.max(0, dM)) / RAD;
const rainAtt = (band, rate) => rate > 0 ? RAIN[band] * Math.pow(rate / 25.4, 1.15) : 0;        // 片道 [dB/km]
function calc(s){
  s = s || S; const k = kOf(s.dn), lam = EXR.lam, d = los(s.ha, s.ht, k), tr = twoRay(s.ha, s.ht, s.R * 1000, lam, s.rho, k), F = tr.vis ? tr.F : 0;
  const att = 2 * rainAtt(s.band, s.rain) * Math.min(s.path, s.R), snr0 = 40 * Math.log10(M1.ro / (s.R * 1000)), snr = F > 0 ? snr0 + 40 * Math.log10(F) - att : -99;
  return {k, lam, los: d, vis: tr.vis, F, fdb: F > 0 ? 40 * Math.log10(F) : -99, att, snr0, snr, margin: snr - M1.s0, margin0: snr0 - M1.s0, r0: M1.r0 / 1000, hz: horiz(s.ha, k) / 1000};
}
function profile(s, rmax, dr){      // 距離ごとの S/N の余裕（その高さの目標）
  const xs = [], ys = [], y0 = []; for (let r = 2; r <= rmax + 1e-9; r += dr){ const c = calc(Object.assign({}, s, {R: r})); xs.push(r); ys.push(c.vis ? Math.max(-40, c.margin) : NaN); y0.push(c.margin0); } return {xs, ys, y0};
}
function rDetFar(s){ let far = 0; for (let r = 2; r <= 250; r += 0.25){ const c = calc(Object.assign({}, s, {R: r})); if (c.vis && c.margin >= 0) far = r; } return far; }      // 余裕が 0 以上になる、いちばん遠い距離 [km]
const with_ = o => Object.assign({}, DEFAULTS, o);
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note}), nr = (a, b, t) => Math.abs(a - b) <= t ? 'ok' : 'ng';
  add('式26.16：等価地球半径係数（屈折度の勾配 −39 N/km）', '1.33（約 4/3）。入門 第9回の照合と同じ', fx(kOf(-39), 3), nr(kOf(-39), 1.33, 0.005), 'p.26.15');
  { const a = horiz(20, 4 / 3) / 1000; add('水平線までの距離（アンテナの高さ 20 m、k = 4/3）', '18.4 km（4.12·√h。入門 第9回・第17回と同じ値）', fx(a, 2) + ' km', nr(a, 18.43, 0.01), '第26章には式がなく、入門 第9回でも補足として使った'); }
  { const a = los(20, 10, 4 / 3); add('見通し距離（アンテナ 20 m、目標 10 m）', '入門 第17回 ステップ 2：31.5 km', fx(a, 2) + ' km', nr(a, 31.47, 0.01), '回をまたいで、同じ条件なら同じ値'); }
  add('式26.12：自由空間の伝搬損失（3 GHz、100 km）', '32.45 + 20·log f[MHz] + 20·log r[km]', fx(lfs(3000, 100), 2) + ' dB', nr(lfs(3000, 100), 32.45 + 69.54 + 40, 0.01), 'p.26.14。片道の値');
  { let mx = 0, mn = 9; for (let h = 5; h <= 600; h += 0.25){ const t = twoRay(20, h, 20000, 0.1, 1, 4 / 3); if (t.vis){ mx = Math.max(mx, t.F); mn = Math.min(mn, t.F); } } add('直接波と反射波の干渉（反射係数 1）：伝搬因子の最大と最小', '最大で 6 dB 上（電界 2 倍）、谷は深く落ちる。入門 第9回の照合と同じ', '最大 ' + fx(mx, 3) + '（' + fx(20 * Math.log10(mx), 2) + ' dB）、最小 ' + fx(mn, 3), nr(mx, 2, 0.01), 'p.26.6–26.7。レーダ方程式には F⁴（最大 +12 dB）で入る'); }
  { const a = lobeAng(1, 0.1, 20); let best = 0, bh = 0; for (let h = 5; h <= 120; h += 0.05){ const t = twoRay(20, h, 30000, 0.1, 1, 1e6); if (t.vis && t.F > best){ best = t.F; bh = h; } } add('いちばん下のローブの仰角と、距離 30 km での山の高さ（平らな地面の近似と、2 波の計算）', '（この章に式なし）sin θ = λ/(4·h1)、高さ ≈ λ·R/(4·h1)', '仰角 ' + fx(a, 4) + '°。高さ：近似 ' + fx(0.1 * 30000 / 80, 1) + ' m、2 波の計算（地球を平らにした場合）' + fx(bh, 1) + ' m', Math.abs(bh - 37.5) < 1 ? 'ref' : 'ng', '補足の式。地球の丸みを入れると、山は少し高い所へ移る'); }
  { const l = lmaxDuct(5, 20); add('式26.7：ダクトが閉じ込める最大の波長（厚さ 20 m、M の減少 5）', '入門 第9回の照合と同じ値', fx(l * 100, 1) + ' cm（周波数 ' + fx(0.3 / l, 2) + ' GHz 以上が閉じ込められる）', nr(l, 0.1118, 0.0005), 'p.26.8。式の定数については、入門 第9回の報告（report_part2_B.md）に注意がある'); }
  add('図19.1：雨の強さ 1 インチ/時（25.4 mm/h）での減衰（片道）', '4 GHz：約 0.035、6 GHz：約 0.2、11 GHz：約 1.2 dB/マイル（図の読み取り）', [4, 6, 11].map(b => fx(rainAtt(b, 25.4) * 1.609, 3)).join('／') + ' dB/マイル（' + [4, 6, 11].map(b => fx(rainAtt(b, 25.4), 3)).join('／') + ' dB/km）', 'ref', 'p.19.9。読み取りの誤差を含む。図は転載していない');
  { const c = calc(with_({R: 50, ht: 3000, rho: 0})); add('反射なし（ρ = 0）・雨なしのときの探知距離', '中級 第1回：99.8 km（ゆらがない目標、P_d 0.9）', fx(c.r0, 1) + ' km。50 km での余裕 ' + fx(c.margin, 2) + ' dB（40·log(99.8/50) = ' + fx(40 * Math.log10(c.r0 / 50), 2) + '）', nr(c.margin, 40 * Math.log10(c.r0 / 50), 0.01), '伝搬因子 1（自由空間）なら、中級 第1回の値に戻る'); }
  { const k = kOf(-39), sph = ht => { const o = []; let p2 = null, p1 = null; for (let r = 3; r <= los(20, ht, k); r += 0.02){ const F = twoRay(20, ht, r * 1000, 0.1, 0.9, k).F; if (p2 !== null && p1 < p2 && p1 < F) o.push(r - 0.02); p2 = p1; p1 = F; } return o; }, a = sph(100), near = v => a.reduce((b, x) => Math.abs(x - v) < Math.abs(b - v) ? x : b, a[0]);
    add('平らな地面の近似（谷の距離 2·h1·h2/(n·λ)）と、地球の丸みを入れた 2 波の計算。アンテナ 20 m、目標 100 m', '（基準なし）近似は、近い距離でだけ合う', 'n = 4：近似 ' + fx(nullR(4, 0.1, 20, 100), 1) + ' km、計算 ' + fx(near(10), 1) + ' km。n = 2：近似 ' + fx(nullR(2, 0.1, 20, 100), 1) + ' km、計算 ' + fx(near(20), 1) + ' km。n = 1：近似 ' + fx(nullR(1, 0.1, 20, 100), 1) + ' km、計算 ' + fx(a[a.length - 1], 1) + ' km', 'info', '遠い距離では、地球の丸みで、目標と反射点の実質の高さが下がり、谷は内側へ寄る。この回の図と計算書は、丸みを入れた計算。手計算は、角度の式と、近い距離に限った'); }
  { const s = with_({}); add('例の計算書：高さ 100 m の目標（アンテナ 20 m、反射係数 0.9）', '（基準なし）', '見通し ' + fx(los(20, 100, kOf(-39)), 1) + ' km、谷 ' + fx(nullR(1, 0.1, 20, 100), 0) + ' km・' + fx(nullR(2, 0.1, 20, 100), 0) + ' km、いちばん遠い探知 ' + fx(rDetFar(s), 1) + ' km', 'ref', '説明用の値'); }
  return R;
}
