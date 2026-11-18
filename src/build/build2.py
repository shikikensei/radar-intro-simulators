"""第0回、第5回以降を組み立てる。使い方：python src/build/build2.py 0 5 6 7 8 9 10 11 12 13 14 15 16 17
用語集と「次の回へ」のリンクは全回で共通なので、1 つ足したら、全部を組み立て直す。"""
import sys, subprocess
from pathlib import Path
from paths import rd, wr, DOCS
subprocess.run([sys.executable,str(Path(__file__).with_name('make_fw2.py'))],check=True)
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
for n in [int(a) for a in sys.argv[1:]]:
    f,title,cores,steps=SIMS[n]
    out=rd('tpl_head.html').replace('%%TITLE%%',title).replace('%%NO%%',str(n))
    out=out.replace('</style>','.nextsim{margin:14px 0 4px;font-size:14px}\n</style>',1)
    out+=rd('c_util.js')+'\n'
    for c in cores: out+=rd(c)+'\n'
    out+=rd('fw_plot.js')+'\n'+rd('fw_gloss2.js')+'\n'+rd('fw_core2.js')+'\n'+rd(steps)
    wr(DOCS/f,out); print(f,len(out.encode('utf-8')))
