"""入門の回の一覧（build2.py、build.py、gterm.py、build_glossary.py が使う）。
番号: (ファイル, 題, 計算部分の一覧, ステップ定義)。中級の回は msims.py。"""
# 第0回、第5回以降（build2.py）
SIMS={0:('00_basics.html','第0回 レーダの基礎の基礎',['c0_core.js'],'s0_steps.js'),
      5:('05_tracking.html','第5回 自動追尾',['c5_core.js'],'s5_steps.js'),
      6:('06_amti.html','第6回 航空機搭載MTI（AMTI）',['c6_core.js'],'s6_steps.js'),
      7:('07_phased_array.html','第7回 フェーズドアレイアンテナ',['c7_core.js'],'s7_steps.js'),
      8:('08_monopulse.html','第8回 モノパルス測角と追尾レーダ',['c8_core.js'],'s8_steps.js'),
      9:('09_propagation.html','第9回 電波の伝わり方（伝搬）',['c9_core.js'],'s9_steps.js'),
 10:('10_rcs.html','第10回 レーダ断面積（RCS）',['c10_core.js'],'s10_steps.js'),
 11:('11_sar.html','第11回 合成開口レーダ（SAR）',['c11_core.js'],'s11_steps.js'),
 12:('12_eccm.html','第12回 電子防護（ECCM）',['c12_core.js'],'s12_steps.js'),
 13:('13_scheduling.html','第13回 ビームのスケジューリング',['c13_core.js'],'s13_steps.js'),
 14:('14_clutter_map.html','第14回 クラッタマップ',['c14_core.js'],'s14_steps.js'),
 15:('15_radar_equation.html','第15回 レーダ方程式',['c15_core.js'],'s15_steps.js'),
 16:('16_signal_chain.html','第16回 信号を追う（送信から航跡まで）',['c16_core.js'],'s16_steps.js'),
 17:('17_design_exercise.html','第17回 レーダを 1 台設計する（艦艇の多機能レーダを例に）',['c17_core.js'],'s17_steps.js')}
# 第1〜4回（build.py。古い共通部品で組み立てる）
LEGACY={1:('01_pulse_compression.html','第1回 パルス圧縮',['core.js'],'s1_steps.js'),
      2:('02_mti.html','第2回 MTI（移動目標指示）',['mcore.js'],'s2_steps.js'),
      3:('03_pulse_doppler.html','第3回 パルスドップラ',['pcore.js','pchecks.js'],'s3_steps.js'),
      4:('04_detection_cfar.html','第4回 自動検出とCFAR',['ccore.js','cchecks.js'],'s4_steps.js')}
