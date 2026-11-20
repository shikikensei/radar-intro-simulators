/* ============================================================
   第12回 電子防護（ECCM）：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第24章 Electronic Counter-Countermeasures（p.24.1–24.68）
   方針：レーダを妨害から守る側の原理だけを扱う。妨害は「雑音のように帯域を埋める信号」と「偽の目標」の 2 つを、結果としての見え方だけで表す。
   簡略化：レーダと妨害の強さは、説明用の値で決めた比（dB）で表す。探知距離は「S/(N+J) が、妨害なし・距離 100 km のときと同じになる距離」。
           サイドローブキャンセラは、主チャンネル 1 本 ＋ 補助チャンネル 1 本、妨害 1 つ。受信機の雑音は 2 つのチャンネルで独立。
           アンテナは、半波長間隔 24 素子の直線アレイ（テイラーの重み付け）と、無指向性の補助アンテナ。
   ============================================================ */
const RAD = Math.PI / 180;
const RD = {Pt: 1e5, Gt: 1995, lam: 0.1, sig: 5, R0: 100, snr0: 13, B: 1, erp: 100, Bj: 100};      // 説明用の値：100 kW、利得 33 dB、波長 10 cm、RCS 5 m²、妨害なしの探知距離 100 km（S/N 13 dB）、帯域 1 MHz、妨害 100 W・100 MHz
const DEFAULTS = {P: 50, jt: 'none', jn: 0, part: 'ant', lr: 2, thj: 30, ga: -45, jnr: 10, ba: 10, lv: 0, jn0: 30, sl: 0, slc: false};
const S = Object.assign({}, DEFAULTS);
const rngDet = PdBW => RD.R0 * Math.pow(Math.pow(10, PdBW / 10) / RD.Pt, 0.25);                                  // レーダの探知距離 [km]（電力の 4 乗根に比例）
const rwrPow = (PdBW, Rkm, gdB) => Math.pow(10, PdBW / 10) * RD.Gt * Math.pow(10, (gdB || 0) / 10) * RD.lam * RD.lam / (Math.pow(4 * Math.PI, 2) * Rkm * Rkm * 1e6);   // 式24.1 の分子（受信アンテナ利得 1、損失 1）[W]
const rwrRange = (PdBW, sensDbm, gdB) => Math.sqrt(Math.pow(10, PdBW / 10) * RD.Gt * Math.pow(10, (gdB || 0) / 10) * RD.lam * RD.lam / (Math.pow(4 * Math.PI, 2) * Math.pow(10, sensDbm / 10) * 1e-3)) / 1000;   // 傍受される距離 [km]
const snrAt = Rkm => RD.snr0 + 40 * Math.log10(RD.R0 / Rkm);                                                      // 妨害なしの S/N [dB]
const rbt = inbandW => Math.sqrt(RD.Pt * RD.Gt * RD.sig / (4 * Math.PI * inbandW)) / 1000;                         // 自己防御妨害で S = J になる距離 [km]。inbandW：レーダの帯域に入る妨害の実効放射電力 [W]
const sjAt = (Rkm, inbandW) => 20 * Math.log10(rbt(inbandW) / Rkm);                                                // S/J [dB]
const rngJam = jnDb => RD.R0 * Math.pow(1 + Math.pow(10, jnDb / 10), -0.25);                                      // 妨害下の探知距離 [km]。jnDb：受信機の雑音に対する妨害の強さ（スタンドオフ妨害、距離は一定）
function taylorF(nbar, sll){ const A = Math.acosh(Math.pow(10, sll / 20)) / Math.PI, s2 = nbar * nbar / (A * A + (nbar - 0.5) * (nbar - 0.5)), F = [];
  for (let m = 1; m < nbar; m++){ let num = 1, den = 1; for (let n = 1; n < nbar; n++){ num *= 1 - m * m / (s2 * (A * A + (n - 0.5) * (n - 0.5))); if (n !== m) den *= 1 - m * m / (n * n); } F.push((m % 2 ? 1 : -1) * num / (2 * den)); } return F; }
const NEL = 24, TAY = taylorF(5, 30), WGT = (() => { const a = []; let s = 0; for (let n = 0; n < NEL; n++){ const x = (n + 0.5) / NEL - 0.5; let g = 1; for (let m = 0; m < TAY.length; m++) g += 2 * TAY[m] * Math.cos(2 * Math.PI * (m + 1) * x); a.push(g); s += g; } return a.map(v => v / s); })();
function mainAF(thDeg){ let re = 0, im = 0; const u = Math.PI * Math.sin(thDeg * RAD); for (let n = 0; n < NEL; n++){ const p = u * (n - (NEL - 1) / 2); re += WGT[n] * Math.cos(p); im += WGT[n] * Math.sin(p); } return [re, im]; }      // 主アンテナ（正面で 1）
const mainDb = th => { const v = mainAF(th); return 10 * Math.log10(Math.max(1e-9, v[0] * v[0] + v[1] * v[1])); };
const XA = NEL / 2 + 1;                                                                                           // 補助アンテナの位置（アレイの中心から、半波長を単位に）
const auxPh = th => Math.PI * Math.sin(th * RAD) * XA;
let SLR = null;
function slRegion(){ if (!SLR){ let nul = 0; for (let t = 0.1; t < 20; t += 0.05){ if (mainDb(t) < mainDb(t + 0.05)){ nul = t; break; } } let pk = -99; const th = []; for (let t = nul; t <= 90; t += 0.1){ th.push(t); pk = Math.max(pk, mainDb(t)); } SLR = {nul, pk, th, db: th.map(mainDb)}; } return SLR; }
const slbCover = ga => { const r = slRegion(); let c = 0; for (const v of r.db) if (v < ga) c++; return 100 * c / r.db.length; };      // 補助アンテナの利得 ga [dB] で、ブランクできるサイドローブ方向の割合 [%]
const slbBlank = (th, ga) => mainDb(th) < ga;                                                                     // 補助チャンネル ＞ 主チャンネル ならブランク
function slcSim(jnrDb, o){      // 2 チャンネルのサイドローブキャンセラ。jnrDb：主チャンネル（サイドローブ経由）での妨害対雑音比。o: {thj, ga, n, seed, mis}
  o = o || {}; const thj = o.thj === undefined ? TJ : o.thj, gaDb = o.ga === undefined ? -20 : o.ga, n = o.n || 4000, g = gaussGen(1200 + (o.seed || 1)), m = mainAF(thj), gs = Math.hypot(m[0], m[1]), ga = Math.pow(10, gaDb / 20), J = Math.pow(10, jnrDb / 10) / (gs * gs), sj = Math.sqrt(J / 2), sn = Math.SQRT1_2, ph = auxPh(thj) - Math.atan2(m[1], m[0]);
  const cp = Math.cos(ph), sp = Math.sin(ph), mr = new Float64Array(n), mi = new Float64Array(n), ar = new Float64Array(n), ai = new Float64Array(n); let cr = 0, ci = 0, pa = 0, pm = 0;
  for (let i = 0; i < n; i++){ const jr = sj * g(), ji = sj * g(); mr[i] = gs * jr + sn * g(); mi[i] = gs * ji + sn * g(); const xr = ga * (jr * cp - ji * sp), xi = ga * (jr * sp + ji * cp); ar[i] = xr + sn * g(); ai[i] = xi + sn * g(); cr += mr[i] * ar[i] + mi[i] * ai[i]; ci += mi[i] * ar[i] - mr[i] * ai[i]; pa += ar[i] * ar[i] + ai[i] * ai[i]; pm += mr[i] * mr[i] + mi[i] * mi[i]; }
  const wr = cr / pa, wi = ci / pa; let pz = 0; const before = [], after = []; for (let i = 0; i < n; i++){ const zr = mr[i] - (wr * ar[i] - wi * ai[i]), zi = mi[i] - (wr * ai[i] + wi * ar[i]), p = zr * zr + zi * zi; pz += p; if (i < 160){ before.push(mr[i] * mr[i] + mi[i] * mi[i]); after.push(p); } }
  const Jm = Math.pow(10, jnrDb / 10), Ja = J * ga * ga, rho2 = (Jm / (Jm + 1)) * (Ja / (Ja + 1)), wT = gs * ga * J / (ga * ga * J + 1);
  return {w: [wr, wi], wAbs: Math.hypot(wr, wi), wTheory: wT, jcr: 10 * Math.log10(pm / pz), jcrTheory: -10 * Math.log10(1 - rho2), rho2, before, after, resid: 10 * Math.log10(pz / n), ph, gs, ga};
}
function adaptedDb(th, r){ const m = mainAF(th), a = auxPh(th), xr = r.ga * Math.cos(a), xi = r.ga * Math.sin(a), zr = m[0] - (r.w[0] * xr - r.w[1] * xi), zi = m[1] - (r.w[0] * xi + r.w[1] * xr); return 10 * Math.log10(Math.max(1e-9, zr * zr + zi * zi)); }      // キャンセラをかけたあとの受信パターン
const TJ = (() => { let b = 25, v = -99; for (let t = 25; t <= 30; t += 0.05){ const d = mainDb(t); if (d > v){ v = d; b = t; } } return Math.round(b * 10) / 10; })();      // 妨害の方向（主アンテナのサイドローブの山の 1 つ）
const ECCM = {      // 表24.1 から一部を選んで日本語にしたもの。列：雑音／偽目標／距離ゲートの引き離し／速度ゲートの引き離し／角度
  ant: {n: 'アンテナ', rows: [['低サイドローブ・超低サイドローブ', 'NF'], ['モノパルスによる角度追尾', 'A'], ['サイドローブブランキング（SLB）', 'NF'], ['サイドローブキャンセラ（SLC）', 'N'], ['電子走査', 'FRA']]},
  tx: {n: '送信機', rows: [['大きな送信電力', 'N'], ['パルス圧縮', 'N'], ['周波数ダイバーシティ', 'N'], ['周波数アジリティ', 'NF'], ['PRF を不規則に変化させる（ジッタ）', 'FR']]},
  rx: {n: '受信機', rows: [['帯域幅を広げる', 'FV'], ['妨害の方向へ誘導する（ホーム・オン・ジャム）', 'N'], ['エコーの前縁・後縁で追尾する', 'R'], ['速度のガードゲート', 'FV']]},
  sp: {n: '信号処理', rows: [['目標らしさの判定', 'FRV'], ['加速度の制限', 'FRV'], ['順序統計などの CFAR', 'NF'], ['ドップラと距離の変化の比較', 'RV']]},
  ope: {n: '運用', rows: [['運用者の訓練と判断', ''], ['電波を放射する時間・方向の管理（EMCON）', ''], ['周波数の割り当て', ''], ['レーダの配置、複数のレーダの連携', '']]}
};
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  { const a = 10 * Math.log10(rwrPow(50, 100) / rwrPow(50, 200)), b = snrAt(100) - snrAt(200); add('式24.1：距離を 2 倍にした場合の、傍受する受信機での電力の低下と、レーダのエコーの低下', '傍受は R² に反比例（6 dB）、レーダの探知は R⁴ に反比例（12 dB）', fx(a, 2) + ' dB と ' + fx(b, 2) + ' dB', Math.abs(a - 6.02) < 0.01 && Math.abs(b - 12.04) < 0.01 ? 'ok' : 'ng', '式24.1 と本文（p.24.4–24.5）'); }
  { const r = rwrRange(50, -40, 0), d = rngDet(50); add('傍受される距離とレーダの探知距離の比較（100 kW、利得 33 dB、波長 10 cm。受信機の感度 −40 dBm、メインビーム）', 'レーダが目標を探知できる距離より、はるかに遠くで傍受できる（数値例なし）', '傍受 ' + fx(r, 0) + ' km、探知 ' + fx(d, 0) + ' km（説明用の例）', r > d ? 'ref' : 'ng', '本文（p.24.5）。感度 −40 dBm は、本文の RWR の範囲（−38〜−60 dBm）の中の値'); }
  { add('サイドローブの平均レベル：放射電力の 10% がサイドローブにある場合', '−10 dB（等方性アンテナに対して）', fx(10 * Math.log10(0.1), 1) + ' dB', 'ok', '本文（p.24.10）'); }
  { const s = slRegion(), g = Math.ceil(s.pk), a = slbBlank(0, g), b = slbBlank(30, g), c = slbCover(g); add('サイドローブブランキングの判定（補助アンテナの利得を、主アンテナの最大のサイドローブ ' + fx(s.pk, 1) + ' dB より上の ' + g + ' dB にした場合）', 'メインビームの目標は通過。サイドローブから入った信号はブランク', '正面（0°）：' + (a ? 'ブランク' : '通過') + '、' + TJ + '°：' + (b ? 'ブランク' : '通過') + '、ブランクできるサイドローブ方向 ' + fx(c, 0) + '%', !a && b && c >= 100 ? 'ok' : 'ng', '本文（p.24.12–24.13、図24.1）。原理の確認。雑音がない場合の判定'); }
  { const t = []; let ok = true; for (const j of [10, 20, 30, 40]){ let s = 0; for (let k = 1; k <= 5; k++) s += slcSim(j, {seed: k}).jcr; const r = slcSim(j); t.push(j + ' dB：' + fx(s / 5, 1) + ' dB（式 ' + fx(r.jcrTheory, 1) + ' dB）'); if (Math.abs(s / 5 - r.jcrTheory) > 1) ok = false; }
    add('式24.5：補助アンテナ 1 本・妨害 1 つのサイドローブキャンセラの妨害消去比（主チャンネルの妨害対雑音比 10／20／30／40 dB）', 'JCR = 1/(1 − |ρ|²)', t.join('、'), ok ? 'ok' : 'info', '式24.4・24.5（p.24.15）。4000 サンプルから係数を推定して減算した結果（乱数 5 通りの平均）。ρ は 2 つのチャンネルの相関係数'); }
  { const r = slcSim(30); add('式24.5：最適な係数の大きさ（妨害対雑音比 30 dB）', '|W| = |E[VM·VA*]| / E[|VA|²] = ' + fx(r.wTheory, 4), fx(r.wAbs, 4) + '（サンプルからの推定）', Math.abs(r.wAbs / r.wTheory - 1) < 0.03 ? 'ok' : 'info', '式24.3・24.5（p.24.15）'); }
  { const f = r2 => -10 * Math.log10(1 - r2); add('相関係数と妨害消去比の関係（|ρ|² = 0.999／0.9999）', '実用では JCR は 30〜40 dB 程度', fx(f(0.999), 0) + ' dB／' + fx(f(0.9999), 0) + ' dB', 'ref', '本文（p.24.16）と式24.5。30〜40 dB には、チャンネル間の相関 0.999〜0.9999 が必要という目安'); }
  { add('A/D 変換器の 1 ビットあたりのダイナミックレンジ', '6 dB', fx(20 * Math.log10(2), 2) + ' dB（100 dB には ' + Math.ceil(100 / 6.02) + ' ビット）', 'ok', '本文（p.24.33）'); }
  { const a = sjAt(10, 1) - sjAt(20, 1), r = rbt(1); add('自己防御妨害がある場合の信号対妨害比：距離を半分にした場合の変化と、S = J になる距離（説明用の例）', '（この章に式なし）エコーは R⁴、妨害は R² に反比例 → S/J は R² に反比例', '+' + fx(a, 2) + ' dB、S = J になる距離 ' + fx(r, 1) + ' km', Math.abs(a - 6.02) < 0.01 ? 'ref' : 'ng', '補足：式24.1（片道）と第0回のレーダ方程式（往復）から導いた一般的な関係。本文は妨害下の探知距離の計算例を別の文献に譲っている（p.24.55）'); }
  { const a = rbt(100 / 10), b = rbt(100 / 100); add('周波数を切り替える帯域幅を 10 倍にした場合（10 → 100 MHz）の、妨害の電力密度と S = J になる距離', '妨害側は電力を広い帯域に分散しなければならず、電力密度が下がる（数値例なし）', '電力密度 −10 dB、距離 ' + fx(a, 1) + ' → ' + fx(b, 1) + ' km（√10 倍）', Math.abs(b / a - Math.sqrt(10)) < 1e-6 ? 'ref' : 'ng', '本文（p.24.31）。妨害の全電力が一定で、帯域全体に一様に分散した場合の計算'); }
  { const a = rngJam(30), b = rngJam(0), c = rngJam(-30); add('妨害下の探知距離（妨害なしで 100 km）：妨害対雑音比 30 dB／サイドローブキャンセラで 30 dB 下げた場合', '妨害の電力を ECCM の効果の分だけ減らしてレーダ方程式に入れる（数値例なし）', fx(a, 1) + ' km → ' + fx(b, 1) + ' km（さらに 30 dB 下げると ' + fx(c, 1) + ' km）', 'ref', '本文（p.24.54）の考え方による計算。探知距離は (1 + J/N) の 4 乗根に反比例'); }
  return R;
}
