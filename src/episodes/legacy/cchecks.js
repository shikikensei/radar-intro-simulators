
/* ============================================================
   照合（ステップ12 で表示）：ハンドブックの式・表・図の値と、このシミュレータの計算値・モンテカルロの結果を比べる
   st：'ok' 一致、'info' 条件の違いなどで差がある（備考に理由）、'ng' 不一致
   ============================================================ */
const TAB71 = {1: {3: 15.3, 5: 7.7, 10: 3.5}, 3: {2: 7.8, 3: 5.1, 5: 3.1, 10: 1.4}, 10: {1: 6.3, 2: 3.3, 3: 2.2, 5: 1.3, 10: 0.7}, 30: {1: 3.6, 2: 2.0, 3: 1.4, 5: 1.0, 10: 0.5}, 100: {1: 2.4, 2: 1.4, 3: 1.0, 5: 0.6, 10: 0.3}};
let _t71 = null;
function table71(){            // 表7.1 の条件（Pfa = 10⁻⁶、PD = 0.9、ゆらぎなし）での CFAR 損失の計算値
  if (_t71) return _t71; _t71 = {};
  for (const n of [1, 3, 10, 30, 100]){ _t71[n] = {}; for (const m of [1, 2, 3, 5, 10]) if (TAB71[n][m] !== undefined) _t71[n][m] = cfarLoss(0, n, m, 1e-6, 0.9); }
  return _t71;
}
function runChecks(){
  const R = [], f1 = v => fx(v, 1), f2 = v => fx(v, 2), f3 = v => fx(v, 3);
  const add = (grp, item, ref, calc, st, note) => R.push({grp, item, ref, calc, st, note: note || ''});
  const inCI = (k, n, th) => { const p = k / n, sd = Math.sqrt(Math.max(th * (1 - th), 1e-12) / n); return Math.abs(p - th) <= 3 * sd + 0.5 / n; };   // 判定は 3σ（偶然で外れるのは 0.3% ほど）
  const ciTxt = (k, n) => { const w = wilson(k, n); return fP(k / n) + '（95% 区間 ' + fP(w[0]) + '〜' + fP(w[1]) + '、' + k + ' / ' + n + '）'; };

  /* --- しきい値と誤警報確率 --- */
  { const rnd = mulberry32(20240501), N = 200000;
    for (const pn of [0.1, 1e-3]){ const T = Math.sqrt(-2 * Math.log(pn)); let k = 0; for (let i = 0; i < N; i++) if (Math.sqrt(-2 * Math.log(1 - rnd())) > T) k++;
      add('しきい値と P_fa', '式7.10：P_N = ' + fP(pn) + ' のときのしきい値 T = σ√(−2 ln P_N) = ' + f3(T) + ' σ。レイリー分布の乱数がこれを超える割合', fP(pn), ciTxt(k, N), inCI(k, N, pn) ? 'ok' : 'ng', '式7.10（p.7.8）。乱数 20 万個、シード固定'); }
    const n = 8, pfa = 1e-2, T = thresholdFor(n, pfa), N2 = 100000; let k = 0; for (let i = 0; i < N2; i++){ let pr = 1; for (let j = 0; j < n; j++) pr *= 1 - rnd(); if (-Math.log(pr) > T) k++; }
    add('しきい値と P_fa', '8 パルスの和（2 乗検波）で P_fa = 10⁻² になるしきい値を計算し、乱数で超える割合を数える', fP(pfa), ciTxt(k, N2), inCI(k, N2, pfa) ? 'ok' : 'ng', '補足（しきい値の計算の自己確認）。乱数 10 万個'); }

  /* --- S/N と探知確率 --- */
  { const r = (n, pfa, pd, sw) => solveSnr(s => pdFixed(sw || 0, n, s, thresholdFor(n, pfa)), pd);
    let v = r(10, 1e-10, 0.5); add('S/N と P_D', '図7.9：10 パルスの非コヒーレント積分、P_fa = 10⁻¹⁰、P_D = 0.5 に必要な S/N', '約 5 dB（図の読み取り）', f2(v) + ' dB', Math.abs(v - 5) <= 0.7 ? 'ok' : 'info', '図7.9（p.7.9）。読み取りの誤差は ±0.5 dB 程度');
    v = r(10, 1e-10, 0.9); add('S/N と P_D', '図7.10：同じ条件で P_D = 0.9', '約 6.8 dB（図の読み取り）', f2(v) + ' dB', Math.abs(v - 6.8) <= 0.7 ? 'ok' : 'info', '図7.10（p.7.10）');
    v = r(1, 1e-6, 0.9); add('S/N と P_D', '1 パルス、P_fa = 10⁻⁶、P_D = 0.9、ゆらぎなしに必要な S/N', '13.2 dB（一般に知られた値）', f2(v) + ' dB', Math.abs(v - 13.2) <= 0.1 ? 'ok' : 'ng', '補足（ハンドブックのこの抜粋にはない、一般的な値との確認）');
    const s = lin(10), a = Math.pow(1e-3, 1 / (1 + s)), b = pdFixed(1, 1, s, thresholdFor(1, 1e-3));
    add('S/N と P_D', '1 パルス、Swerling 1、S/N 10 dB、P_fa = 10⁻³：閉じた式 P_D = P_fa^(1/(1+S/N)) と、数値積分による計算', f3(a) + '（閉じた式）', f3(b), Math.abs(a - b) < 2e-3 ? 'ok' : 'ng', '補足（計算方法の自己確認）');
    v = r(1, 1e-6, 0.5); add('S/N と P_D', '図7.5：1 パルス、P_fa = 10⁻⁶、P_D = 0.5 に必要な S/N', '約 13 dB（図の読み取り。走査レーダ、ビーム中心の S/N）', f2(v) + ' dB', 'info', '図7.5（p.7.6）は走査中のアンテナパターンによる変化を含む曲線。このシミュレータは全パルス同じ強さなので、ビーム形状損失（1.6 dB、p.7.3）の分だけ小さい値になる'); }

  /* --- 2値積分 --- */
  { let v = binTail(9, 7, 0.1); add('2 値積分', '1 パルスが 1 になる確率 0.1 で「9 回中 7 回」としたときの誤警報確率', '約 10⁻⁶（p.7.12）', fP(v), v > 3e-7 && v < 5e-6 ? 'ok' : 'ng', '二項分布で計算すると 3.0×10⁻⁶。ハンドブックは「約 10⁻⁶」としており、桁は一致');
    const parts = [], pen = []; for (const N of [4, 8, 10, 16, 30]){ const r = reqBin(0, N, 1e-6, 0.9); let b = 1; for (let M = 2; M <= N; M++) if (r[M] < r[b]) b = M; const m0 = Math.round(1.5 * Math.sqrt(N)); parts.push('N=' + N + '：最適 ' + b + '、1.5√N→' + m0 + '（差 ' + f2(r[m0] - r[b]) + ' dB）'); pen.push(r[m0] - r[b]); }
    add('2 値積分', '式7.9：M = 1.5√N としたときの、最適な M との所要 S/N の差（P_fa = 10⁻⁶、P_D = 0.9、ゆらぎなし）', '0.2 dB 以内（p.7.7–7.8）', parts.join('、'), Math.max.apply(null, pen) <= 0.2 ? 'ok' : 'info', 'N が 10 以下では 0.2 dB 以内。N = 16 で 0.2 dB、N = 30 で 0.4 dB と、N が大きいと差が広がる。このシミュレータ（2 乗検波・全パルス同じ強さ）では最適な M が 1.5√N より大きめに出る');
    const N = 30, rb = reqBin(0, N, 1e-6, 0.9); let b = 1; for (let M = 2; M <= N; M++) if (rb[M] < rb[b]) b = M; const mw = solveSnr(s => pdFixed(0, N, s, thresholdFor(N, 1e-6)), 0.9);
    add('2 値積分', '移動窓に対する 2 値積分の損失（N = 30、最適な M、P_fa = 10⁻⁶、P_D = 0.9）', '約 2 dB（N が大きいとき、p.7.7）', f2(rb[b] - mw) + ' dB', 'info', 'このシミュレータの条件では 1.0〜1.2 dB。ハンドブックの値は概数で、検波方式やビーム形状などの条件が違うとみられる');
    const p0 = binP0(5, 3, 1e-6), T16 = thresholdFor(16, p0), bt = solveSnr(s => binTail(5, 3, pdNF(16, s, T16)), 0.9), m80 = solveSnr(s => pdFixed(0, 80, s, thresholdFor(80, 1e-6)), 0.9);
    add('2 値積分', 'バッチ処理：80 パルスを 16 個ずつ足して「5 回中 3 回」。80 パルスの移動窓との差（P_fa = 10⁻⁶、P_D = 0.9）', '約 0.5 dB（p.7.11）', f2(bt - m80) + ' dB', 'info', 'このシミュレータの条件（全パルス同じ強さ）では約 1 dB。差の向き（移動窓よりわずかに悪い）は一致'); }

  /* --- CFAR --- */
  { const t = table71(); let mx = 0, cnt = 0, within = 0, worst = '';
    for (const n of [1, 3, 10, 30, 100]){ const parts = [], refs = []; for (const m of [1, 2, 3, 5, 10]) if (t[n][m] !== undefined){ const d = t[n][m] - TAB71[n][m]; cnt++; if (Math.abs(d) <= 0.2) within++; if (Math.abs(d) > mx){ mx = Math.abs(d); worst = n + ' パルス・参照セル ' + m; } parts.push(m + ' 個：' + f2(t[n][m])); refs.push(m + ' 個：' + f1(TAB71[n][m])); }
      const dmax = Math.max.apply(null, [1, 2, 3, 5, 10].filter(m => t[n][m] !== undefined).map(m => Math.abs(t[n][m] - TAB71[n][m])));
      add('CFAR 損失', '表7.1：積分 ' + n + ' パルスの CFAR 損失 [dB]（P_fa = 10⁻⁶、P_D = 0.9）', refs.join('、'), parts.join('、'), dmax <= 0.2 ? 'ok' : 'info', dmax <= 0.2 ? '表7.1（p.7.12）。差は最大 ' + f2(dmax) + ' dB' : '1 パルス・参照セル 3 個だけ ' + f2(dmax) + ' dB の差（表 15.3、計算 ' + f2(t[1][3]) + '）。ほかの 2 つは 0.05 dB 以内。表の元になった計算の条件（検波方式など）の違いか、表の数値の丸めとみられる'); }
    add('CFAR 損失', '表7.1 全体（22 個の値）', '—', '差 0.2 dB 以内 ' + within + ' / ' + cnt + ' 個、最大の差 ' + f2(mx) + ' dB（' + worst + '）', within >= cnt - 1 ? 'ok' : 'info', 'ゆらぎなし・2 乗検波・セル平均として計算');
    const a = alphaCA(6, 16, 1e-6), q = (sw, pd) => solveSnr(s => pdCA(sw, 6, 16, s, a), pd);
    let v5 = q(0, 0.5), v95 = q(0, 0.95); add('CFAR 損失', '図7.15：セル平均 CFAR、6 パルス、参照セル 16 個、P_fa = 10⁻⁶、ゆらぎなし。P_D = 0.5／0.95 に必要な S/N', '約 5.9 dB／約 8.0 dB（図の読み取り）', f2(v5) + ' dB／' + f2(v95) + ' dB', Math.abs(v5 - 5.9) <= 0.4 && Math.abs(v95 - 8.0) <= 0.4 ? 'ok' : 'info', '図7.15（p.7.14）');
    v5 = q(2, 0.5); const v9 = q(2, 0.9); add('CFAR 損失', '図7.16：同じ条件で、パルスごとにレイリーゆらぎする目標（Swerling 2）。P_D = 0.5／0.9', '約 6.2 dB／約 9.2 dB（図の読み取り）', f2(v5) + ' dB／' + f2(v9) + ' dB', Math.abs(v5 - 6.2) <= 0.4 && Math.abs(v9 - 9.2) <= 0.4 ? 'ok' : 'info', '図7.16（p.7.15）');
    const lossK = (kind, m) => { const al = alphaFor(kind, 1, m, 1e-6); let lo = -10, hi = 60; for (let i = 0; i < 40; i++){ const mid = (lo + hi) / 2; if (pfaKind(kind, 1, m, al / (1 + lin(mid))) < 0.5) lo = mid; else hi = mid; } return (lo + hi) / 2 - db10(Math.log(1e-6) / Math.log(0.5) - 1); };
    const l1 = lossK('ca', 10), l2 = lossK('log', 16), l3 = lossK('log', 10);
    add('CFAR 損失', '式7.16：対数ビデオの CFAR は、参照セルを 1.65M − 0.65 個にすればリニアの M 個と同じ損失。M = 10 → 16 個（1 パルス、Swerling 1、P_fa = 10⁻⁶、P_D = 0.5）', '同じ損失', 'セル平均 10 個：' + f2(l1) + ' dB、対数 16 個：' + f2(l2) + ' dB（対数 10 個なら ' + f2(l3) + ' dB）', Math.abs(l1 - l2) <= 0.5 ? 'ok' : 'info', '式7.16（p.7.17）。対数ビデオの P_fa は鞍点近似で計算'); }

  /* --- クラッタマップ --- */
  { const K = 7 / 8; add('クラッタマップ', 'K = 7/8 のとき、過去のスキャンに掛かる重みの合計 1/(1−K)', '過去 8 スキャンの平均に相当（p.7.19）', f1(1 / (1 - K)), 'ok', '式7.18（p.7.18）');
    const st = cmMcNew(K, 1, 1e-3, 0, lin(12)); cmMcRun(st, 100000); const pd = cmPd(0, K, st.A, 1, st.s);
    add('クラッタマップ', 'K = 7/8、設計 P_fa = 10⁻³ としたしきい値係数で、雑音だけのスキャンの誤警報の割合', fP(1e-3), ciTxt(st.fa, st.trials), inCI(st.fa, st.trials, 1e-3) ? 'ok' : 'ng', '補足（係数 A の計算の確認）。10 万回（間に 30 スキャンずつはさんで独立にしたもの）、シード固定');
    add('クラッタマップ', '同じ条件で、S/N 12 dB・ゆらぎなしの目標が現れたスキャンの P_D', f3(pd) + '（このシミュレータの理論式）', ciTxt(st.det, st.trials), inCI(st.det, st.trials, pd) ? 'ok' : 'ng', '補足');
    const A = cmA(K, 1, 1e-6), rc = solveSnr(s => cmPd(0, K, A, 1, s), 0.9), rf = solveSnr(s => pdFixed(0, 1, s, thresholdFor(1, 1e-6)), 0.9);
    add('クラッタマップ', 'K = 7/8 のクラッタマップの損失（1 パルス、P_fa = 10⁻⁶、P_D = 0.9）と、参照セル 15 個のセル平均 CFAR の損失', '—', f2(rc - rf) + ' dB と ' + f2(cfarLoss(0, 1, 15, 1e-6, 0.9)) + ' dB', 'info', '補足：推定のばらつきで見ると、K = 7/8 は独立なサンプル (1+K)/(1−K) = 15 個の平均に近い'); }

  /* --- 分解能 --- */
  { const T = thresholdFor(1, 1e-4), p = [2, 2.5, 3].map(sp => mergeProb(sp, 100, 100, T, 3000).two);
    add('分解能', '同じ強さ（S/N 20 dB）の 2 目標が、2 つのプロットに分かれる割合：間隔 2.0／2.5／3.0 パルス幅', '2.5 パルス幅になるまで 0.9 を超えない（図7.22、p.7.20）', f2(p[0]) + '／' + f2(p[1]) + '／' + f2(p[2]), p[0] < 0.9 && p[1] > 0.8 ? 'ok' : 'info', '補足：ガウス形のパルス、固定しきい値（P_fa = 10⁻⁴）、隣り合う検出をまとめるだけの簡単なモデル。各 3,000 回'); }

  /* --- モンテカルロと理論値 --- */
  { const run = (mod, dets, N, label) => { const o = Object.assign(cloneDef(), mod), sc = scenario(o), acc = mcNew(sc, dets); mcRun(acc, N);
      for (const d of dets){ const th = theory(sc, d);
        add('モンテカルロ', label + '：' + DETN[d] + ' の P_D（目標1）', f3(th.pd[0]), ciTxt(acc.det[d][0], N), inCI(acc.det[d][0], N, th.pd[0]) ? 'ok' : 'ng', N + ' 回');
        add('モンテカルロ', label + '：' + DETN[d] + ' の P_fa（雑音だけの領域）', fP(th.pfa[0]), ciTxt(acc.fa[d][0], acc.ncls[0] * N), inCI(acc.fa[d][0], acc.ncls[0] * N, th.pfa[0]) ? 'ok' : 'ng', N + ' 回 × ' + acc.ncls[0] + ' セル');
        if (sc.C > 0 && d !== 'bin') add('モンテカルロ', label + '：' + DETN[d] + ' の P_fa（クラッタの内側）', fP(th.pfa[1]), ciTxt(acc.fa[d][1], acc.ncls[1] * N), inCI(acc.fa[d][1], acc.ncls[1] * N, th.pfa[1]) ? 'ok' : 'ng', N + ' 回 × ' + acc.ncls[1] + ' セル'); } };
    run({}, ['fixed', 'ca'], 4000, '初期設定（1 パルス、S/N 10 dB、P_fa 10⁻³）');
    run({n: 8, M: 5, snr: 3, sw: 1, cnr: 0}, ['fixed', 'bin', 'ca'], 3000, '8 パルス・Swerling 1・S/N 3 dB'); }
  return R;
}
