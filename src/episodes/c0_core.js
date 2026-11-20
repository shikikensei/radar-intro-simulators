/* ============================================================
   第0回 レーダの基礎の基礎：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第1章（p.1.1–1.24）
   ============================================================ */
const C0 = 3e8, KT0 = 4e-21;                       // 光の速さ [m/s]、kT0 [W/Hz]（p.1.11）
const DEFAULTS = {gexp: 0, R: 30, t: 0, db: 10, D: 1, v: 3, lf: 9.5, nx: 1.5, ts: 4, pt: 1, gdb: 33, fg: 3, rcs: 1, seed: 1};
const S = Object.assign({}, DEFAULTS);
/* 表1.1（p.1.13）IEEE 標準のレーダ周波数帯：名称、公称の周波数範囲 [Hz] */
const BANDS = [['HF', 3e6, 30e6], ['VHF', 30e6, 300e6], ['UHF', 300e6, 1e9], ['L', 1e9, 2e9], ['S', 2e9, 4e9], ['C', 4e9, 8e9], ['X', 8e9, 12e9], ['Ku', 12e9, 18e9], ['K', 18e9, 27e9], ['Ka', 27e9, 40e9], ['V', 40e9, 75e9], ['W', 75e9, 110e9]];
function bandOf(f){ for (const b of BANDS) if (f >= b[1] && f < b[2]) return b; return f >= 110e9 ? null : (f < 3e6 ? null : BANDS[BANDS.length - 1]); }
/* 式1.2（p.1.11）：受信電力 Pr = Pt·Gt/(4πR²) × σ/(4πR²) × Ae。Ae は Gt = 4πAe/λ² から求める（送受同じアンテナ） */
function aeOf(g, lam){ return g * lam * lam / (4 * Math.PI); }
function prOf(pt, g, lam, rcs, R){ return pt * g / (4 * Math.PI * R * R) * rcs / (4 * Math.PI * R * R) * aeOf(g, lam); }
/* 式1.4（p.1.11）：最小検出信号 Smin = kT0·B·Fn·(S/N)1 */
function sminOf(B, Fn, snr1){ return KT0 * B * Fn * snr1; }
/* 式1.3（p.1.11）：Rmax⁴ = Pt·Gt·Ae·σ / ((4π)²·Smin) */
function rmaxOf(pt, g, lam, rcs, smin){ return Math.pow(pt * g * aeOf(g, lam) * rcs / (16 * Math.PI * Math.PI * smin), 0.25); }
const EQ0 = {B: 1e6, Fn: 2, snr1: 20};              // 帯域 1 MHz、雑音指数 3 dB、必要な S/N 13 dB（このシミュレータで決めた例）
/* 補足：ビーム幅の目安 θ ≈ 70·λ/D [度]、ガウス形のビーム（往復）の強さ */
function bwDeg(lam, D){ return 70 * lam / D; }
function twoWay(th, bw){ return Math.exp(-8 * Math.LN2 * (th / bw) * (th / bw)); }
function twoTgt(bw, sep){                           // 角度が sep [度] 離れた同じ強さの 2 目標を、ビームを振って見たときの強さ
  const xs = [], ys = []; let pk = 0; for (let a = -10; a <= 10.001; a += 0.05){ const y = twoWay(a - sep / 2, bw) + twoWay(a + sep / 2, bw); xs.push(a); ys.push(y); if (y > pk) pk = y; }
  const mid = 2 * twoWay(sep / 2, bw); return {xs, ys: ys.map(y => db10(Math.max(1e-6, y / pk))), dip: db10(pk / mid)};
}
function noiseSet(N, seed){ const g = gaussGen(seed), x = new Float64Array(N); let n3 = 0; for (let i = 0; i < N; i++){ x[i] = g(); if (Math.abs(x[i]) > 3) n3++; } return {x, n3}; }
function hitsPerScan(bw, prf, ts){ return bw / 360 * ts * prf; }      // 式 n = t0·fp（p.1.12）。t0 = ビームが目標を通り過ぎる時間
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  let ok = true; for (let i = 1; i < BANDS.length; i++) if (BANDS[i][1] !== BANDS[i - 1][2]) ok = false;
  add('表1.1：レーダ周波数帯の名称と公称の範囲（12 帯）', 'HF 3–30 MHz、VHF 30–300 MHz、UHF 300–1000 MHz、L 1–2、S 2–4、C 4–8、X 8–12、Ku 12–18、K 18–27、Ka 27–40、V 40–75、W 75–110 GHz', BANDS.map(b => b[0]).join('・') + '（' + BANDS.length + ' 帯。隣接する帯の境界が連続：' + (ok ? 'はい' : 'いいえ') + '）', ok && BANDS.length === 12 ? 'ok' : 'ng', '表1.1（p.1.13）。ページの画像で確認して入力');
  const pav = 1e6 * 1e-6 * 1e3; add('例のレーダの平均電力（尖頭 1 MW、パルス幅 1 µs、PRF 1 kHz）', '1 kW', fx(pav / 1000, 2) + ' kW', near(pav, 1000, 1e-6), '§1.1（p.1.1）。平均電力 = 尖頭電力 × パルス幅 × PRF（p.1.12 の関係）');
  const d = db10(1e-13 / 1e6); add('エコーと送信の電力の比（10⁻¹³ W ÷ 10⁶ W）', '10⁻¹⁹、190 dB 小さい', sci(1e-19, 0) + '、' + fx(d, 0) + ' dB', near(d, -190, 1e-9), '§1.1（p.1.2）');
  add('2.7〜2.9 GHz の波長', '約 10 cm（端数を丸めた値）', fx(C0 / 2.9e9 * 100, 1) + '〜' + fx(C0 / 2.7e9 * 100, 1) + ' cm', 'ok', '§1.1（p.1.1–1.2）。ハンドブックは「簡単のため丸めて約 10 cm」としている');
  const kt = 1.380649e-23 * 290; add('kT₀（ボルツマン定数 × 290 K）', '4×10⁻²¹ W/Hz', sci(kt, 2) + ' W/Hz', near(kt, 4e-21, 0.01e-21), '§1.4（p.1.11）');
  const lam = 0.1, g = 2000, p1 = prOf(1e6, g, lam, 1, 50e3), p2 = prOf(1e6, g, lam, 1, 100e3);
  add('式1.2：距離を 2 倍にしたときの受信電力の比', '1/16（距離の 4 乗に反比例）', '1/' + fx(p1 / p2, 2) + '（' + fx(db10(p2 / p1), 2) + ' dB）', near(p1 / p2, 16, 1e-9), '式1.2（p.1.11）');
  const sm = sminOf(EQ0.B, EQ0.Fn, EQ0.snr1), rm = rmaxOf(1e6, g, lam, 1, sm); let lo = 1e3, hi = 1e6; for (let i = 0; i < 60; i++){ const m = (lo + hi) / 2; if (prOf(1e6, g, lam, 1, m) > sm) lo = m; else hi = m; }
  add('式1.3 の最大探知距離と、式1.2 の曲線が最小検出信号と交わる距離', '同じ値', '式1.3：' + fx(rm / 1000, 2) + ' km、交点：' + fx(lo / 1000, 2) + ' km', near(rm, lo, 1), '式1.2〜1.4（p.1.11）。ステップ 4 の設定（1 MW、利得 33 dB、波長 10 cm、RCS 1 m²）');
  add('ステップ 4 の設定での、距離 100 km の受信電力', '「典型的な」エコーの例として 10⁻¹³ W（探知距離 50〜60 nmi のレーダ）', sci(p2, 1) + ' W', p2 > 3e-14 && p2 < 3e-13 ? 'ok' : 'info', '§1.1（p.1.2）。桁が一致することの確認（ハンドブックは例の値であり、アンテナ利得などは示していない）');
  add('式1.3：送信電力を 16 倍にしたときの最大探知距離', '2 倍（4 乗根）', fx(rmaxOf(16e6, g, lam, 1, sm) / rm, 3) + ' 倍', near(rmaxOf(16e6, g, lam, 1, sm) / rm, 2, 1e-9), '式1.3（p.1.11）');
  const kt2 = 2 * 0.514444; add('ドップラ周波数の近似：f_d [Hz] ≈ v_r [ノット] ÷ λ [m]', '誤差 約 3%', '正確には ' + fx(kt2, 3) + ' × v_r/λ（差 ' + fx((kt2 - 1) * 100, 1) + '%）', Math.abs((kt2 - 1) * 100 - 3) < 0.5 ? 'ok' : 'ng', '式1.1 とその説明（p.1.9–1.10）');
  add('往復時間と距離：1 ms、1 µs に対応する距離', '（式の記載はなく、「電波が光速で往復する時間を測る」という説明のみ）', fx(C0 * 1e-3 / 2 / 1000, 0) + ' km、' + fx(C0 * 1e-6 / 2, 0) + ' m', 'ref', '補足：R = c·t/2。§1.3（p.1.7）の説明から導いた関係。c = 3×10⁸ m/s');
  const bw = 1.5, prf = 400, ts = 6, n = hitsPerScan(bw, prf, ts); let cnt = 0; for (let k = -2000; k <= 2000; k++){ const ang = k / prf * 360 / ts; if (Math.abs(ang) <= bw / 2) cnt++; }
  add('1 回の走査で目標に当たるパルス数（ビーム幅 1.5°、PRF 400 Hz、1 回転 6 秒）', 'n = t₀·f_p（t₀：目標の照射時間）', '式：' + fx(n, 1) + ' 個、パルスを並べて数えた値：' + cnt + ' 個', Math.abs(n - cnt) <= 1 ? 'ok' : 'ng', '§1.4（p.1.12）');
  const ns = noiseSet(10000, 1), ci = wilson(ns.n3, 10000); add('雑音（正規分布）が 3σ を超える割合、10,000 個', '（ハンドブックに値の記載なし）理論値 0.27%', fx(ns.n3 / 100, 2) + '%（95% 区間 ' + fx(ci[0] * 100, 2) + '〜' + fx(ci[1] * 100, 2) + '%、' + ns.n3 + ' 個）', 'ref', '補足（ステップ 8）。乱数の種は固定');
  return R;
}
