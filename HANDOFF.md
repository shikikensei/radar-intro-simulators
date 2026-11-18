# 引き継ぎメモ（handoff.md）— レーダ 入門シミュレータ シリーズ

> **このリポジトリでの読み替え**
> このメモは、作業環境（`/home/claude`）で書いたものです。リポジトリでは、場所を次のように読み替えてください。
>
> | メモの中の書き方 | リポジトリでの場所 |
> |---|---|
> | `/home/claude/series/` の共通部品（`tpl_head.html`、`fw_*.js`、`c_util.js`、`gloss_add.js`） | `src/framework/` |
> | `/home/claude/series/` の各回の定義（`cN_core.js`、`sN_steps.js`） | `src/episodes/`（第1〜4回の計算部分は `src/episodes/legacy/`） |
> | `build.py`、`build2.py`、`make_fw2.py`、`build_index2.py` | `src/build/` |
> | `fw_core2.js`、`fw_gloss2.js`、`rep/dump.json`（途中で作るファイル） | `src/generated/`（git には入れない） |
> | `/home/claude/out/` | `docs/` |
> | `stest.py`、`itest.py`、`xlink.py`、`dump.py` | `tests/` |
> | `tools/tN.js` | `tests/harness/`（`t13b.js`、`t14.js` だけを入れた） |
> | `sshots/` | `tests/_shots/`（git には入れない） |
>
> 資料の抜粋（PDF、取り出したテキスト、図の切り出し）、読書メモ（`rep/notes_*.md`）、報告書を作るスクリプト（`mkreport*.py`）、シリーズ化する前の単体シミュレータは、リポジトリに入れていません。
> コマンドは、README の「組み立て方」「テスト」の書き方が正しい形です。


更新：第14回の追加時点（**第0〜14回の全 15 本と目次が完成**。次の予定は、全体をつなぐ最終回の第15回。残っている作業は、6 節の「残っていること」を参照）

## 1. 進み具合

| 回 | ファイル | 状態 |
|---|---|---|
| 0 | 00_basics.html | **完成**（10 ステップ） |
| 1〜4 | 01_pulse_compression.html ほか | 作成済み（変更なし。前回納品と同一） |
| 5 | 05_tracking.html | **完成**（9 ステップ） |
| 6 | 06_amti.html | **完成**（8 ステップ） |
| 7 | 07_phased_array.html | **完成**（10 ステップ。まとまり B） |
| 8 | 08_monopulse.html | **完成**（9 ステップ。まとまり B） |
| 9 | 09_propagation.html | **完成**（7 ステップ。まとまり B） |
| 10 | 10_rcs.html | **完成**（7 ステップ。まとまり C） |
| 11 | 11_sar.html | **完成**（8 ステップ。まとまり C） |
| 12 | 12_eccm.html | **完成**（9 ステップ。まとまり C。指示書の案は 8 ステップ） |
| 13 | 13_scheduling.html | **完成**（9 ステップ。2 版でステップ 2「流れを見る」を追加。追加の回。おもな資料は Radar Handbook ではなく、公開の記事。6 節を参照） |
| 14 | 14_clutter_map.html | **完成**（8 ステップ。クラッタマップ。Radar Handbook 第2章 §2.15・§2.2、第7章 §7.2） |
| 15 | （未着手） | 予定：全体をつなぐ回（1 つの目標を、送信から航跡まで通して追う。既存の回の計算をつなぎ、各回へリンクする） |
| — | 00_index.html | 全 15 回にリンク済み。用語集は全回共通の 267 語 |
| — | report.md／report_part2_A.md／report_part2_B.md／report_part2_C.md | 第1〜4回／第0・5・6回／第7・8・9回／第10・11・12回の報告。C の報告に、全 13 本の一覧と、全回共通の用語集（236 語）がある |
| — | report_13.md | 第13回の報告（もとにした資料と使った範囲、記事にない部分をどう決めたか、比較結果の表） |
| — | report_14.md | 第14回の報告（照合で「差あり」とした 3 項目の説明、こちらで決めたモデル） |

## 2. 作業フォルダと作り方

納品した `series_src_14.zip`（これまでの内容を含む最新版）を `/home/claude` に展開すると、同じ構成になります（スクリプト内のパスは `/home/claude/...` の絶対パス）。

```
/home/claude/series/   共通部品とステップ定義
  tpl_head.html        画面の枠と CSS（全回共通。変更しない）
  fw_plot.js           グラフ部品（全回共通。変更しない）
  fw_gloss.js / fw_core.js      第1〜4回用（変更しない）
  make_fw2.py          fw_core.js・fw_gloss.js から、新しい回用の fw_core2.js・fw_gloss2.js を機械的に作る
  gloss_add.js         第0回・第5回以降で追加した用語と前提知識（ここに追記する）
  c_util.js            新しい回で共通の小道具（乱数、sci()、checkTable() など）
  cN_core.js           第 N 回の計算部分（runChecks() を含む）
  sN_steps.js          第 N 回のステップ定義（最後に boot() と </script></body></html>）
  build.py             第1〜4回のビルド（python3 build.py 1 2 3 4）
  build2.py            第0回・第5回以降のビルド（python3 build2.py 0 5 6 7 8 9 10 11 12 13 14）。SIMS の表に新しい回を足す
  build_index2.py      目次のビルド（rep/dump.json を読む。先に dump.py を実行）
/home/claude/out/      ビルド結果（納品物と同じもの）
/home/claude/stest.py  自動テスト：python3 stest.py 07_xxx.html [幅 高さ light|dark タグ]
/home/claude/itest.py  目次のテスト、dump.py：全回のステップ文・照合表を rep/dump.json に取り出す
/home/claude/mkreport2.py  まとまり A の報告書の生成／mkreportB.py／mkreportC.py  まとまり B／C の報告書の生成（回を足すときは、写して NEW・CH・DIFF・検証の表を書きかえる）
/home/claude/xlink.py  回をまたぐリンクの確認（行き先のファイルと、開くステップ番号）
/home/claude/rep/notes_chXX.md  章ごとの読書メモ（式番号・ページ・図の値）
/home/claude/tools/dec.py  PDF の文字化けを直してテキスト化する道具／heads.py（ページごとの見出しと式番号の一覧）／pr.py（ページを指定して本文を表示）／tN.js（計算部分だけを node で試す）／crop.py（PDF のページの一部や、節の見出しの行だけを画像で切り出す）
/home/claude/mont.py  スクリーンショットの一部を並べて 1 枚にする（目視の確認用）
```

新しい回を足す手順：
1. `cN_core.js` と `sN_steps.js` を書く。`build2.py` の SIMS に 1 行足す。
2. `python3 build2.py N`。`make_fw2.py` が `sN_steps.js` の有無を見て SERIES の ready を true にするので、**完成済みの新しい回（0・5〜14）も一緒にビルドし直す**（「次の回へ」のリンクと用語集が更新される）。第1〜4回はビルドし直さない。
3. `stest.py` を 1366×768・820×900・ダークの 3 通りで実行。`sshots/` のスクリーンショットを目で確認。
4. `dump.py` → `build_index2.py` → `itest.py` → `xlink.py`、報告書の生成。

## 3. ステップ定義の書き方（要点）

```
STEPS.push({short, title, src, q, ch:[…], ans, why,
  read:{ana, what, eq, sym, mis}, hosoku:[…], memo,
  init:{…}, ctl:['キー' または {k, min, max, step}], fixed:['キー'], fixT:['文字列'],
  plots:[{h}], acts:[{t, f} または {t, play:{k,min,max,step,ms,once}}],
  mission:{t, ok: r => …}, sol:{…}, solFn, solClicks:[ボタン番号…], free, extra(),
  draw(P){ P[0].set({…}); return {ミッション判定に使う値…, tiles:[{k, v, s}]}; }});
```
- 読み物の記法：`[[キー|文字]]` は押すとグラフの `marks.キー` が光る用語。`{H}` は補足の印。`||` は段落の区切り。
- `sol` はテスト用の「ミッションを達成できる設定」。テストは実際のスライダーを動かして確かめる。
- グラフの設定：series（x, y, color:'s1'|'s2'|'s3'|'ref', w, dash, fill, stem, step, noLine, mk）、pts、arrows、rects、texts、vl、hl、notes、marks、heat（db, rows, cols, x0, x1, y0, y1, zmin, zmax）、equal、xticks／yticks。
- 自由実験のステップ（free: true）にも問い・予想を付ける。`extra: () => checkTable(runChecks())` で照合表を出す。
- 照合の行は `{item, ref, calc, st, note}`。st は 'ok'（一致）／'info'（差あり）／'ng'（不一致）／'ref'（参考：ハンドブックに基準値なし）。

## 4. テンプレート（第1〜4回）から変えた点

- 第1〜4回の HTML・部品は一切変えていない。新しい回は `fw_core2.js`・`fw_gloss2.js`（機械生成）を使う。
- 違いは 3 つだけ：(1) 前提知識の補足に「くわしくは第○回のステップ○」のリンク（`PREQLINK`）。(2) 最後のステップに「次の回へ」（次の回が未完成なら「目次へ戻る」）。(3) 用語集の見出しを「全回共通」にし、回のグループを 0〜12 に拡張（基礎の用語はグループ −1）。
- `fixT`（文字列の「このステップでは固定」）は第1〜4回の最終版にも入っている。
- スライダーのラベルと切り替えボタンは折り返す（CSS。第1〜4回の最終版と同じ）。

- まとまり B（第7〜9回）では、テンプレートと共通部品（tpl_head.html、fw_plot.js、fw_core2.js の生成方法）は変えていない。足したのは `gloss_add.js` の用語と、`build2.py` の SIMS の 3 行だけ。

- まとまり C（第10〜12回）でも、テンプレートと共通部品は変えていない。足したのは `gloss_add.js` の用語と、`build2.py` の SIMS の 3 行だけ。

## 5. 追加した用語と訳語

第1〜4回の 54 語は訳語・説明とも変更なし。追加は次のとおり（説明文は `gloss_add.js`、一覧は report_part2_A.md の用語集）。

- **第0回（17 語）**：レーダ（radar）、目標（target）、エコー（echo）、波長（wavelength）、パルス幅（pulse width）、尖頭電力と平均電力（peak power / average power）、レーダ方程式（radar equation）、レーダ断面積（RCS、radar cross section）、アンテナ利得（antenna gain）、有効開口面積（effective area）、最小検出信号（minimum detectable signal）、雑音指数（noise figure）、ビーム幅（beamwidth）、周波数帯（letter band）、監視レーダ（surveillance radar）、追尾レーダ（tracking radar）、再訪時間（revisit time）
- **第5回（20 語）**：航跡（track）、検出点／プロット（detection / plot）、航跡ファイル（track file）、対応付け（association）、ゲート（gate）、統計距離（statistical distance）、最近傍法（nearest neighbor）、GNN（global nearest neighbor）、平滑化と予測（filtering / prediction）、α-βフィルタ（α-β filter）、追尾ゲイン（tracking gain）、遅れ（lag）、機動（maneuver）、カルマンフィルタ（Kalman filter）、追尾指数（track filtering parameter）、航跡の開始（track initiation）、偽航跡（false track）、アクティビティ制御（activity control）、多重仮説追尾（MHT、multiple hypothesis tracking）、PDA／JPDA（probabilistic data association）
- **第6回（15 語）**：AMTI（airborne MTI、航空機搭載MTI）、プラットフォーム（platform）、対地速度（ground speed）、ボアサイト（boresight）、俯角（depression angle）、スラントレンジ（slant range）、プラットフォーム運動スペクトル（platform-motion spectrum）、TACCAR（time-averaged clutter coherent airborne radar）、位相中心（phase center）、DPCA（displaced phase center antenna）、和パターンと差パターン（sum / difference pattern）、ステップ走査補償（step-scan compensation）、CPCT（coincident phase center technique）、STAP（space-time adaptive processing、時空間適応処理）、自由度（degrees of freedom）

- **第7回（17 語）**：フェーズドアレイ（phased array）、素子（element）、開口（aperture）、アレイファクタ（array factor）、素子パターン（element pattern）、移相器（phase shifter）、ビーム走査（beam scanning）、グレーティングローブ（grating lobe）、照射分布（illumination）、開口効率（aperture efficiency）、位相の量子化（phase quantization）、量子化ローブ（quantization lobe）、開口充填時間（aperture fill time）、時間遅延走査（time-delay steering）、サブアレイ（subarray）、デジタルビーム形成（DBF）、ヌル（null）
- **第8回（19 語）**：モノパルス（monopulse）、振幅比較モノパルス（amplitude-comparison monopulse）、和信号と差信号（sum / difference signals、Σ・Δ）、コンパレータ（comparator）、角度誤差信号（angle-error signal）、誤差の傾き（error slope、km）、ビームの開き（beam offset、squint angle）、円錐走査（conical scan）、ローブ切替（sequential lobing）、AGC（自動利得制御）、サーボ（servo）、サーボ帯域（servo bandwidth）、捕捉（acquisition）、早期ゲートと後期ゲート（early / late gates）、グリント（glint、角度雑音）、シンチレーション（scintillation、振幅雑音）、マルチパス（multipath）、像（image）、ミリラジアン（mrad）
- **第9回（26 語）**：伝搬（propagation）、自由空間（free space）、伝搬因子（propagation factor、F）、自由空間伝搬損失（free-space path loss）、伝搬損失（propagation loss）、屈折（refraction）、屈折率（index of refraction）、屈折度（refractivity、N）、修正屈折度（modified refractivity、M）、標準大気（standard atmosphere）、等価地球半径（effective earth radius）、レーダ水平線（radar horizon）、見通し距離（line-of-sight range）、回折（diffraction）、反射係数（reflection coefficient）、直接波と反射波（direct / reflected wave）、ローブ（lobe）、カバレッジ図（coverage diagram）、異常伝搬（anomalous propagation）、サブリフラクション（subrefraction）、スーパーリフラクション（superrefraction）、トラッピング（trapping）、ダクト（duct）、蒸発ダクト（evaporation duct）、レーダホール（radar hole）、スキップゾーン（skip zone）

- **第10回（21 語）**：散乱（scattering）、後方散乱（backscattering）、dBsm、アスペクト角（aspect angle）、反射点（scatterer / scattering center）、鏡面反射（specular reflection）、レイリー領域（Rayleigh region）、共振領域（resonance region）、光学領域（optics region）、クリーピング波（creeping wave）、進行波エコー（traveling-wave echo）、コーナーリフレクタ（corner reflector）、幾何光学（geometric optics、GO）、物理光学（physical optics、PO）、モーメント法（method of moments）、バイスタティック（bistatic）、遠方界の条件（far-field criterion）、コンパクトレンジ（compact range）、電波吸収材（radar-absorbing material、RAM）、サリスバリースクリーン（Salisbury screen）、形状制御（shaping）
- **第11回（22 語）**：合成開口レーダ（SAR、synthetic aperture radar）、実開口レーダ（RAR、real aperture radar）、合成開口（synthetic aperture）、レンジ方向とクロスレンジ方向（range / crossrange）、クロスレンジ分解能（crossrange resolution）、ストリップマップ（stripmap SAR）、スポットライト（spotlight SAR）、ドップラビームシャープニング（DBS、doppler beam sharpening）、非集束 SAR（unfocused SAR）、位相履歴（phase history）、ファストタイムとスロータイム（fast time / slow time）、スクイント角（squint angle、SAR の場合）、動揺補償（motion compensation）、レンジマイグレーション（range migration）、スラントプレーンとグランドプレーン（slant plane / ground plane）、点像応答（point spread function / impulse response）、積分サイドローブ比（ISLR、integrated sidelobe ratio）、スペックル（speckle）、マルチルック（multilook）、雑音等価 σ⁰（NEσ⁰、noise-equivalent sigma zero）、逆合成開口レーダ（ISAR、inverse SAR）、干渉 SAR（InSAR、interferometric SAR）
- **第12回（25 語）**：電子戦（EW、electronic warfare）、電子支援（ESM、electronic warfare support measures）、電子攻撃（ECM、electronic countermeasures）、電子防護（ECCM、electronic counter-countermeasures）、妨害（jamming）、雑音妨害（noise jamming）、欺まん（deception）、チャフ（chaff）、デコイ（decoy）、自己防御妨害とスタンドオフ妨害（SSJ / SOJ）、実効放射電力（ERP、effective radiated power）、妨害対雑音比（J/N、JNR）、信号対妨害比（S/J）、バーンスルー（burn-through）、サイドローブブランキング（SLB、sidelobe blanking）、サイドローブキャンセラ（SLC、sidelobe canceler）、補助アンテナ（auxiliary antenna）、妨害消去比（JCR、jammer cancellation ratio）、適応アレイ（adaptive array）、周波数アジリティ（frequency agility）、周波数ダイバーシティ（frequency diversity）、低被探知性（LPI、low probability of intercept）、レーダ警報受信機（RWR、radar warning receiver）、電波管制（EMCON、emission control）、ダイナミックレンジ（dynamic range）

- **第13回（18 語）**：レーダ資源管理、ドウェル、スケジューラ、占有率、スケジューラの効率、固定タスク、柔軟タスク、希望時刻、ずれの許容（slack）、フレーム時間、望みのフレーム時間（DFT）、パターンの長さ（PL）、スケジューリング区間（RSI）、可変のスケジューリング区間（DRSI）、次の固定タスク（NFT）、柔軟タスクの遅れ（FTD）、期限の近い順（EDF）、貪欲なスケジューラ

- **第14回（13 語）**：エリア MTI、マップセル、再帰フィルタ、フィルタの定数 α、実効的な平均の回数（Leff）、クラッタマップ損失、立ち上がり（過渡応答）、カットオフ速度、スプレッディング、ゼロ速度フィルタ、MTD、スーパークラッタビジビリティ、点のクラッタ

用語集は、全部で 267 語（基礎 11、第0〜14回 256）。「スクイント」は、第7回では周波数によるビームのずれの説明に、第8回では「ビームの開き」の英語として出てくる。日本語は使い分けている（第7回「ビームのずれ」、第8回「ビームの開き」）。

前提知識の 30 秒補足に追加：「10 の何乗と k・M・G・m・µ」（pow10）、「角度と sin・cos」（trig）、「速さ × 時間 ＝ 距離」（speed）、「位置・速度・加速度と g」（vec）。

C で使いそうな既存の訳語（第10回：レーダ断面積（RCS）、Swerlingモデル、グリント、シンチレーション、ローブ、ヌル。第11回：距離分解能、LFM／チャープ、整合フィルタ、時間サイドローブ、ビーム幅、開口、プラットフォーム、スラントレンジ。第12回：サイドローブ、ヌル、デジタルビーム形成、CFAR、モノパルス、円錐走査、AGC）。そのほか：ビーム幅、アンテナ利得、有効開口面積、サイドローブ、重み付け、位相中心、和パターンと差パターン、レーダ断面積（RCS）、Swerlingモデル、距離分解能、LFM／チャープ、整合フィルタ、S/N、しきい値。**同じ用語は必ず同じ訳語を使う**（新しく足す前に `fw_gloss.js` と `gloss_add.js` を検索）。

## 6. 次に作業する人が知っておくべきこと

- **PDF の読み方**：テキスト抽出は文字コードがずれる（小文字が大文字に、大文字と数字が 0x20 下に）。`tools/dec.py` で直すと本文は読める。ただし式・表・図の中の数値は欠けるので、**必ず `pdftoppm -r 100` でページを画像にして確認**する。章ごとに `rep/notes_chXX.md` へ、式番号・ページ・使う数値をメモしてから作り始める。
- **第0回が前提知識の受け皿**：dB はステップ 3、レーダ方程式は 4、ビーム幅（70λ/D の目安。補足）は 5、I/Q とドップラは 6、周波数帯は 7、雑音と確率は 8、再訪時間は 9。新しい回の `PRE` からここへリンクする。
- **例の数値は回の中でそろえる**：第7回は半波長間隔・16〜32 素子。第8回はビーム幅 2°（1 本）・開き 0.8°、誤差の見積もりは km 1.6・PRF 1000 Hz・サーボ帯域 5 Hz。第9回はアンテナの高さ 20 m・3 GHz・反射係数 0.9。第10回は波長 3 cm（10 GHz）。第11回はハンドブックの例（波長 3 cm、アンテナ 2 m、距離 100 km、180 m/s）と、位相履歴用の小さな例（距離 10 km、100 m/s）。第12回は 100 kW・利得 33 dB・妨害なしの探知距離 100 km。第0回は波長 10 cm・1 MW・利得 33 dB。第5回は精度 50 m・更新 2 秒・1 g（ハンドブックの例）。第6回は波長 70 cm・開口 7 m・PRF 300 Hz。
- **再利用できる計算**：第0回 `bwDeg`・`twoWay`（ガウス形ビーム）・`prOf`／`rmaxOf`（レーダ方程式。第9回の伝搬因子、第12回のバーンスルーに使える）。第6回 `stapSetup`／`stapSolve`（複素コレスキー分解。第7回の適応ヌル、第12回のサイドローブキャンセラに使える）、`impFactor`。第1回 `core.js` の LFM と整合フィルタ（第11回 SAR のアジマス圧縮に使える）。
- 第8回は、第7回のアレイではなく、ガウス形の 2 ビームで作った（1 次元のモノパルスの説明にはそのほうが単純なため）。前提知識から第7回 ステップ 2 へリンクしている。
- **まとまり B で分かったこと（C に向けて）**
  - **指示書の照合項目が、章の抜粋に載っていないことがある。** 第9回は、見通し距離・2 波干渉・ローブの角度の式が第26章になかった。その場合は、一般的な式を「補足」として使い、照合の表では「参考」（基準値なし）とし、ハンドブックの定性的な記述（例：+6 dB／−20 dB）との対応を別の行で確認する。報告書に、節番号の対応のずれも書く。
  - **ハンドブックの記述と計算が合わない箇所は、合わない値を使わず、「差あり」として理由を書く。** B では 2 か所：p.9.31 の σang = 0.19L（計算は 0.128L）、p.26.8 の式26.7 の定数 0.57（0.157 なら表26.1 と合う）。p.9.31 の「2.0L」は 0.2L の誤記とみられる。
  - **節の見出し（大文字）は、テキスト抽出では読めない。** `pdftotext -bbox` で見出しの行の位置を探し、その帯だけを画像で切り出すと確実（第26章で使用）。
  - **濃淡図（heat）の注意**：細かいしま模様は、マス目との干渉で偽の模様（モアレ）が出る。第9回の `coverage()` は、しまが 1 マスより細かい所を平均の強さに近づけている。第11回の SAR 画像でも同じ注意が要る。色の向きはライトとダークで逆（ライトは濃いほど大、ダークは明るいほど大）なので、説明文に「明るい所」「暗い所」と書かず、「右の目盛り」と書く。
  - **グラフ部品の注意**：`series` は省略できない（線がない図でも `series: []`）。`rects` の `fill` は透明度（0〜1）。`texts` は y を省くと図の上端から `row` 行目に出る。
  - **再利用できる計算（B で追加）**：第7回 `pat`／`mainLobe`／`weights`／`nullW`（アレイのパターン、重み付け、適応ヌル。第12回のサイドローブ対策に使える）。第8回 `sd`／`errSig`／`solveAxis`（モノパルスの和・差と、複数の波源に対する指示方向。第12回の角度の欺まんへの対策の説明に使える）、`glint2`／`ampl2`（2 点の干渉。第10回の「見る角度で変わる RCS」は同じ式で書ける）。第9回 `twoRay`（球面上の 2 波干渉）、`horiz`、`lfs`。
  - **第10回と第8回・第4回のつながり**：第8回 ステップ 6 のグリント（2 反射点）は、第10回 ステップ 4（2 反射点の干渉で RCS が変わる）と同じモデル。第8回は「角度」、第10回は「強さ」を見る。`PRE` や読み物でリンクするとよい。
  - **第11回と第7回のつながり**：合成開口は「アレイを時間をかけて作る」ことなので、第7回 ステップ 2（開口とビーム幅）へリンクできる。
- **まとまり C で分かったこと**
  - **1 行に長く書いた JavaScript の途中に `//` のコメントを差し込まない。** その行の残りが全部コメントになり、ページ全体が動かなくなる（「STEPS is not defined」というエラーになる）。C で 2 回起きた。コメントは行の終わりか、関数の先頭の行に書く。ビルドのあと `node --check` で計算部分を確かめると早く気づける。
  - **章の抜粋に、指示書の照合項目の式がないことが続いた**（第10回：2 点の干渉の周期。第12回：妨害下のレーダ方程式とバーンスルー距離）。扱いは B と同じ（補足として使い、判定は「参考」、ハンドブックの定性的な記述との対応を別の行で確認）。
  - **第12回（ECCM）の範囲**：守る側の原理に限った。妨害は「雑音で埋もれさせる」「偽の信号でだます」という分類と、レーダの側での見え方だけを扱い、作り方・使い方には立ち入っていない。数値はすべて説明用。内容を足すときも、この範囲を保つこと（依頼の指定）。
  - **第12回のステップ数は 9**（指示書の案は 8）。アンテナによる防護を、SLB と SLC の 2 ステップに分けた。
  - **第11回の画像**：2 次元の生データからの圧縮ではなく、「距離方向の応答 × アジマス方向の応答」を点目標ごとに足したもの。アジマス方向の応答は、位相履歴との相関を実際に計算している（`azIpr`）。本格的な 2 次元の処理（レンジマイグレーションの補正など）を足すなら、計算量に注意。
  - **再利用できる計算（C で追加）**：第10回 `mieSphere`（金属球の RCS の厳密解）、`plateRcs`、`scatterers`／`rcsOf`（点の反射点の集まり）、`salisbury`。第11回 `azIpr`／`iprStats`（位相履歴の圧縮と、応答の幅・サイドローブの測定）、`sarImage`、`speckleImage`、`nesz`。第12回 `slcSim`（2 チャンネルのサイドローブキャンセラ）、`slbCover`、`rbt`（S = J になる距離）、`rngJam`。
- **第13回（ビームのスケジューリング）で分かったこと**
  - **資料**：Smouse, Liu, Sylvester「Integrated Air and Missile Defense Resource Management」Johns Hopkins APL Technical Digest 35(2), 2020 の前半（p.99–104）。後半（複数のレーダでの追尾の分担）は、特定の任務とシステムに結びつくので使っていない。記事の装置名・任務名も教材に出していない。Radar Handbook は §24.11（p.24.44–24.45）と §7.3（p.7.22）だけを補助に使った。
  - **出典の行**：ステップ定義に `srcRaw: true` を付けると、出典の行の先頭に「Radar Handbook 3rd ed.」を付けない（`make_fw2.py` に追加）。`build_index2.py` の INFO は、章の欄を `!` で始めると、その文をそのまま表示する。照合表の見出しは、`s13_steps.js` の `extra` で「記事・ハンドブック（基準）」に置き換えている。
  - **時間の単位は ms**。仕事の定義は `c13_core.js` の `QS`（追尾 2 種類＝固定タスク、捜索など 3 種類＝柔軟タスク）。`workload(n, na)` が 30 秒ぶんの追尾の要求を作り、`schedLegacy`／`schedNew` が並べ、`stats` が占有率・使えなかった時間・フレーム時間の倍率・落とした固定タスク・希望時刻からのずれを出す。`runBoth(n, slack, na)` は結果を覚えておく（1 回 20 ms ほど）。`verify` は自己点検（重なり、許容の範囲）。
  - **記事にない部分は、こちらで決めた**（従来方式の細部の全部、新方式の「後続の固定タスクの先読み」「区間の上限 100 ms」「新しい一巡の開始時刻」）。最初、記事のとおり「次の固定タスクを 1 つだけ見て、いちばん遅い開始まで詰める」と作ったら、すぐ後ろの固定タスクが大量に落ちた。先読みを入れて 0 件になった。この違いは、計算部分の冒頭コメント、ステップ 5 の補足、report_13.md の 3.4 節に書いてある。
  - **比較の数値は、このモデルの値**であって、実際の装置の性能ではない。画面（ステップ 4・5・7・8・9）と報告書の両方に明記している。数値を変えたら、ミッションの答え（3 版：ステップ 1：44、4：40、5：±6 ms、7：40、8：48、9：40）が変わるので、`tools/t13b.js` で確かめ直す。
  - **「使えなかった時間」**は、すき間のうち、照射 1 回ぶん以上遅れている柔軟タスクがあるときのもの（補足）。仕事がなくて空いた時間と分けるために作った指標。
  - **図の色の言い方**：すき間の濃淡は、ダーク表示で明暗が逆になる。「濃い灰」ではなく「はっきりした灰／薄い灰」と書く（濃淡図の「右の目盛り」と同じ理由）。
  - **ステップ 2「流れを見る」（2 版で追加）**：要求 → 計画 → 照射の 3 段のタイムラインと、ビームの向きの模式図。例は `c13_core.js` の `FLOW`（要求 4 件）と `flowSim()`。「区間の始まりまでに届いた要求で、その区間のあいだに次の区間の計画を作る」という時間の関係は、**資料にない。説明のために置いたもの**（補足として画面と報告書に明記）。操作は「今の時刻」のスライダーと「10 ms 進める」ボタン（`acts`）。
  - **タイムラインの縞**：スケジューラの結果に `bnd`（区間の始まりの時刻の列）を足し、`tlCfg` で 1 つおきに薄く塗っている。従来方式は同じ幅、新方式は幅が変わる。
  - **問いの正解の位置**：第13回は 2 版で散らした（1・2・0・2・1・0・2・1・0）。**第9〜12回は、正解がすべて最初の選択肢のまま**（未修正。`ch` の並びと `ans` を入れ替えれば直る）。新しい回を書くときは、最初から散らすこと。
  - **3 版でモデルを作り直した**：(1) 追尾は「毎周期の照射」（5 ms、標準は目標 3。`NA0`）と「8 周期に 1 回の照射」（6 ms。スライダー `n` はこの目標の数）。周期は 100 ms（`RC`）。(2) 従来方式は、優先度の高い順に周期の頭から詰める（`schedLegacy`）。すき間は周期の終わりだけ。(3) ステップ 2 は、周期の頭から 70 ms の締め切りまで受け付け → 周期の終わりに計画 → 次の周期で照射 → 20 ms 後に結果 → 次の要求、というループ（`FLOW` の `cut`・`tp`）。**この時間の関係と「8 周期」は説明用で、資料に根拠はない。** (4) 指標「同じ目標を照射する間隔のずれ」（`stats` の `jit`）を追加。従来は 0、新方式は数 ms〜10 ms。(5) 自由実験の操作は、目標の数・ずれの許容・毎周期で追う目標の数（`na`）。従来方式の区間の長さの切り替えはなくした。
  - 以前の版（希望時刻のそばに置く従来方式、0.5 秒／2 秒の追尾）の数値は、report_13.md の 3 版には載っていない。必要なら `series_src_13.zip` の前の版を参照。
  - **名前の衝突**：ステップ定義の中で `rt` という名前は使えない（共通部品にある）。組み立てた HTML の `<script>` を取り出して `node --check` にかけると、すぐ分かる。
  - **第15回（全体をつなぐ回）の案**：1 つの目標を、送信 → 伝搬 → 反射 → 受信 → パルス圧縮 → ドップラ処理 → 検出 → 追尾まで通して追う。各ステップから、その処理を扱った回へリンクする。第0回の `prOf`、第1回のパルス圧縮、第4回の検出、第5回の追尾の計算が使える。資料は Radar Handbook 第1章（全体の構成）に戻るのがよい。
- **第14回（クラッタマップ）で分かったこと**
  - **資料**：第2回・第4回のときの抜粋 PDF（MTI、検出と CFAR）に、該当する節があった。`tools/dec.py` で文字を直したテキストは `txtE/` に置いた（PDF のページ番号 n が、ハンドブックの p.2.n に当たる）。図2.89〜2.92 は p.2.84〜2.87。
  - **確率は式で計算している**（`c14_core.js` の `pExceed`）。x がガンマ分布、y が独立なガンマ分布の和のとき、P(x > k·y) を、y の積率母関数とその微分から求める。形のパラメータが整数でなくても使える（ステップ 6 の近似で使っている）。誤警報確率 10⁻⁶ のような小さい値を、乱数を使わずに出せる。
  - **照合の「差あり」3 つ**（損失の例 1.8 dB に対して 1.51 dB、図2.91 の立ち上がりが 1 スキャンほど早い、図2.92 の遅い側が 0.1 ほど高い）は、ハンドブックに計算の細部がないため。合わない値を無理に合わせず、理由を書いてある。
  - **速度の応答のモデル**：「7 セルの中でいちばん強い受信で地図を更新する」とした。平均する案だと、止まっている点のクラッタが抑えられない（検出確率 0.5）。図2.92 に近いのは、この案。
  - **ミッションの答え**：ステップ 1：33 dB、2：α = 1/8、3：12.25 dB、4：α = 1/16、5：α = 1/8、6：175 ノット、7：11 dB、8：積分 4 回・α = 1/4。数値を変えたら `tools/t14.js` で確かめ直す。
  - **ステップ 1 の PPI の絵**：方位 120 本 × 距離 100 セルの場面（`SCN`、`scnSetup`）を作り、地図の値を円の上に並べ直して濃淡図にしている（`ppiImg`）。固定のしきい値を超えたマスを × で重ねる（`ppiCross`）。距離の図は、方位 45° の 1 本。PPI に地図を重ねる見せ方は理解のための絵で、ハンドブックにその表示の説明はない（補足に明記）。**「PPI」は用語集にまだ入れていない**（入れると全回の組み立て直しになるので、次に用語集を触るときに足す）。
  - **第13回とのつながり**：第13回 ステップ 4 に「クラッタマップは第14回で扱う」の一文を入れた。第14回 ステップ 8 の「よくある誤解」で、地図の更新に時間が要ること（第13回）に触れている。
- **残っていること**
  - 第15回（全体をつなぐ回）の作成。
  - 第9〜12回の問いの正解の位置を散らす（すべて最初の選択肢になっている）。
  - Microsoft Edge での動作確認（Chrome のヘッドレスのみで確認している）。
  - 第1〜4回の最後のステップに「次の回へ」のリンクがない。第1〜4回の用語集は 4 回分のまま。どちらも「中身を変えない」指示のために手を付けていない。足す場合は、`fw_core.js`／`fw_gloss.js` を変えるのではなく、`build.py` で第1〜4回も `fw_core2.js`／`fw_gloss2.js` を使うように切り替えるのが簡単（そのかわり、4 本とも作り直しになる）。
  - 原本で確認したい箇所：p.9.31 の σang = 0.19L、p.26.8 の式26.7 の定数 0.57（どちらも report_part2_B.md に詳細）。
- **簡略モデルは必ず明記**：計算部分の冒頭コメント、該当ステップの `hosoku`、報告書の「モデル化で補った点」の 3 か所。
- **ハンドブックの誤記とみられる箇所**：p.3.8 の「0.005Vg」（0.29 kt ÷ 580 kt = 0.0005）。p.7.44 の図7.37 の説明は λP が 2 回出てくる（最初は λF とみられる）。p.9.31 の「0.15L から 2.0L」（0.2L とみられる）。p.26.8 の式26.7 の 0.57（0.157 とみられる）。
- **第12回（ECCM）**：守る側の考え方を原理レベルで。妨害手法の具体的な実施方法には踏み込まない（依頼の指定）。
- **テストの落とし穴**：ミッションの条件は「初期状態では未達成」「sol で達成」の両方を満たすこと。乱数を使うミッションは種を固定し、sol が境界ぎりぎりにならないようにする。
- **未確認**：Microsoft Edge での動作（Chrome のヘッドレスのみで確認）。
- **第1〜4回への追記の余地**：最後のステップに「次の回へ」のリンクがない。依頼では「リンクの追記だけは可」とされているが、今回は手を付けていない。
