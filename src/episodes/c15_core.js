/* ============================================================
   第15回 レーダ方程式：計算部分
   もとにした資料：Radar Handbook 3rd ed. 第1章 §1.4 The Radar Equation（p.1.10–1.13、式1.2〜1.6）
   方針：一般的な原理だけを扱う。数値はすべて説明用（実在の装置の値ではない）。
   ・式1.5 は B·τ ≈ 1 を仮定して導かれている。このシミュレータでは受信機の帯域幅を B = 1/τ とする。
   ・積分の効率 Ei(n) の求め方は第1章に書かれていない。ここでは次の 2 通りを置いた（補足）。
       位相をそろえて足す（コヒーレント積分）：Ei = 1。
       そろえずに足す（非コヒーレント積分）：Albersheim の近似式（一般に知られた経験式。ゆらがない目標、
       検出確率 0.9、誤警報確率 10^-6）で、1 パルスと n パルスの必要な S/N を求め、Ei = (S/N)1 ÷ (n·(S/N)n) とした。
   ・(S/N)1 は値を与えるだけ（決め方は第4回）。
   ・捜索の範囲は「方位 360° × 仰角 0〜θe」とし、立体角 Ω = 2π·sin θe とした（補足）。
   ・ビームの立体角は、式1.6 の導き方にある G = 4π/Ω0 から Ω0 = 4π/G = λ²/Ae とした。
   ============================================================ */
const C0 = 3e8, KT0 = 4e-21;                       // 光の速さ [m/s]、kT0 [W/Hz]（p.1.11）
const DEFAULTS = {pt: 1, tau: 1, fp: 1000, ae: 1.6, fg: 3, rcs: 1, F: 1, fn: 3, snr: 13, n: 1, mode: 'coh', ls: 0, ts: 4, el: 10, form: 'trk'};
const S = Object.assign({}, DEFAULTS);
const lin = d => Math.pow(10, d / 10);
/* 式1.2（p.1.11）：受信電力 */
function prOf(pt, g, ae, rcs, R){ return pt * g / (4 * Math.PI * R * R) * rcs / (4 * Math.PI * R * R) * ae; }
/* 式1.4（p.1.11）：最小検出信号 */
function sminOf(B, Fn, snr1){ return KT0 * B * Fn * snr1; }
/* 式1.3（p.1.11） */
function rmax13(pt, g, ae, rcs, smin){ return Math.pow(pt * g * ae * rcs / (16 * Math.PI * Math.PI * smin), 0.25); }
/* 式1.5（p.1.12）：ふつうの形（目標を t0 = n/fp のあいだ見続ける場合） */
function rmax15(p){ return Math.pow(p.pav * p.g * p.ae * p.rcs * p.n * p.ei * Math.pow(p.F, 4) / (16 * Math.PI * Math.PI * KT0 * p.Fn * p.fp * p.snr1 * p.Ls), 0.25); }
/* 式1.6（p.1.12）：捜索レーダの形 */
function rmax16(p){ return Math.pow(p.pav * p.ae * p.rcs * p.ei * Math.pow(p.F, 4) * p.ts / (4 * Math.PI * KT0 * p.Fn * p.snr1 * p.Ls * p.om), 0.25); }
/* 補足：Albersheim の近似式。ゆらがない目標、n パルスを非コヒーレント積分したときに、1 パルスあたりに要る S/N [dB] */
function albersheim(pd, pfa, n){ const A = Math.log(0.62 / pfa), B = Math.log(pd / (1 - pd)); return -5 * Math.log10(n) + (6.2 + 4.54 / Math.sqrt(n + 0.44)) * Math.log10(A + 0.12 * A * B + 1.7 * B); }
const EI = {pd: 0.9, pfa: 1e-6};
function eiOf(n, mode){ if (mode === 'coh' || n <= 1) return 1; return lin(albersheim(EI.pd, EI.pfa, 1) - albersheim(EI.pd, EI.pfa, n)) / n; }
/* 画面の値（S）から、式に入れる量を作る */
function par(s){
  s = s || S;
  const lam = C0 / (s.fg * 1e9), pt = s.pt * 1e6, tau = s.tau * 1e-6, g = 4 * Math.PI * s.ae / (lam * lam), om0 = 4 * Math.PI / g, om = 2 * Math.PI * Math.sin(s.el * Math.PI / 180);
  const nScan = s.ts * s.fp * om0 / om;            // 捜索のとき、1 つの方向に当たるパルスの数 n = t0·fp、t0 = ts·Ω0/Ω
  const n = s.form === 'srch' ? nScan : s.n;
  return {lam, pt, tau, fp: s.fp, pav: pt * s.fp * tau, B: 1 / tau, ae: s.ae, g, rcs: s.rcs, F: s.F, Fn: lin(s.fn), snr1: lin(s.snr), n, ei: eiOf(n, s.mode), Ls: lin(s.ls), ts: s.ts, om, om0, nScan};
}
const rmaxOf = s => { const p = par(s); return (s || S).form === 'srch' ? rmax16(p) : rmax15(p); };
const sminS = s => { const p = par(s); return sminOf(p.B, p.Fn, p.snr1); };
/* 積分と損失を含めた「実効的な受信電力」：Pr·n·Ei·F⁴/Ls。これが Smin と等しくなる距離が、式1.5 の Rmax */
function preff(s, R){ const p = par(s); return prOf(p.pt, p.g, p.ae, p.rcs, R) * p.n * p.ei * Math.pow(p.F, 4) / p.Ls; }
const with_ = (o) => Object.assign({}, DEFAULTS, o);
const R0 = rmaxOf(with_({}));                        // 基準のレーダ（このシミュレータで決めた例）の最大探知距離
/* 第0回と同じ条件（1 MW、利得 2000 倍、波長 10 cm、RCS 1 m²、帯域 1 MHz、雑音指数 2 倍、必要な S/N 20 倍）を式1.5 で */
function ep0Same(){ const lam = 0.1, g = 2000, ae = g * lam * lam / (4 * Math.PI), sm = sminOf(1e6, 2, 20), r13 = rmax13(1e6, g, ae, 1, sm);
  const r15 = rmax15({pav: 1e6 * 1e-6 * 1000, g, ae, rcs: 1, n: 1, ei: 1, F: 1, Fn: 2, fp: 1000, snr1: 20, Ls: 1});
  let lo = 1e3, hi = 1e6; for (let i = 0; i < 80; i++){ const m = (lo + hi) / 2; if (prOf(1e6, g, ae, 1, m) > sm) lo = m; else hi = m; }
  return {r13, r15, cross: lo}; }
function runChecks(){
  const R = [], add = (item, ref, calc, st, note) => R.push({item, ref, calc, st, note});
  const kt = 1.380649e-23 * 290; add('kT₀（ボルツマン定数 × 290 K）', '4×10⁻²¹ W/Hz', sci(kt, 2) + ' W/Hz', near(kt, 4e-21, 0.01e-21), '式1.4 の説明（p.1.11）');
  { const r = rmaxOf(with_({pt: 16})) / R0; add('式1.3：送信電力を 16 倍にしたときの最大探知距離', '2 倍（4 乗根）', fx(r, 4) + ' 倍', near(r, 2, 1e-9), '式1.3（p.1.11）。ステップ 1'); }
  { const a = rmaxOf(with_({ls: 10})) / R0, b = rmaxOf(with_({ls: 20})) / R0; add('式1.5：システム損失 10 dB／20 dB のときの最大探知距離', '0.56 倍／0.32 倍（10 の −Ls/40 乗）', fx(a, 3) + ' 倍／' + fx(b, 3) + ' 倍', Math.abs(a - 0.562) < 0.001 && Math.abs(b - 0.316) < 0.001 ? 'ok' : 'ng', 'p.1.12「すべての損失を数えると 10〜20 dB になることも珍しくない」。ステップ 7'); }
  { const e = ep0Same(); add('第0回と同じ条件での最大探知距離（式1.3 と、式1.5 で n = 1・Ei = 1・F = 1・Ls = 1・B = 1/τ）', '同じ値になる（第0回 ステップ 4 の答えは 105 km）', '式1.3：' + fx(e.r13 / 1000, 3) + ' km、式1.5：' + fx(e.r15 / 1000, 3) + ' km、式1.2 の交点：' + fx(e.cross / 1000, 3) + ' km', near(e.r13, e.r15, 1e-6) === 'ok' && near(e.r13, e.cross, 1) === 'ok' ? 'ok' : 'ng', '1 MW、利得 2000 倍、波長 10 cm、RCS 1 m²、帯域 1 MHz、雑音指数 2 倍、(S/N)1 = 20 倍。パルス幅 1 µs、PRF 1 kHz（平均電力 1 kW）。第0回の rmaxOf と同じ式'); }
  { const pav = 1e6 * 1e-6 * 1e3; add('平均電力 Pav = Pt·fp·τ（尖頭 1 MW、パルス幅 1 µs、PRF 1 kHz）', '1 kW（§1.1 の例のレーダ）', fx(pav / 1000, 2) + ' kW', near(pav, 1000, 1e-9), 'p.1.12 の Pt = Pav/(fp·τ) と、§1.1（p.1.1）の例'); }
  { const s = with_({form: 'srch', ts: 6, el: 20, fg: 5}), p = par(s), r16 = rmax16(p), n15 = 4 * Math.PI * p.ts / (p.g * p.om) * p.fp, r15 = rmax15(Object.assign({}, p, {n: n15}));
    add('式1.5 に n/fp = 4π·ts/(G·Ω) を入れた値と、式1.6 の値', '同じ値になる（式1.6 の導き方）', '式1.5：' + fx(r15 / 1000, 3) + ' km、式1.6：' + fx(r16 / 1000, 3) + ' km（n = ' + fx(n15, 2) + '）', near(r15, r16, 1e-6), 'p.1.12。再訪時間 6 秒、仰角 0〜20°、5 GHz、Ei = 1'); }
  { const rs = [1, 3, 10].map(f => rmaxOf(with_({form: 'srch', fg: f}))), d = Math.max(...rs) - Math.min(...rs); add('式1.6：Pav・Ae・ts・Ω を固定して、周波数を 1／3／10 GHz に変えたときの最大探知距離', '変わらない（周波数があらわに出てこない）', rs.map(r => fx(r / 1000, 2)).join('／') + ' km', d < 1e-6 ? 'ok' : 'ng', 'p.1.12。位相をそろえて足す（Ei = 1）とした場合。そろえずに足すと、Ei(n) を通して周波数が効く（ステップ 8・9）'); }
  { const r = Math.pow(12 / 4, 0.25); add('式1.6：再訪時間 4 秒と 12 秒の最大探知距離の比', '（基準なし）航空管制のレーダの再訪時間は 4〜12 秒ほど（p.1.12）', fx(rmaxOf(with_({form: 'srch', ts: 12})) / rmaxOf(with_({form: 'srch', ts: 4})), 3) + ' 倍（3 の 4 乗根 = ' + fx(r, 3) + '）', 'ref', '再訪時間を長くすると、1 つの方向を見る時間が延び、距離は ts の 4 乗根で伸びる'); }
  { const s1 = albersheim(0.9, 1e-6, 1); add('(S/N)1 の例：検出確率 0.9、誤警報確率 10⁻⁶、ゆらがない目標', '（第1章に値なし。求め方は第4回）', fx(s1, 2) + ' dB（Albersheim の近似式）', 'ref', '補足。この回の標準の (S/N)1 = 13 dB は、この値に近い。ゆらぐ目標では、もっと大きな値が要る（第4回 ステップ 3）'); }
  add('積分の効率 Ei(n)：そろえずに足す場合（n = 10／100）', '（第1章に値なし）1 より小さい', fx(eiOf(10, 'nc'), 3) + '／' + fx(eiOf(100, 'nc'), 3) + '（' + fx(db10(eiOf(10, 'nc')), 1) + '／' + fx(db10(eiOf(100, 'nc')), 1) + ' dB）', 'ref', '補足。Albersheim の近似式（検出確率 0.9、誤警報確率 10⁻⁶）から求めたモデル。位相をそろえて足すと Ei = 1');
  { const lam = 0.1, ae = 1.6, g = 4 * Math.PI * ae / (lam * lam); add('ビームの立体角 Ω0 = 4π/G と、G = 4π·Ae/λ²', 'G = 4π/Ω0（式1.6 の導き方、p.1.12）', 'Ae = 1.6 m²、λ = 10 cm で G = ' + fx(db10(g), 1) + ' dB、Ω0 = ' + sci(4 * Math.PI / g, 2) + ' sr = λ²/Ae', near(4 * Math.PI / g, lam * lam / ae, 1e-12), '2 つの関係から Ω0 = λ²/Ae'); }
  add('受信機の帯域幅とパルス幅', 'B·τ ≈ 1 を仮定して式1.5 を導いている（p.1.12）', 'B = 1/τ とした（τ = 1 µs で B = 1 MHz）', 'ref', 'パルス圧縮（第1回）では B·τ が 1 よりずっと大きいが、整合フィルタの出力の S/N はパルスのエネルギーで決まるので、式1.5 はそのまま使える（補足）');
  return R;
}
