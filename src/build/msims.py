"""中級シリーズの回の一覧（build_m.py、make_fw_m.py、build_index2.py が使う）。
番号: (ファイル, 題, 計算部分の一覧, ステップ定義, 英語の題, もとにした章, 説明, 前提となる回)"""
MSIMS = {
 1: ('m01_detection.html', '検出の計算', ['cm01_core.js'], 'sm01_steps.js', 'Detection Performance Calculation', '第4章 §4.6 Range Performance（p.4.39–4.48）',
     '誤報の要求から誤警報確率を決め、必要な S/N、損失、探知距離（1 回の検出確率と、累積の検出確率）を、手で計算して計算書にまとめます。', '入門 第4回、第15回、第16回'),
 2: ('m02_clutter_performance.html', 'クラッタの中の性能', ['cm_common.js', 'cm02_core.js'], 'sm02_steps.js', 'Performance in Clutter', '第2章 MTI Radar §2.4〜2.6、§2.12（p.2.10–2.25、p.2.65–2.78）',
     'クラッタのセルの面積から C/S を出し、要る改善係数と、得られる改善係数（クラッタの広がり、安定度、A/D の段数の内訳）を比べて、余裕を計算書にまとめます。', '入門 第2回、第14回、中級 第1回'),
}
