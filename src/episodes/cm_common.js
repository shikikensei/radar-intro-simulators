/* ============================================================
   中級 第2回以降で共通に使う計算と、例のレーダの値（中級 第1回 cm01_core.js と同じ式・同じ値。第1回は自分の中に持っている）
   例のレーダ（説明用。実在の装置の値ではない）：入門 第15回の基準のレーダを、16 パルス（CPI 16 ms）で使う。
   ============================================================ */
const KT0 = 4e-21, C0 = 3e8;
const EXR = {pav: 1000, ae: 1.6, lam: 0.1, rcs: 1, fn: 3, fp: 1000, np: 16, bn: 62.5, pfa: 1e-6, pd: 0.9, lt: 13.03, tf: 4};      // lt：中級 第1回の損失の表の合計 [dB]
const lin = d => Math.pow(10, d / 10);
function gammaln(x){ const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (let j = 0; j < 6; j++) s += c[j] / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function gammaP(a, x){ if (x <= 0) return 0; if (x < a + 1){ let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 500; n++){ ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-15) break; } return sum * Math.exp(-x + a * Math.log(x) - gammaln(a)); } return 1 - gammaQcf(a, x); }
function gammaQcf(a, x){ const tiny = 1e-300; let b = x + 1 - a, c = 1 / tiny, d = 1 / b, h = d; for (let i = 1; i < 500; i++){ const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < tiny) d = tiny; c = b + an / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-15) break; } return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h; }
function gammaQ(a, x){ if (x <= 0) return 1; return x < a + 1 ? 1 - gammaP(a, x) : gammaQcf(a, x); }
const Km = (x, d) => gammaQ(d / 2, x / 2);
const KMC = new Map();
function KmInv(p, d){ const key = p + '/' + d, c = KMC.get(key); if (c !== undefined) return c; let lo = 0, hi = d + 10; while (Km(hi, d) > p) hi *= 2; for (let i = 0; i < 200; i++){ const m = (lo + hi) / 2; if (Km(m, d) > p) lo = m; else hi = m; if (hi - lo < 1e-13 * hi) break; } const v = (lo + hi) / 2; if (KMC.size < 20000) KMC.set(key, v); return v; }
const erfc = x => x >= 0 ? gammaQ(0.5, x * x) : 2 - gammaQ(0.5, x * x);
/* 第4章 §4.6 の式（中級 第1回）。式4.23：ゆらがない目標の必要 S/N。式4.24・4.25：Swerling。式4.22 は根号の中を −1/4 とした形 */
const etaA = p => Math.sqrt(-0.8 * Math.log(4 * p * (1 - p)));
const etaOf = (pd, pfa) => etaA(pfa) - Math.sign(0.5 - pd) * etaA(pd);
function snr423(pd, pfa, N){ const e = etaOf(pd, pfa); return e * e / N + 2 * e / N * Math.sqrt(N / 2 - 0.25); }
function pd422(snr, pfa, N){ return 0.5 * erfc(etaA(pfa) + Math.sqrt(N / 2 - 0.25) - Math.sqrt(N * snr + N / 2 - 0.25)); }
function pd424(snr, pfa, N, ne){ return Km((KmInv(pfa, 2 * N) - 2 * (N - ne)) / (N / ne * snr + 1), 2 * ne); }
function snr425(pd, pfa, N, ne){ return ((KmInv(pfa, 2 * N) - 2 * (N - ne)) / KmInv(pd, 2 * ne) - 1) * ne / N; }
function cumPd(ps){ const out = []; let q = 1; for (const p of ps){ q *= 1 - p; out.push(1 - q); } return out; }
/* 式4.16：S/N が 1 になる距離 [m]。o = {pav, ae, lam, rcs, fn [dB], bn, lt [dB]} */
function roOf(o){ const g = 4 * Math.PI * o.ae / (o.lam * o.lam); return Math.pow(o.pav * g * g * o.lam * o.lam * o.rcs / (Math.pow(4 * Math.PI, 3) * KT0 * lin(o.fn) * o.bn * lin(o.lt)), 0.25); }
const gainOf = (ae, lam) => 4 * Math.PI * ae / (lam * lam);
/* 中級 第1回の標準の値（同じ条件なら同じ値になることを、各回の照合表と tests/harness で確かめる） */
const M1 = (() => { const s0 = db10(snr423(EXR.pd, EXR.pfa, 1)), s1 = db10(snr425(EXR.pd, EXR.pfa, 1, 1)), ro = roOf(EXR), ro0 = roOf(Object.assign({}, EXR, {lt: 0})); return {s0, s1, ro, ro0, r0: ro * Math.pow(10, -s0 / 40), r1: ro * Math.pow(10, -s1 / 40)}; })();
const sgn2 = (v, d) => (v >= 0 ? '+' : MINUS) + Math.abs(v).toFixed(d === undefined ? 2 : d);
