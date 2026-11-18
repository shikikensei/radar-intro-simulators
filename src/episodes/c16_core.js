/* ============================================================
   第16回 信号を追う（送信から航跡まで）：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第1章 §1.1 の Basic Parts of a Radar（p.1.2–1.3、図1.1）、§1.1 の例のレーダ（p.1.1）
                   各段階の中身は、これまでの回（第0・1・2・3・4・5・8・15回）の式を写して使う。
   方針：一般的な原理だけを扱う。数値はすべて説明用（実在の装置の値ではない）。
   場面（こちらで決めた例。第15回の基準のレーダにそろえた）：
     有効開口面積 1.6 m²、3 GHz（利得 33 dB）、PRF 1 kHz、雑音指数 3 dB、目標 1 m²・距離 120 km・近づく速さ 20 m/s。
     送信は、尖頭 10 kW・帯域幅 1 MHz・長さ 100 µs のパルス（時間帯域幅積 100）。平均電力は 1 kW で、
     第15回の基準（尖頭 1 MW・1 µs）とパルスのエネルギーが同じ（1 J）。
   モデル（補足）：
   ・整合フィルタ：LFM（チャープ）を 1 µs きざみで作り、相関を実際に計算する。利得は時間帯域幅積。
   ・ドップラ処理：16 パルスに Hann の重みを掛け、目標のドップラに合わせたフィルタで足す。利得は 16 倍 ÷ 重み付けの損失（1.76 dB）。
     フィルタの中心が目標のドップラからずれる損失は無視した。
   ・クラッタ：完全に止まっていて、圧縮後・1 パルスあたりで雑音より 30 dB 強いとした。フィルタを通った消え残りは、雑音と同じように扱う。
   ・判定：1 つのセルを 2 乗検波して、しきい値と比べる。目標の強さはゆらがない。第4回の pdNF と同じ計算。
   ・測定の誤差：分解能 ÷ √(2·S/N) を目安とした（角度は km = 1.6。第8回）。ビーム幅は √Ω0 とした。
   ・航跡：4 スキャンのうち 3 回、予測の近くに検出があれば確定。位置と速さは、直線の当てはめ（最小二乗）で求める。
   ============================================================ */
const C0 = 3e8, KT0 = 4e-21;
const SCN = {pt: 1e4, B: 1e6, fp: 1000, ae: 1.6, fg: 3, np: 16, cnr: 30, ts: 4, nrange: 1000, nbeam: 175, pdReq: 0.9, km: 1.6};
const TBS = [1, 2, 5, 10, 20, 50, 100, 200];
const DEFAULTS = {R: 120, rcs: 1, v: 20, fn: 3, tbi: 6, x: 6, ns: 1};
const S = Object.assign({}, DEFAULTS);
const lin = d => Math.pow(10, d / 10);
const NCELLS = SCN.nrange * SCN.np * SCN.nbeam;                   // 1 スキャンで判定するセルの数（距離 1000 × ドップラ 16 × ビームの向き 175）
/* 第15回（c15_core.js）から写した式 */
function prOf(pt, g, ae, rcs, R){ return pt * g / (4 * Math.PI * R * R) * rcs / (4 * Math.PI * R * R) * ae; }
function rmax15(p){ return Math.pow(p.pav * p.g * p.ae * p.rcs * p.n * p.ei * Math.pow(p.F, 4) / (16 * Math.PI * Math.PI * KT0 * p.Fn * p.fp * p.snr1 * p.Ls), 0.25); }
/* 第4回（legacy/ccore.js）から写した式：ゆらがない目標、n パルスの和、しきい値 T（雑音の平均を 1 とした値）のときの検出確率 */
function lgamma(x){ const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (let j = 0; j < 6; j++) s += c[j] / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function gQ(a, x){ if (x <= 0) return 1; let t = Math.exp(-x), s = 0; for (let k = 0; k < a; k++){ s += t; t *= x / (k + 1); } return Math.min(1, s); }
function pdNF(n, s, T){
  const lam = n * s; if (!(lam > 0)) return gQ(n, T);
  if (n + lam - T > 10 * Math.sqrt(n + 2 * lam)) return 1;
  const k0 = Math.floor(lam), kmax = k0 + Math.ceil(12 * Math.sqrt(lam + 1)) + 30, q = new Float64Array(kmax + 1);
  let t = Math.exp(-T), acc = 0; for (let j = 0; j < n; j++){ acc += t; t *= T / (j + 1); }
  for (let k = 0; k <= kmax; k++){ q[k] = acc; acc += t; t *= T / (n + k + 1); }
  const p0 = Math.exp(-lam + k0 * Math.log(lam) - lgamma(k0 + 1)); let sum = 0, p = p0;
  for (let k = k0; k <= kmax; k++){ sum += p * q[k]; p *= lam / (k + 1); if (p < 1e-18 && k > k0 + 5) break; }
  p = p0; for (let k = k0 - 1; k >= 0; k--){ p *= (k + 1) / lam; sum += p * q[k]; if (p < 1e-18) break; }
  return Math.min(1, sum);
}
const pdOf = (snr, x) => pdNF(1, snr, x * Math.LN10);             // 誤警報確率 10^-x → しきい値 T = −ln Pfa（1 つのセル、2 乗検波）
const RQ = {};
function reqSnr(x, pd){ pd = pd || SCN.pdReq; const key = x + '/' + pd; if (RQ[key] === undefined){ let lo = -10, hi = 40; for (let i = 0; i < 50; i++){ const m = (lo + hi) / 2; if (pdOf(lin(m), x) < pd) lo = m; else hi = m; } RQ[key] = (lo + hi) / 2; } return RQ[key]; }      // 検出に要る S/N [dB]
/* 第5回（c5_core.js）から写した式 */
function binom(n, k){ let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
function pMofN(M, N, p){ let s = 0; for (let k = M; k <= N; k++) s += binom(N, k) * Math.pow(p, k) * Math.pow(1 - p, N - k); return s; }
/* ドップラ処理：Hann の重み。目標に合わせたフィルタの利得と、ドップラが df [Hz] ずれた信号（クラッタ）への応答 */
const WIN = (() => { const w = []; let s1 = 0, s2 = 0; for (let k = 0; k < SCN.np; k++){ const v = 0.5 - 0.5 * Math.cos(2 * Math.PI * (k + 0.5) / SCN.np); w.push(v); s1 += v; s2 += v * v; } return {w, s1, s2, gain: s1 * s1 / s2, loss: SCN.np * s2 / (s1 * s1)}; })();
function dopResp(df){ let re = 0, im = 0; for (let k = 0; k < SCN.np; k++){ const a = 2 * Math.PI * df * k / SCN.fp; re += WIN.w[k] * Math.cos(a); im += WIN.w[k] * Math.sin(a); } return (re * re + im * im) / WIN.s2; }      // 雑音の出力を 1 としたときの、電力の倍率
const lamOf = () => C0 / (SCN.fg * 1e9), fdOf = v => 2 * v / lamOf(), vBlind = () => SCN.fp * lamOf() / 2;
/* S/N の家計簿：受信機の入り口から、処理のあとまで。値は dB */
function chain(s){
  s = s || S;
  const lam = lamOf(), g = 4 * Math.PI * SCN.ae / (lam * lam), tb = TBS[s.tbi], tau = tb / SCN.B, Fn = lin(s.fn), R = s.R * 1000;
  const pr = prOf(SCN.pt, g, SCN.ae, s.rcs, R), nz = KT0 * SCN.B * Fn, in_ = db10(pr / nz), mf = db10(tb), integ = db10(SCN.np), lw = db10(WIN.loss);
  const cOut = lin(SCN.cnr) * dopResp(fdOf(s.v)), cl = db10(1 + cOut), snrNoClut = in_ + mf + integ - lw, out = snrNoClut - cl, req = reqSnr(s.x), pd = pdOf(lin(out), s.x);
  return {lam, g, tb, tau, Fn, pr, nz, pav: SCN.pt * SCN.fp * tau, in_, mf, integ, lw, cl, cOut, afterMf: in_ + mf, out, req, margin: out - req, pd, pfa: Math.pow(10, -s.x), fa: NCELLS * Math.pow(10, -s.x), delay: 2 * R / C0, fd: fdOf(s.v)};
}
const with_ = o => Object.assign({}, DEFAULTS, o);
/* 第15回の式1.5 で求めた最大探知距離（n = 16、Ei = 1、重み付けの損失を Ls に入れる）。クラッタは入れない */
function rmaxEq15(s){ s = s || S; const lam = lamOf(), g = 4 * Math.PI * SCN.ae / (lam * lam), tau = TBS[s.tbi] / SCN.B; return rmax15({pav: SCN.pt * SCN.fp * tau, g, ae: SCN.ae, rcs: s.rcs, n: SCN.np, ei: 1, F: 1, Fn: lin(s.fn), fp: SCN.fp, snr1: lin(reqSnr(s.x)), Ls: WIN.loss}); }
/* 受信した波形（複素数、1 µs きざみ）。雑音の平均の電力を 1 とする。エコーは i0 から tb 個。整合フィルタは、チャープとの相関 */
const WV = {N: 520, i0: 160};
function chirp(L){ const re = new Float64Array(L), im = new Float64Array(L); for (let k = 0; k < L; k++){ const t = k - (L - 1) / 2, ph = Math.PI * t * t / L; re[k] = Math.cos(ph); im[k] = Math.sin(ph); } return {re, im}; }
function wave(snrInDb, tb, seed, noNoise){
  const g = gaussGen(seed || 160), N = WV.N, re = new Float64Array(N), im = new Float64Array(N), c = chirp(tb), a = Math.sqrt(lin(snrInDb));
  for (let i = 0; i < N; i++){ const nr = g() * Math.SQRT1_2, ni = g() * Math.SQRT1_2; if (!noNoise){ re[i] = nr; im[i] = ni; } }
  for (let k = 0; k < tb; k++){ re[WV.i0 + k] += a * c.re[k]; im[WV.i0 + k] += a * c.im[k]; }
  const M = N - tb + 1, pin = new Float64Array(N), pout = new Float64Array(M);
  for (let i = 0; i < N; i++) pin[i] = re[i] * re[i] + im[i] * im[i];
  for (let m = 0; m < M; m++){ let sr = 0, si = 0; for (let k = 0; k < tb; k++){ sr += re[m + k] * c.re[k] + im[m + k] * c.im[k]; si += im[m + k] * c.re[k] - re[m + k] * c.im[k]; } pout[m] = (sr * sr + si * si) / tb; }
  return {pin, pout, M};
}
/* 距離とドップラの図：距離のセル 48 個 × 16 パルス。クラッタはセル 8〜40、目標はセル 24。ドップラは 64 点に細かくして描く */
const RD = {nr: 48, nd: 64, tc: 24, c0: 8, c1: 40};
function rdMap(s){
  s = s || S; const ch = chain(s), g = gaussGen(1616), n = SCN.np, nd = RD.nd, db = new Float64Array(RD.nr * nd), at = Math.sqrt(lin(ch.afterMf)), row = new Float64Array(RD.nr);
  const cs = []; for (let r = 0; r < RD.nr; r++) cs.push([g(), g(), g()]);
  for (let r = 0; r < RD.nr; r++){
    const inC = r >= RD.c0 && r <= RD.c1, ca = inC ? Math.sqrt(lin(SCN.cnr + 3 * cs[r][2])) : 0, cph = Math.PI * cs[r][0], xr = [], xi = [];
    for (let k = 0; k < n; k++){ let a = g() * Math.SQRT1_2 + ca * Math.cos(cph), b = g() * Math.SQRT1_2 + ca * Math.sin(cph); if (r === RD.tc){ const ph = 2 * Math.PI * ch.fd * k / SCN.fp + 1; a += at * Math.cos(ph); b += at * Math.sin(ph); } xr.push(a * WIN.w[k]); xi.push(b * WIN.w[k]); }
    for (let d = 0; d < nd; d++){ let sr = 0, si = 0; for (let k = 0; k < n; k++){ const ang = -2 * Math.PI * d * k / nd, c = Math.cos(ang), sn = Math.sin(ang); sr += xr[k] * c - xi[k] * sn; si += xr[k] * sn + xi[k] * c; } db[r * nd + d] = db10(Math.max(1e-6, (sr * sr + si * si) / WIN.s2)); }
    const fb = ((ch.fd / SCN.fp) % 1 + 1) % 1; let sr = 0, si = 0; for (let k = 0; k < n; k++){ const ang = -2 * Math.PI * fb * k, c = Math.cos(ang), sn = Math.sin(ang); sr += xr[k] * c - xi[k] * sn; si += xr[k] * sn + xi[k] * c; } row[r] = db10(Math.max(1e-6, (sr * sr + si * si) / WIN.s2));
  }
  return {db, row};                                               // row：目標のドップラに合わせたフィルタの出力（距離のセルごと）
}
/* 測定の誤差の目安（補足）：分解能 ÷ √(2·S/N) */
function measErr(s){ const ch = chain(s), q = Math.sqrt(2 * lin(ch.out)), thB = Math.sqrt(ch.lam * ch.lam / SCN.ae) * 180 / Math.PI, dR = C0 / (2 * SCN.B), dV = ch.lam * SCN.fp / (2 * SCN.np); return {sR: dR / q, sA: thB / (SCN.km * q), sV: dV / q, dR, thB, dV, ch}; }
/* 航跡：スキャンごとの検出（検出確率 Pd、距離の誤差 sR）と、誤警報（1 スキャンあたり平均 NCELLS·Pfa 個、場所はばらばら）。乱数の種は固定 */
const TRK = {N: 12, M: 3, W: 4, gate: 400};
function trackSim(s){
  s = s || S; const me = measErr(s), ch = me.ch, r = mulberry32(516), g = gaussGen(517), T = SCN.ts, scans = [];
  for (let k = 0; k < TRK.N; k++){ const t = k * T, truth = s.R * 1000 - s.v * t, det = r() < ch.pd, z = truth + g() * me.sR, fas = [];
    let L = Math.exp(-ch.fa), p = r(), nf = 0, cum = L, term = L; while (p > cum && nf < 60){ nf++; term *= ch.fa / nf; cum += term; }
    for (let i = 0; i < nf; i++) fas.push({rng: 15 + 135 * r(), az: 360 * r()});
    scans.push({t, truth, det, z, fas}); }
  /* 確定：直近 W スキャンのうち M 回の検出。速さ：検出点への直線の当てはめ（近づく向きが ＋） */
  const st = []; let conf = false, confAt = null;
  for (let k = 0; k < TRK.N; k++){ let c = 0; for (let j = Math.max(0, k - TRK.W + 1); j <= k; j++) if (scans[j].det) c++; if (!conf && c >= TRK.M){ conf = true; confAt = k + 1; }
    let n = 0, st_ = 0, sz = 0, stt = 0, stz = 0; for (let j = 0; j <= k; j++) if (scans[j].det){ n++; st_ += scans[j].t; sz += scans[j].z; stt += scans[j].t * scans[j].t; stz += scans[j].t * scans[j].z; }
    const den = n * stt - st_ * st_, slope = n >= 2 && den > 0 ? (n * stz - st_ * sz) / den : NaN, icpt = n >= 2 && den > 0 ? (sz - slope * st_) / n : NaN;
    st.push({conf, n, vEst: -slope, icpt, slope}); }
  return {scans, st, confAt, me};
}
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  { const pav = 1e6 * 1e-6 * 1e3, c = chain(with_({})); add('§1.1 の例のレーダの平均電力（尖頭 1 MW、パルス幅 1 µs、パルス間隔 1 ms）', '1 kW', fx(pav / 1000, 2) + ' kW。この回の場面（尖頭 10 kW、100 µs、1 ms）も ' + fx(c.pav / 1000, 2) + ' kW', near(pav, 1000, 1e-9) === 'ok' && near(c.pav, 1000, 1e-9) === 'ok' ? 'ok' : 'ng', '§1.1（p.1.1）。この回は、同じ平均電力を、低い尖頭電力と長いパルスで出す場面にした'); }
  { const lam = 0.1, g = 4 * Math.PI * 1.6 / (lam * lam), a = prOf(1e6, g, 1.6, 1, 1e5), c = chain(with_({R: 100})); add('第15回の基準のレーダ（尖頭 1 MW）と、この回（尖頭 10 kW）の受信電力。距離 100 km', '尖頭電力の比（1/100、−20 dB）だけ違う。式1.2 は同じ', '第15回：' + sci(a, 2) + ' W、この回：' + sci(c.pr, 2) + ' W（比 ' + fx(db10(c.pr / a), 2) + ' dB）', near(c.pr / a, 0.01, 1e-12), '式1.2（p.1.11）。第15回の prOf と同じ式'); }
  { const w = wave(-9, 100, 1, true), pk = Math.max(...w.pout), g = db10(pk) + 9; add('整合フィルタの利得（チャープと相関を実際に計算。雑音なし、時間帯域幅積 100）', '時間帯域幅積のぶん：20 dB（第1回）', 'ピークの電力は、入力の ' + fx(g, 2) + ' dB', near(g, 20, 0.01), '出力の S/N は、パルスのエネルギーで決まる（尖頭電力 × パルスの長さ）'); }
  { let acc = 0, cnt = 0; for (let sd = 1; sd <= 40; sd++){ const w = wave(-99, 100, sd); for (let m = 0; m < w.M; m++){ acc += w.pout[m]; cnt++; } } add('整合フィルタの出力の雑音（雑音だけを通して平均。入力の平均を 1 とした）', '変わらない（1 のまま。利得は信号だけに掛かる）', fx(acc / cnt, 3), Math.abs(acc / cnt - 1) < 0.03 ? 'ok' : 'ng', '乱数は固定（40 通りの平均）'); }
  add('位相をそろえた積分の利得（16 パルス）と、重み付けの損失', '利得はパルスの数：12.04 dB（第4回、第15回）。重み付けの損失は、第3回で扱ったもの', '重みなし：' + fx(db10(SCN.np), 2) + ' dB。Hann の重み：' + fx(db10(WIN.gain), 2) + ' dB（損失 ' + fx(db10(WIN.loss), 2) + ' dB）', near(db10(WIN.gain) + db10(WIN.loss), db10(SCN.np), 1e-9), '重みの損失は、ハンドブックのこの節には値がない（補足のモデル）');
  { const c = chain(with_({})), sum = c.in_ + c.mf + c.integ - c.lw - c.cl; const w = wave(c.in_, c.tb, 1, true), a = Math.sqrt(Math.max(...w.pout)), cc = Math.sqrt(lin(SCN.cnr)); let tr = 0, ti = 0, kr = 0, ki = 0; for (let k = 0; k < SCN.np; k++){ const ph = 2 * Math.PI * c.fd * k / SCN.fp; tr += WIN.w[k] * a; kr += WIN.w[k] * cc * Math.cos(ph); ki -= WIN.w[k] * cc * Math.sin(ph); } const direct = db10((tr * tr + ti * ti) / (WIN.s2 + kr * kr + ki * ki)); add('家計簿の合計（各段階の dB の和）と、処理後の S/N', '同じ値になる', '合計：' + fx(sum, 2) + ' dB、波形を整合フィルタとドップラフィルタに実際に通して求めた値：' + fx(direct, 2) + ' dB', near(sum, direct, 0.01), '場面の標準の値（120 km、1 m²、20 m/s）。入り口 ' + fx(c.in_, 2) + '、整合フィルタ +' + fx(c.mf, 2) + '、積分 +' + fx(c.integ, 2) + '、重み −' + fx(c.lw, 2) + '、クラッタ −' + fx(c.cl, 2) + ' dB'); }
  { const s = with_({}); let lo = 1, hi = 1000; for (let i = 0; i < 60; i++){ const m = (lo + hi) / 2, c = chain(Object.assign({}, s, {R: m})); if (c.out + c.cl > c.req) lo = m; else hi = m; } const r15 = rmaxEq15(s) / 1000; add('処理後の S/N が、検出に要る S/N と等しくなる距離（クラッタなし）', '第15回の式1.5 の最大探知距離と同じ（n = 16、Ei = 1、Ls = 重み付けの損失）', '家計簿から：' + fx(lo, 3) + ' km、式1.5：' + fx(r15, 3) + ' km', near(lo, r15, 0.01), '式1.5（p.1.12）。第15回の rmax15 と同じ式'); }
  { const a = reqSnr(6), al = -5 * Math.log10(1) + (6.2 + 4.54 / Math.sqrt(1.44)) * Math.log10(Math.log(0.62e6) + 0.12 * Math.log(0.62e6) * Math.log(9) + 1.7 * Math.log(9)); add('検出に要る S/N（検出確率 0.9、誤警報確率 10⁻⁶、ゆらがない目標、1 回の判定）', '第15回：13.11 dB（近似式）。標準の値は 13 dB', fx(a, 2) + ' dB（第4回と同じ計算）。近似式との差 ' + fx(a - al, 2) + ' dB', Math.abs(a - al) < 0.3 ? 'ok' : 'info', '第4回の pdNF を写して計算。第15回の近似式（Albersheim）は ±0.2 dB ほどの誤差を持つ'); }
  { const c = chain(with_({})); add('送信の尖頭電力と、受信するエコーの電力の比（標準の場面）', '（基準なし）§1.1 の例は 10⁻¹⁹（190 dB）', fx(db10(SCN.pt / c.pr), 1) + ' dB（送信 ' + fx(db10(SCN.pt), 0) + ' dBW、エコー ' + fx(db10(c.pr), 1) + ' dBW）', 'ref', '§1.1（p.1.2）。条件が違うので、桁が近いことの確認'); }
  { const m = measErr(with_({})); add('測定の誤差の目安（標準の場面。分解能 ÷ √(2·S/N)）', '（基準なし）', '距離 ' + fx(m.sR, 1) + ' m（分解能 ' + fx(m.dR, 0) + ' m）、角度 ' + fx(m.sA, 3) + '°（ビーム幅 ' + fx(m.thB, 2) + '°）、速さ ' + fx(m.sV, 2) + ' m/s（分解能 ' + fx(m.dV, 2) + ' m/s）', 'ref', '補足のモデル。角度は第8回と同じ形（km = 1.6）'); }
  { const t = trackSim(with_({})), p = pMofN(TRK.M, TRK.W, t.me.ch.pd); add('航跡の確定（4 スキャンのうち 3 回の検出）', '（基準なし）', '標準の場面：' + t.confAt + ' スキャン目に確定。4 スキャンで確定できる確率 ' + fx(p, 3), 'ref', '補足のモデル。確率は第5回の pMofN と同じ式'); }
  return R;
}
