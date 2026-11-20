/* ============================================================
   ハンドブックの式・記載値との照合（共通設定とは独立した固定条件）
   ============================================================ */
function peakOf(arr, i0, i1){ let ib = i0; for (let i = i0; i < i1; i++) if (arr[i] > arr[ib]) ib = i; return ib; }
function runChecks(){
  const out = [];
  const add = (item, cond, meas, ref, unit, tol, src, note) => out.push({item, cond, meas, ref, unit, tol, src, note: note || '', ok: tol === null ? null : Math.abs(meas - ref) <= tol});
  const base = x => Object.assign(cloneDef(), {t: [{on: true, r: 9, v: 45, s: 0}, {on: false, r: 5, v: -30, s: 0}, {on: false, r: 24, v: 110, s: 5}]}, x || {});
  const one = (r, v, s) => [{on: true, r, v, s: s || 0}, {on: false, r: 5, v: 0, s: 0}, {on: false, r: 5, v: 0, s: 0}];
  const fineF = (sim, g) => { const sp = gateSpectrum(sim, g, 'none', 16), i = peakOf(sp.db, 0, sp.M); return sp.f0 + i * sp.df; };
  /* 1) ドップラ周波数 fd = 2V/λ（p.4.1） */
  {
    const o = base({t: one(9, 45)}), sim = simulate(o, {noClutter: true, noNoise: true}), t = sim.tg[0];
    add('ドップラ周波数（シミュレーションのスペクトルのピーク）', '10 GHz（λ = 3 cm）、接近速度 45 m/s', fineF(sim, t.g), 2 * 45 / 0.03, 'Hz', 10, 'fd = 2V/λ, p.4.1');
    const o2 = base({f: 3, t: one(9, -30)}), sim2 = simulate(o2, {noClutter: true, noNoise: true});
    add('同：離隔する目標（負のドップラ周波数）', '3 GHz（λ = 10 cm）、接近速度 −30 m/s', fineF(sim2, sim2.tg[0].g), -600, 'Hz', 10, 'p.4.1（離隔する目標は負）');
  }
  /* 2) あいまいなし距離・速度 */
  {
    const D = derive(base({prf: 10}));
    add('あいまいさのない最大距離 Ru = c/(2·fR)', 'PRF 10 kHz', D.Ru / 1000, 15, 'km', 1e-9, 'p.4.2');
    add('レンジゲートの大きさ', 'ゲート幅 1 µs', D.gate, 150, 'm', 1e-9, '150 m/µs, p.4.9');
    const sim = simulate(base({t: one(21, 45)}), {noClutter: true, noNoise: true}), m = rdMap(sim, 'none'); let gb = 1, vb = -1e9;
    for (let g = 1; g < m.ng; g++) for (let k = 0; k < m.N; k++) if (m.db[g * m.N + k] > vb){ vb = m.db[g * m.N + k]; gb = g; }
    add('距離の折り返し（シミュレーションでピークが現れるレンジゲートの距離）', 'PRF 10 kHz、目標の真の距離 21 km', gb * D.gate / 1000, 6, 'km', 0.001, 'Ru = 15 km で折り返し, p.4.2');
    add('PRF 速度（最初のブラインド速度）fR·λ/2', 'PRF 10 kHz、λ = 3 cm', D.vprf, 150, 'm/s', 1e-9, 'p.4.34, 図4.19');
    const sim2 = simulate(base({t: one(9, 200)}), {noClutter: true, noNoise: true});
    add('速度の折り返し（シミュレーションのピークの見かけの速度）', 'PRF 10 kHz、目標の真の速度 200 m/s', fineF(sim2, sim2.tg[0].g) * D.lam / 2, 50, 'm/s', 0.2, '式4.10（200 − 150 = 50 m/s）');
  }
  /* 3) ドップラ分解能 = 1/CPI */
  {
    const o = base(), D = derive(o);
    add('ドップラフィルタの間隔 PRF/N と 1/CPI', 'PRF 10 kHz、N = 64（CPI 6.4 ms）', D.df, 1 / D.cpi, 'Hz', 1e-9, 'p.4.2（帯域幅 ∝ 1/CPI）');
    const oa = base({t: [{on: true, r: 9, v: 20 * D.dv, s: 0}, {on: true, r: 9, v: 21 * D.dv, s: 0}, {on: false, r: 5, v: 0, s: 0}]});
    oa.t[1].r = 6; const sa = simulate(oa, {noClutter: true, noNoise: true}), ma = rdMap(sa, 'none');
    const k1 = peakOf(ma.db, sa.tg[0].g * 64, sa.tg[0].g * 64 + 64) % 64, k2 = peakOf(ma.db, sa.tg[1].g * 64, sa.tg[1].g * 64 + 64) % 64;
    add('ドップラ周波数が 1/CPI だけ異なる 2 目標のピークのフィルタ番号の差', 'シミュレーション（N = 64）', k2 - k1, 1, '', 0, '1/CPI = フィルタ 1 本分');
    add('フィルタ中心から 1/CPI 離れた目標への応答（重み付けなし）', '応答の最初の零点', Math.max(-200, db10(winResp(getWin(64, 'none'), 1))), -200, 'dB', 1, '理論上 −∞', '数値誤差の範囲で 0');
    add('重み付けなしのフィルタの 3 dB 幅 × CPI', 'N = 64', winStats(64, 'none').w3, 0.886, '', 0.005, '（補足）sin x/x の 3 dB 幅');
    add('コヒーレント積分の利得（シミュレーション：ピーク ÷ 入力 S/N）', 'N = 64、目標はフィルタ中心、雑音なし', ma.db[sa.tg[0].g * 64 + k1], 10 * Math.log10(64), 'dB', 0.01, '10 log N');
    add('2048 パルスのコヒーレント積分の利得', '10 log 2048', 10 * Math.log10(2048), 33.1, 'dB', 0.05, '表4.7, p.4.30');
    const sn = simulate(base({np: 256}), {noClutter: true, noTargets: true}), mn = rdMap(sn, 'c70'); let s = 0, c = 0;
    for (let i = 256; i < mn.db.length; i++){ s += Math.pow(10, mn.db[i] / 10); c++; }
    add('雑音だけのマップの平均レベル', 'N = 256、チェビシェフ 70 dB（雑音で正規化）', 10 * Math.log10(s / c), 0, 'dB', 0.15, '(C+N)/N 表示, 図4.5');
  }
  /* 4) 重み付け */
  {
    const w = winStats(2048, 'c90');
    add('チェビシェフ 90 dB：ピークサイドローブ', 'N = 2048', w.pslDb, -90, 'dB', 0.5, 'p.4.30–4.31');
    add('チェビシェフ 90 dB：重み付け損失', 'N = 2048（N·Σw²/(Σw)²）', w.lossDb, 2.66, 'dB', 0.02, '表4.7, p.4.31');
    add('表4.7：CFAR での熱雑音レベル', '−60 − 33.1 + 2.66 − 3.82', -60 - 10 * Math.log10(2048) + w.lossDb - 8 * Math.log10(3), -94.3, 'dBc', 0.06, '表4.7, p.4.30', 'PDI 3 回の利得 10 log(3^0.8) = ' + (8 * Math.log10(3)).toFixed(2) + ' dB');
    add('重み付けなし：ピークサイドローブ', 'N = 2048', winStats(2048, 'none').pslDb, -13.26, 'dB', 0.05, '（補足）sin x/x の値');
    const w64 = winStats(64, 'c90');
    add('（参考）チェビシェフ 90 dB：重み付け損失', 'N = 64（初期設定のパルス数）', w64.lossDb, 2.66, 'dB', null, '表4.7 は N = 2048', 'パルス数が少ないとわずかに変わる');
  }
  /* 5) 航空機搭載のクラッタ */
  {
    const o = base({vr: 250, h: 3, az: 30, dep: 6, prf: 40, np: 256, cn: 60, t: one(9, 400)}), D = derive(o), cl = clutterModel(o, D);
    const Rmb = D.h / Math.sin(D.dep), g = Math.round((Rmb % D.Ru) / D.gate), M = cl.M, row = cl.P.subarray(g * M, (g + 1) * M), ip = peakOf(row, 0, M);
    const fOf = i => foldF(i * cl.fb, D.prf);
    add('メインビームクラッタのドップラ周波数（モデルのスペクトルのピーク）', 'VR 250 m/s、λ 3 cm、方位 30°、俯角 6°', fOf(ip), 2 * 250 / 0.03 * Math.cos(6 * Math.PI / 180) * Math.cos(30 * Math.PI / 180), 'Hz', 60, '(2VR/λ)cosψ0, p.4.4');
    const sim = simulate(o, {noTargets: true}), sp = gateSpectrum(sim, g, 'c70', 1), ks = peakOf(sp.db, 0, sp.M);
    add('同（シミュレーション：FFT のピークのフィルタの中心）', '同上、PRF 40 kHz、N = 256（フィルタ間隔 156 Hz）', sp.f0 + ks * sp.df, D.fmb, 'Hz', 160, '(2VR/λ)cosψ0, p.4.4', '許容差はフィルタ 1 本分');
    let a = ip, b = ip; while (row[(a - 1 + M) % M] > row[ip] / 4 && ip - a < M / 4) a--; while (row[(b + 1) % M] > row[ip] / 4 && b - ip < M / 4) b++;
    const fr = (i, d) => { const y0 = row[((i) % M + M) % M], y1 = row[((i + d) % M + M) % M]; return (y0 - row[ip] / 4) / (y0 - y1); };
    const wid = (b - a + fr(a, -1) + fr(b, 1)) * cl.fb, th = THB, e44 = D.F * (th * Math.cos(D.dep) * Math.sin(D.az) + th * th * Math.cos(D.dep) * Math.cos(D.az) / 8 + C * D.tau * Math.pow(Math.sin(D.dep), 3) * Math.cos(D.az) / (2 * D.h * Math.cos(D.dep)));
    add('メインビームクラッタのスペクトル幅（ピークから 6 dB 下）', '同上、ビーム幅 3°、パルス幅 1 µs、高度 3 km', wid, e44, 'Hz', 40, '式4.4, p.4.16');
    const un = clutterUnfolded(o, D); let im = 0; for (let i = 0; i < un.U; i++) if (un.p[i] > 1e-12) im = i;
    add('サイドローブクラッタの上端のドップラ周波数', '同上（折り返しなしのスペクトル）', un.f0 + im * un.df, D.F, 'Hz', D.F * 0.02, '2VR/λ, 図4.2');
    let gbest = 1, pbest = -1, cen = 0; const band = g => { let t = 0; for (let i = 0; i < M; i++) if (Math.abs(fOf(i)) < 0.5 * D.F) t += cl.P[g * M + i]; return t; };
    for (let g2 = 1; g2 < D.ng; g2++){ const t = band(g2); if (t > pbest){ pbest = t; gbest = g2; } }
    add('高度線が現れる距離（メインビーム以外のクラッタが最も強いレンジゲート）', '同上、高度 3 km', gbest * D.gate / 1000, 3, 'km', 0.151, '真下からの反射, p.4.5・p.4.18', '許容差はゲート 1 個分');
    for (let i = 0; i < M; i++) if (Math.abs(fOf(i)) < 0.5 * D.F) cen += fOf(i) * cl.P[gbest * M + i];
    add('高度線のドップラ周波数（そのレンジゲートのスペクトルの重心）', '同上（メインビーム付近を除く）', cen / pbest, 0, 'Hz', cl.fb, 'ドップラ 0, p.4.5');
  }
  /* 6) あいまいさの解消 */
  {
    const r = correlate([{ru: 9, amb: [3.1]}, {ru: 10, amb: [8.9]}, {ru: 11, amb: [6.2]}], 0, 60, 0.3, 3);
    add('ハンドブックの例：相関が成立する数', 'ゲート数 9・10・11、測定値 3.1・8.9・6.2、窓 ±0.3、0〜60 ゲート', r.hits.length, 1, '', 0, '図4.18, p.4.32');
    const h = r.hits[0] || {r: NaN, mem: []};
    add('同：相関した距離', '同上（3 本の平均）', h.r, (39.1 + 38.9 + 39.2) / 3, 'ゲート', 0.01, '図4.18（39.1・38.9・39.2）');
    add('同：粗いビンの番号', '9 ゲートごとのビン', Math.floor(h.r / 9) + 1, 5, '', 0, '図4.18（5 番目のビン）');
    const ks = [0, 1, 2].map(p => (h.mem.find(m => m.p === p) || {k: NaN}).k);
    add('同：PRF 1 のアンビギュイティ番号', '同上', ks[0], 4, '', 0, 'p.4.31（5 周期目のエコー）'); add('同：PRF 2・3 のアンビギュイティ番号（和）', '同上', ks[1] + ks[2], 6, '', 0, 'p.4.32（どちらも 3）');
    const o = base({t: one(43.7, 45)}), dets = [0, 1, 2].map(lk => { const sim = simulate(o, {noClutter: true, noNoise: true, look: lk}), m = rdMap(sim, 'none'); let gb = 1, vb = -1e9;
      for (let g = 1; g < m.ng; g++) for (let k = 0; k < m.N; k++) if (m.db[g * m.N + k] > vb){ vb = m.db[g * m.N + k]; gb = g; } return {ru: sim.D.Ru, amb: [gb * sim.D.gate]}; });
    const r2 = correlate(dets, 0, 60000, 150, 3);
    add('シミュレーション：3 つの PRF の測定から求めた距離', 'PRF 10・9・8.18 kHz、真の距離 43.7 km、窓 ±150 m', r2.hits.length === 1 ? r2.hits[0].r / 1000 : NaN, 43.7, 'km', 0.15, '式4.9, p.4.31', 'ゲート幅 150 m の量子化を含む');
    add('線形 FM 測距：目標 A', '傾き 24.28 MHz/s、周波数差 3 kHz', fmRange(3000, 24.28e6) / NMI, 10, '海里', 0.05, '式4.11, 表4.8'); add('線形 FM 測距：目標 B', '周波数差 6 kHz', fmRange(6000, 24.28e6) / NMI, 20, '海里', 0.1, '式4.11, 表4.8');
    let n = 0; for (const f1 of [18, 23]) for (const f0 of [21, 29]) for (const f2 of [24, 35]) if (f1 < f0 && f0 < f2 && f1 + f2 === 2 * f0) n++;
    add('3 区間 FM 測距：式4.12・4.13 を満たす組の数', 'f0 = 21, 29／f1 = 18, 23／f2 = 24, 35 kHz', n, 2, '', 0, '表4.8, p.4.35');
  }
  /* 7) エクリプシング */
  {
    for (const N of [5, 20]){ const D = derive(base({prf: 1000 / N, tau: 1}));
      add('エクリプシングとゲートストラドルの平均損失', 'パルス繰り返し周期 = ' + N + ' ゲート（デューティ ' + (100 / N) + '%）、モデルの平均', -db10(eclipseAvg(D)), 10 * Math.log10(12 * N / (7 * N - 6)), 'dB', 0.01, '式4.17, p.4.41'); }
  }
  /* 8) ダイナミックレンジと安定度 */
  {
    add('A/D の振幅ビット数', 'C/N 53 dB ＋ 余裕 10 dB ＋ 雑音 3 dB、6 dB/ビット', Math.ceil((53 + 10 + 3) / 6), 11, 'ビット', 0, '式4.7, p.4.27');
    add('A/D のピークのダイナミックレンジ', '振幅 11 ビット、雑音 1.414 量子', 20 * Math.log10((Math.pow(2, 11) - 1) / 1.414), 63, 'dB', 0.3, '式4.6, 図4.16');
    add('位相雑音による感度の低下', '位相雑音 ÷ 熱雑音 = −4 dB', 10 * Math.log10(1 + Math.pow(10, -0.4)), 1.5, 'dB', 0.06, '式4.8, p.4.29（約 1.5 dB）');
    const tn = -60 - 10 * Math.log10(180e3);
    add('表4.5：熱雑音の電力密度', '−60 dBc、PRF 180 kHz', tn, -112.6, 'dBc/Hz', 0.06, '表4.5, p.4.29');
    add('表4.5：CW 位相雑音の要求値', '−4 dB の余裕、帯域比 10 log(180 kHz × 1.75 µs)', tn - 4 + 10 * Math.log10(180e3 * 1.75e-6), -121.6, 'dBc/Hz', 0.06, '表4.5, p.4.29');
    const o = base({cn: 60, pn: -64, np: 64, wt: 'c90', t: one(9, 45)}), s1 = simulate(o, {noNoise: true, noTargets: true}), s0 = simulate(Object.assign({}, o, {pn: 0}), {noNoise: true, noTargets: true});
    const m1 = rdMap(s1, 'c90'), m0 = rdMap(s0, 'c90'); let acc = 0, cnt = 0;
    for (let g = 1; g < m1.ng; g++){
      let pr = 0; for (let n = 0; n < 64; n++) pr += s0.re[g * 64 + n] * s0.re[g * 64 + n] + s0.im[g * 64 + n] * s0.im[g * 64 + n]; pr /= 64; if (!(pr > 1000)) continue;
      let d = 0, c = 0; for (let k = 0; k < 64; k++){ if (Math.abs(k - 32) < 6) continue; d += Math.pow(10, m1.db[g * 64 + k] / 10) - Math.pow(10, m0.db[g * 64 + k] / 10); c++; }
      acc += d / c / pr; cnt++;
    }
    add('シミュレーション：位相雑音による雑音フロア（クラッタ比）', '位相雑音 −64 dBc、C/N が 30 dB 以上のレンジゲートの平均', 10 * Math.log10(acc / cnt), -64, 'dBc', 0.3, '式4.8 の前提（クラッタに比例する雑音）');
  }
  add('M-of-N 検出の確率（3-of-8）', '1 ルックの検出確率 0.5', mOfN(0.5, 3, 8), 219 / 256, '', 1e-9, '式4.26, p.4.47');
  return out;
}
