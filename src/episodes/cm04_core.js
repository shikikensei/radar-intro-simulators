/* ============================================================
   中級 第4回 測定の精度：計算部分（共通の計算は cm_common.js）
   もとにした資料：Radar Handbook 3rd ed. 第9章 Tracking Radar
     §9.7〜9.11（p.9.26–9.46：誤差の原因、目標による誤差（グリント、距離の雑音）、外部の原因（多重反射）、内部の原因（熱雑音、式9.10）、まとめの表）
     第7章 §7.3（表7.3：α-β フィルタの平滑のあとの誤差。入門 第5回）、第1章 §1.3（p.1.7–1.10：距離・速度の測定）
   入門 第8回（c8_core.js）、第5回（c5_core.js）、第16回（c16_core.js）で確かめてある式を写した：
     式9.10  熱雑音による角度の誤差 σ = θB / ( km·√(Bτ·(S/N)·(fr/βn)) )。km：誤差の傾き（1.2〜1.9、ここでは 1.6）
     グリント  σang ≈ 0.15·L（L：目標の横の広がり。入門 第8回の誤差の見積もりで使った値。角度に直すには距離で割る）
     表7.3    α-β フィルタの平滑のあとの位置の誤差 ÷ 測定の誤差 = √( (2α² + β(2 − 3α)) / (α(4 − 2α − β)) )、β = α²/(2 − α)
   モデル（補足）：
   ・1 回の測定（1 つの CPI）の誤差の目安を、分解能 ÷ ( k·√(2·S/N) ) とした。角度は k = km（式9.10 で fr/βn = 2 と置いた形）、距離と速度は k = 1（入門 第16回 ステップ 7 と同じ）。
   ・S/N は、中級 第1回の R_o（212.3 km。損失を含む）から (R_o/R)^4。分解能は、ビーム幅 4.5°、距離 150 m（帯域幅 1 MHz）、速度 3.125 m/s（CPI 16 ms）。
   ・多重反射：平らな海面。像は、目標と対称な下向きの角度に現れるとした。目標と像の角度の差を、ビーム幅と比べる。
     ハンドブックは、像がサイドローブに入る近い距離、中間、半値幅の中に入る遠い距離の 3 つに分けて見積もると述べている（p.9.38–9.41）。誤差の値そのものは、ここでは計算しない。
   ・そのほかの誤差（サーボ、機器）を 0.1 mrad と置いた。誤差は独立として、2 乗和の平方根で合成する。フィルタは、熱雑音とグリントをならし、そのほかの誤差はならさないとした。
   ============================================================ */
const RAD = Math.PI / 180;
const EXA = {thb: 4.5, km: 1.6, dR: 150, dV: 3.125, kg: 0.15, fix: 0.1, ha: 20};
const DEFAULTS = {R: 100, L: 15, alpha: 0.5, ht: 100, Rm: 20, bw: 1};
const S = Object.assign({}, DEFAULTS);
const snrAt = Rkm => Math.pow(M1.ro / (Rkm * 1000), 4);
const betaOf = a => a * a / (2 - a);
const sFilt = a => { const b = betaOf(a); return Math.sqrt((2 * a * a + b * (2 - 3 * a)) / (a * (4 - 2 * a - b))); };      // 表7.3（入門 第5回の T73.sFilt）
const thermal910 = (thB, km, snr, n) => thB / (km * Math.sqrt(snr * n));                                                // 式9.10（Bτ = 1、n = fr/βn）
function calc(s){
  s = s || S; const snr = snrAt(s.R), q = Math.sqrt(2 * snr), sA = EXA.thb * RAD * 1000 / (EXA.km * q), sR = EXA.dR / s.bw / q, sV = EXA.dV / q, gl = EXA.kg * s.L / s.R, K = sFilt(s.alpha);
  const tot = Math.hypot(sA, gl, EXA.fix), totF = Math.hypot(sA * K, gl * K, EXA.fix);
  return {snr, snrdb: db10(snr), q, sA, sR, sV, gl, glm: EXA.kg * s.L, fix: EXA.fix, tot, K, totF, sRF: sR * K, cross: sA * s.R, crossF: totF * s.R};      // 角度は mrad、距離 m、速度 m/s。cross：横方向の位置の誤差 [m]
}
function rCross(L){ let lo = 1, hi = 200; for (let i = 0; i < 60; i++){ const m = (lo + hi) / 2, c = calc(Object.assign({}, DEFAULTS, {R: m, L})); if (c.sA < c.gl) lo = m; else hi = m; } return (lo + hi) / 2; }      // 熱雑音とグリントが等しくなる距離 [km]
function multi(s){ s = s || S; const e = Math.atan((s.ht - EXA.ha) / (s.Rm * 1000)) / RAD, im = -Math.atan((s.ht + EXA.ha) / (s.Rm * 1000)) / RAD, sep = e - im, r = sep / EXA.thb; return {e, im, sep, r, reg: r < 0.5 ? '像が主ビームの中（誤差が大きい）' : r < 1.5 ? '中間（見積もりが難しい）' : '像はサイドローブ（誤差は小さい）'}; }
const with_ = o => Object.assign({}, DEFAULTS, o);
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note}), nr = (a, b, t) => Math.abs(a - b) <= t ? 'ok' : 'ng';
  { const c = calc(with_({})); add('S/N の基準：距離 100 km（1 つの CPI のあと）', '中級 第1回：(R_o/R)⁴、R_o = 212.3 km', fx(c.snrdb, 2) + ' dB（' + fx(c.snr, 2) + ' 倍）', nr(c.snr, Math.pow(2.1234, 4), 0.02), '式4.15。中級 第1回 ステップ 8 の 100 km の S/N（20.31 倍）と同じ'); }
  { const c = calc(with_({})), a = thermal910(EXA.thb * RAD * 1000, EXA.km, c.snr, 2); add('1 回の測定の角度の誤差と、式9.10', '式9.10 で fr/βn = 2 と置いた値', '目安の式：' + fx(c.sA, 3) + ' mrad、式9.10：' + fx(a, 3) + ' mrad', nr(c.sA, a, 1e-9), 'p.9.42。入門 第8回の thermal と同じ式。fr/βn = 2 は、こちらの置き方（補足）'); }
  { const a = thermal910(1.5, 1.6, 10, 200); add('式9.10 の例（ビーム幅 1.5°、km 1.6、S/N 10 dB、fr/βn = 200）', '入門 第8回の照合と同じ値', fx(a * 1000, 2) + ' ミリ度', nr(a * 1000, 1.5 / (1.6 * Math.sqrt(2000)) * 1000, 1e-9), '入門 第8回では、追尾のシミュレーションと照合してある'); }
  { const k = sFilt(0.5); add('α-β フィルタの平滑のあとの誤差（α = 0.5、β = α²/(2 − α)）', '表7.3 の式（入門 第5回）', '測定の誤差の ' + fx(k, 4) + ' 倍', nr(k, Math.sqrt((0.5 + 0.5 / 3 * 0.5) / (0.5 * (3 - 0.5 / 3))), 1e-9), 'p.7.26–7.27。入門 第5回で、シミュレーションと照合してある式'); }
  { const c = calc(with_({})); add('距離の誤差の目安（100 km、分解能 150 m）', '（基準なし）分解能 ÷ √(2·S/N)', fx(c.sR, 1) + ' m。速度：' + fx(c.sV, 2) + ' m/s（分解能 3.125 m/s）', 'ref', '補足のモデル。入門 第16回 ステップ 7 と同じ式'); }
  { const a = calc(with_({R: 120})), b = 150 / Math.sqrt(2 * lin(21.08)); add('入門 第16回との対応（距離 120 km の距離の誤差）', '入門 第16回：処理後の S/N 21.08 dB で 9.4 m', '同じ S/N を入れると ' + fx(b, 1) + ' m。この回の例（損失 13 dB を含む S/N ' + fx(a.snrdb, 1) + ' dB）では ' + fx(a.sR, 1) + ' m', nr(b, 9.37, 0.05), '式は同じ。S/N の前提（損失の数え方）が違うので、値は違う'); }
  { const c = calc(with_({R: 10})); add('グリントの大きさ（目標の横の広がり 15 m）', 'σang ≈ 0.15·L（入門 第8回の見積もりで使った値）', fx(c.glm, 2) + ' m（距離 10 km で ' + fx(c.gl, 3) + ' mrad）', nr(c.glm, 2.25, 1e-9), 'p.9.31。ハンドブックは 0.15L〜0.2L ほどとしている（入門 第8回の報告を参照）'); }
  { const r = rCross(15); add('熱雑音とグリントが等しくなる距離（目標 15 m）', '近距離ではグリント、遠距離では熱雑音が支配的（図9.30 の傾向。入門 第8回）', fx(r, 1) + ' km（これより近いとグリントが大きい）', r > 3 && r < 60 ? 'ok' : 'info', '傾向の確認。距離の値は、このレーダの例での値'); }
  { const m = multi(with_({})); add('多重反射：アンテナ 20 m、目標 100 m、距離 20 km', '（基準なし）像がビームのどこに入るかで、3 つの領域に分けて見積もる（p.9.38–9.41）', '目標 ' + fx(m.e, 3) + '°、像 ' + fx(m.im, 3) + '°、差 ' + fx(m.sep, 3) + '°（ビーム幅の ' + fx(m.r, 2) + ' 倍）→ ' + m.reg, 'ref', '平らな海面の幾何。領域の境目（0.5 倍、1.5 倍）は、こちらで置いた目安'); }
  { const c = calc(with_({R: 15})); add('誤差の合成（距離 15 km）：熱雑音、グリント、そのほか', '（基準なし）独立な誤差は、2 乗和の平方根', fx(c.sA, 3) + '、' + fx(c.gl, 3) + '、' + fx(c.fix, 2) + ' → ' + fx(c.tot, 3) + ' mrad', nr(c.tot, Math.sqrt(c.sA * c.sA + c.gl * c.gl + 0.01), 1e-9), '第9章のまとめの表（表9.2・9.3）の考え方'); }
  return R;
}
