"""中級シリーズの回の一覧（build_m.py、make_fw_m.py、build_index2.py が使う）。
番号: (ファイル, 題, 計算部分の一覧, ステップ定義, 英語の題, もとにした章, 説明, 前提となる回)"""
MSIMS = {
 1: ('m01_detection.html', '検出の計算', ['cm01_core.js'], 'sm01_steps.js', 'Detection Performance Calculation', '第4章 §4.6 Range Performance（p.4.39–4.48）',
     '誤報の要求から誤警報確率を決め、必要な S/N、損失、探知距離（1 回の検出確率と、累積の検出確率）を、手で計算して計算書にまとめます。', '入門 第4回、第15回、第16回'),
 2: ('m02_clutter_performance.html', 'クラッタの中の性能', ['cm_common.js', 'cm02_core.js'], 'sm02_steps.js', 'Performance in Clutter', '第2章 MTI Radar §2.4〜2.6、§2.12（p.2.10–2.25、p.2.65–2.78）',
     'クラッタのセルの面積から C/S を出し、要る改善係数と、得られる改善係数（クラッタの広がり、安定度、A/D の段数の内訳）を比べて、余裕を計算書にまとめます。', '入門 第2回、第14回、中級 第1回'),
 3: ('m03_waveform_ambiguity.html', '波形とあいまいさ', ['cm_common.js', 'cm03_core.js'], 'sm03_steps.js', 'Waveform and Ambiguity', '第4章 §4.1・§4.4・§4.5、第8章 §8.2（p.4.1–4.2、p.4.31–4.39、p.8.3–8.8）',
     'PRF と波長から、あいまいにならない距離と速度を出し、複数の PRF での解き方、エクリプシング、パルス圧縮の値を決めて、要求と見比べます。', '入門 第1回、第3回、中級 第1回'),
 4: ('m04_measurement_accuracy.html', '測定の精度', ['cm_common.js', 'cm04_core.js'], 'sm04_steps.js', 'Measurement Accuracy', '第9章 Tracking Radar §9.7〜9.11（p.9.26–9.46）、第7章 §7.3（表7.3）',
     '角度・距離・速度の測定の誤差を、熱雑音、グリント、多重反射などの原因ごとに計算し、合成して、追尾フィルタでならしたあとの値までを、誤差の一覧表にまとめます。', '入門 第5回、第8回、第16回、中級 第1回'),
 5: ('m05_array_practice.html', 'アレイの実際', ['cm_common.js', 'cm05_core.js'], 'sm05_steps.js', 'Phased Arrays in Practice', '第13章 Phased Array Radar Antennas §13.2・§13.5〜13.7（p.13.9–13.15、p.13.28–13.46）',
     '利得と振る範囲から素子の数と間隔を決め、誤差・移相器のビット数・故障がサイドローブに与える影響、帯域の制約、走査の損失を計算して、要求と見比べます。', '入門 第7回、第17回、中級 第1回'),
 6: ('m06_propagation_coverage.html', '伝搬と覆域', ['cm_common.js', 'cm06_core.js'], 'sm06_steps.js', 'Propagation and Coverage', '第26章 The Propagation Factor（p.26.1–26.28）、第19章 §19.3（図19.1）',
     '屈折と水平線、海面の反射によるローブ、伝搬因子の 4 乗、ダクト、雨の減衰を計算し、自由空間の探知距離が、環境でどう変わるかを、覆域の図と計算書にまとめます。', '入門 第9回、第17回、中級 第1回'),
 7: ('m07_resource_budget.html', '時間と資源の見積もり', ['cm_common.js', 'cm07_core.js'], 'sm07_steps.js', 'Time and Resource Budget', '§1.4（式1.6）、§4.6（式4.27）、§24.11（p.24.44–24.45）、Smouse ほか (2020) 前半',
     '捜索 1 巡の時間、追尾 1 つの負荷、占有率と余裕を計算し、時間が足りないときに何が延び、何を失うかを、時間の計算書にまとめます。', '入門 第13回、第15回、中級 第1回'),
 8: ('m08_performance_report.html', '性能計算書を通して作る', ['cm_common.js', 'cm08_core.js'], 'sm08_steps.js', 'Building a Performance Report', '§1.4、§1.10 と、中級 第1〜7回で使った章',
     '同じ例のレーダと要求について、第1〜7回の計算書を通して使い、前提の食い違いを見つけ、判定と感度の順位を 1 枚にまとめます。新しい式は使いません。', '入門 第17回、中級 第1〜7回'),
}
