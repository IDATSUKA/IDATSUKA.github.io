# IDATSUKA — プロモーションパック

idatsuka.com のための広告素材一式です。静止画広告6点、15秒CM用ストーリーボード9枚、
そして実際にレンダリングした15.000秒のモーショングラフィックスCM（16:9 / 9:16）が入っています。

トーンはサイト本体と同じ：ニアブラック `#060607` / アイスブルー `#9fd6ec` /
Space Grotesk・Zen Kaku Gothic New・Space Mono / Michroma由来のワードマーク `img/logo.svg` /
フィルムグレイン / アンビエントなグロー。背景は `js/hero-scenes.js` の5シーン
（Orbit Ring・Curl Flow・Plexus・Aurora・Lattice）から起こしています。

合計サイズ **約15MB**（`ads` 780KB / `storyboard` 768KB / `cm` 12MB / `src` 1.4MB）。

---

## 1. `promo/ads/` — 静止画広告 6点

JPEG 品質 q=3。すべて 600KB 以下。

| ファイル | サイズ | 容量 | 主なメッセージ | 見出し |
|---|---|---|---|---|
| `sq-games.jpg` | 1080×1080 | 98KB | ① ゲーム ＋ ② ランキング | ブラウザで、すぐ遊べる。 |
| `sq-templates.jpg` | 1080×1080 | 121KB | ③ テンプレート | 1ファイルで完成するポートフォリオ。 |
| `story-all.jpg` | 1080×1920 | 179KB | ①②③ 全部（縦積み） | 遊べる。競える。作れる。 |
| `banner-all.jpg` | 1200×628 | 68KB | ①②③ 全部（横長） | 遊べる。競える。作れる。 |
| `wide-games.jpg` | 1920×1080 | 146KB | ① ゲーム ＋ ② ランキング | 遊べる。競える。 |
| `wide-templates.jpg` | 1920×1080 | 148KB | ③ テンプレート | 1ファイルで完成するポートフォリオ。 |

共通要素：ワードマーク、モノスペースの `idatsuka.com`、実物のサムネイル
（`img/game-*.svg|jpg` / `img/store-*.svg`）をブラウザウィンドウ・タイル・カバーに配置、
hero-scene 由来の背景、広い余白、小さなモノスペースのキャプション。

用途の目安：`sq-*` は Instagram / X のフィード、`story-all` はストーリーズ・Reels のカバー、
`banner-all` は OGP・Facebook 広告、`wide-*` は YouTube のサムネイルや Web バナー。

---

## 2. `promo/storyboard/` — 15秒CMのキーフレーム 9枚

`f01.jpg` … `f09.jpg`、すべて **1920×1080 / JPEG q=3**（56〜115KB）。
image-to-video にそのまま渡せるよう、構図は中央寄せ・被写体まわりに動きの余地・文字は大きめにしています。

各カットの内容・意図した動き・尺は **`promo/storyboard/frames.md`** に1行ずつ記載（合計15.000秒）。

---

## 3. `promo/cm/` — 15秒モーショングラフィックスCM

| ファイル | 内容 | 仕様 | 容量 |
|---|---|---|---|
| `cm-16x9.mp4` | 横位置 本編 | 1920×1080 / H.264 crf20 / 30fps / yuv420p / faststart / **15.000秒・450フレーム** | 5.2MB |
| `cm-16x9.webm` | 横位置 Web用 | 1920×1080 / VP9 crf32 / 30fps / **15.000秒** | 1.3MB |
| `cm-9x16.mp4` | 縦位置（クロップではなく**再レイアウト**） | 1080×1920 / H.264 crf20 / 30fps / **15.000秒・450フレーム** | 4.9MB |
| `poster-16x9.jpg` | 横位置ポスター（t=13.25s のタグライン） | 1920×1080 | 63KB |
| `poster-9x16.jpg` | 縦位置ポスター（t=13.25s） | 1080×1920 | 78KB |
| `cm.html` | CM本体のソース（Canvas 2D ＋ CSS） | `?ar=v` で縦位置レイアウト | 41KB |

音声トラックはありません。

### 音楽キューを入れるなら

| 時間 | 提案 |
|---|---|
| 0.00s | 無音から。低いサブベースのスウェル（リングが生成される音） |
| 1.60s | ワードマーク点灯に合わせて **1発目のヒット**。ここから4つ打ちが薄く入る |
| 3.00s / 4.80s / 6.40s | 各カット頭にスネア／ノイズスウィープ（ホワイトフラッシュと同期） |
| 8.40s | ランキングのカウントアップが止まるところでフィルイン |
| 9.90s | テンプレートが扇状に開くところでブレイク（一瞬音を抜く） |
| 11.80s | タグライン「遊べる。競える。作れる。」の立ち上がりで**最大の盛り上がり** |
| 13.40s | エンドカードでリバースシンバル → リリース。14.6s以降はテールのみ |

### 再現手順

CMは「時刻 t の純粋な関数」として書かれています（`window.__CM.seek(t)`）。
乱数はすべて固定シードなので、何度レンダリングしても同じ絵になります。

```
# 1. 背景プレート（hero-scenes.js の実シーンをキャプチャ）
#    promo/src/scene.html を Playwright で開き ?scene=ring|flow|plexus|aurora|lattice
#    → promo/src/plates/*.jpg

# 2. 静止画広告 / ストーリーボード
#    promo/src/*.html を各サイズのビューポートでスクリーンショット → JPEG q3

# 3. CM（30fps・450フレームを1枚ずつ決定論的に描画）
#    promo/cm/cm.html を開き i=0..449 について __CM.seek(i/30) → PNG
ffmpeg -framerate 30 -i f%04d.png -c:v libx264 -preset slow -crf 20 \
       -pix_fmt yuv420p -movflags +faststart -r 30 cm-16x9.mp4
ffmpeg -framerate 30 -i f%04d.png -c:v libvpx-vp9 -crf 32 -b:v 0 -r 30 cm-16x9.webm
```

> **収録方法について** — 当初は Playwright の `recordVideo` で収録しましたが、
> `recordVideo` は 25fps 固定で、1920×1080 のヘッドレス環境では実測 27〜31fps・
> 最大187msのコマ落ちが出ました。指定の「30fps・ちょうど15.000秒」を満たすため、
> 最終版は `__CM.seek(t)` による**1フレームずつの決定論的レンダリング**で書き出しています。
> 結果として尺は `ffprobe` 上でも正確に `duration=15.000000` / `nb_frames=450` です。

### CMに使っている演出

キネティックタイポ（マスクからの立ち上がり・トラッキングイン）、タイルのカスケード、
カウンター式に増えるランキング、ポップするフィルターチップ、扇状に開くテンプレートカバー、
ホイップ／スケールのトランジションとホワイトフラッシュ、そして hero-scene を再現した
ライブ背景（リング・パースペクティブグリッド・カールフロー・オーロラ）。グレインは常時。

---

## 4. `promo/src/` — 制作用ソース

| ファイル | 内容 |
|---|---|
| `promo.css` | 広告・ストーリーボード・CMで共有するデザインシステム |
| `scene.html` | `js/hero-scenes.js` を読み込んで背景プレートを撮るためのページ |
| `plates/` | hero-scene を各サイズで書き出した背景（5シーン × 4サイズ） |
| `sq-games.html` ほか5点 | 各広告のレイアウト |
| `frames.html` | ストーリーボード9フレームを1ページに並べたもの |

フォントはオフラインのフォントキットを `file://` で読んでいます（セッション用の絶対パス）。
別環境で開き直す場合は、各HTMLの先頭にある Google Fonts の `<link>` がそのまま代替になります。

---

## 5. ストーリーボードとCMタイムラインの対応

| フレーム | CMの区間 | 尺 | CM側でやっていること |
|---|---|---|---|
| `f01.jpg` | 0.00 – 1.60 | 1.60s | 中心の光点からリング粒子が生成。ゴーストのワードマークが浮かぶ |
| `f02.jpg` | 1.60 – 3.00 | 1.40s | ワードマークがマスクから立ち上がり、ラベルがトラッキングイン、縦線が伸びる |
| `f03.jpg` | 3.00 – 4.80 | 1.80s | 見出しがマスクライズ、中央のブラウザがスケールイン、左右のタイルがスライドイン |
| `f04.jpg` | 4.80 – 6.40 | 1.60s | 2枚のウィンドウが視差で入り、カーソルが移動してタップ、リングが2重に広がる |
| `f05.jpg` | 6.40 – 8.40 | 2.00s | ボードが浮上、5行が0.11秒差で立ち上がり、スコアがカウントアップ |
| `f06.jpg` | 8.40 – 9.90 | 1.50s | チップが順にポップ、フレンドコードカードが上昇、コードが左から確定 |
| `f07.jpg` | 9.90 – 11.80 | 1.90s | 重なった3枚が扇状に開く。価格行が遅れてフェードイン |
| `f08.jpg` | 11.80 – 13.40 | 1.60s | 「遊べる。」「競える。」「作れる。」が0.19秒差でマスクライズ |
| `f09.jpg` | 13.40 – 15.00 | 1.60s | ワードマーク → 縦線 → URL → サブの順に確定し、最後はホールド |

カットの切り替わり（1.60 / 3.00 / 4.80 / 6.40 / 8.40 / 9.90 / 11.80 / 13.40）には
アイスブルーのフラッシュとスケールのホイップを入れています。

---

## 6. コンプライアンス（景品表示法）

- ユーザー数・ダウンロード数・評価・お客様の声は**一切記載していません**。
- ランキングの表示は**架空の名前とスコア**です。該当する素材には
  「※ ランキング表示はサンプル（架空の名前・スコア）です」と明記しています。
- フレンドコード `7K4M-92QX` は表示例です。
- 価格「¥2,980（応援価格）／無料版あり／個人・商用利用可」は `store.html` の記載どおりです。
- Business（ポートフォリオ）作品は Spec（自主制作）のため、実績・クライアントワークとしては
  一切登場させていません。

---

## Higgsfield 用プロンプトとモデル

### モデル推奨（Higgsfield で生成する場合）

Higgsfield は複数モデルを束ねたプラットフォームで、2026年時点の主軸は **Seedance 2.0 / Kling 3.0 / Veo 3.1 / WAN 2.6 / MiniMax** と、自社の **Cinema Studio**（70種以上のカメラプリセット）です。今回の「9面の静止画 → 15秒のモーショングラフィックス」には次の使い分けを勧めます。

| 用途 | 推奨 | 理由 |
|---|---|---|
| **本命：ショットごとの image-to-video（f01〜f09）** | **Kling 3.0**（Elements で参照画像を最大4枚） | 参照画像への忠実度が高く、ワードマークやUIの文字が崩れにくい。各ショットに「開始フレーム＝f0N、終了フレーム＝f0(N+1)」を与えると、コンテどおりの遷移になる。4K/60fps 出力なので後工程の自由度も高い |
| **代替：まとめて生成（複数ショットを一気に）** | **Seedance 2.0** | マルチショットの広告向け。9面をまとめて渡して一本にしたいとき。2K だが生成が速く、高コントラストでスマホ映えする。音付きロゴアニメの同期も得意 |
| **カメラワークを足すとき** | **Cinema Studio**（dolly / orbit / crane プリセット） | モーショングラフィックスにさりげない奥行きを足す用途。強い動きは文字を崩すので「slow dolly-in」「subtle orbit」程度に留める |
| **ナレーション・環境音まで一体で欲しいとき** | **Veo 3.1** | 音声同時生成。ただし文字の忠実度は Kling が上なので、テキスト主体のショットには使わない |

**設定の目安**
- 各クリップ 1.5〜2.0 秒 × 9 = 15 秒。長く生成して不要部分は切る（各 3 秒生成 → 編集で詰める）
- アスペクト 16:9（縦版は f0N の 9:16 版を別途書き出して同手順）
- Negative prompt 共通：`extra text, misspelled letters, warped logo, new UI elements, faces, hands, watermark, color shift, camera shake`
- 文字が動くショット（f02, f05, f08, f09）は **モーション強度を低め**にし、文字は静止画のまま背景だけ動かす指示にすると崩れない
- 生成後は ffmpeg で 30fps 統一・色味合わせ（`-vf eq=contrast=1.05`）をしてから結合

出典: [Higgsfield — 5 Best AI Video Models 2026](https://higgsfield.ai/blog/5-Best-AI-Video-Models-2026-Tested-Compared) / [Higgsfield review (Luma)](https://lumalabs.ai/news/higgsfield-review) / [Seedance 2.0 vs Kling 3.0 (each::labs)](https://www.eachlabs.ai/blog/seedance-2-0-vs-kling-3-0-ai-video-generator-comparison) / [Kling vs Seedance vs Veo 3 vs Higgsfield (SimilarLabs)](https://similarlabs.com/blog/kling-vs-seedance-vs-veo-3-vs-higgsfield)

各ショットは `promo/storyboard/fNN.jpg` を **開始フレーム** として image-to-video に入力します。
尺の合計は 15.0 秒。すべてのショットに共通する指示は次のとおりです。

**共通（日本語）**
> 入力画像の構図・色・文字を厳密に保持すること。文字は常に鮮明で読めるまま。
> 新しい文字・ロゴ・UIを一切生成しない。カメラの動きは非常にゆっくりで滑らか。
> 近黒の背景とアイスブルーの発光を維持。フィルムグレインを保つ。

**Common (English)**
> Preserve the input frame's composition, palette and typography exactly.
> Keep all text sharp and legible at all times. Do not invent or alter any text, logo or UI.
> Camera motion is very slow and smooth. Keep the near-black background and the ice-blue glow.
> Retain the film grain.

**共通ネガティブ / Common negative prompt**
> `extra text, new text, warped typography, gibberish letters, morphing UI, distorted logo, misspelled words, watermark, subtitles, people, faces, hands, neon colors, oversaturated, rainbow lens flare, heavy bloom, motion blur on text, camera shake, jitter, flicker, cartoon, 3d render look, fisheye, zoom punch`

---

### Shot 01 — `f01.jpg` → `f02.jpg` ・ 1.6秒

**JA**
> 黒い画面の中心にある光の粒から、粒子が円周に沿って時計回りに走り出し、
> 傾いた楕円のリングを1周かけて閉じていく。背後に沈んでいたワードマーク「IDATSUKA」が
> 少しずつ明るさを取り戻し始める（まだ完全には点灯しない）。
> カメラはごくわずかに前進（1.00→1.03倍）。速度は非常にゆっくり、加速も減速もなし。
> 文字は追加しないこと。ワードマークの字形を変えないこと。

**EN**
> From a single point of light at the centre of a black frame, fine particles stream outward and
> travel clockwise along a tilted elliptical orbit, closing the ring over the full shot. Behind them
> the wordmark "IDATSUKA" slowly begins to gain brightness but does not fully light up yet.
> Camera pushes in almost imperceptibly (1.00 → 1.03). Very slow, constant speed.
> Keep text legible, no extra text, do not reshape the wordmark.

**Negative** — `common negative` ＋ `full brightness wordmark, closed loop completing too early, strobe`

---

### Shot 02 — `f02.jpg` → `f03.jpg` ・ 1.4秒

**JA**
> リングが完成し、ゆっくり自転（1周15秒程度の速さ）。ワードマーク「IDATSUKA」は
> 完全に点灯した状態を保ち、字間がごくわずかに詰まって定位置に落ち着く。
> 上の「Designer & Creator — Tokyo」と下の「Design / Games / Art」は静止したまま。
> 中央の縦線が上から下へ静かに伸びる。カメラは固定、粒子だけが動く。
> 文字は追加せず、読みやすさを維持すること。

**EN**
> The ring is complete and rotates very slowly (about one turn per 15 seconds). The wordmark
> "IDATSUKA" stays fully lit and settles into place as its letter-spacing tightens by a hair.
> "Designer & Creator — Tokyo" above and "Design / Games / Art" below stay perfectly still.
> A thin vertical line grows downward from the centre. Locked-off camera; only particles move.
> Keep text legible, no extra text.

**Negative** — `common negative` ＋ `letters sliding apart, wordmark warping, ring wobble`

---

### Shot 03 — `f03.jpg` → `f04.jpg` ・ 1.8秒

**JA**
> 中央のブラウザウィンドウ（Void Runner）が奥から手前へわずかにスケールイン（0.97→1.00倍）し、
> 左右のゲームタイル（Orbit・Stack）が画面外から中央へ滑り込んで所定の位置で止まる。
> 見出し「簡単に遊べる、ブラウザゲーム。」は下から立ち上がり切った状態で静止。
> ブラウザ内のゲーム画面は、薄い水平ラインがゆっくり左へ流れる程度の微かな動きのみ。
> カメラはほぼ固定。UIの文字・URLは一切変えないこと。

**EN**
> The central browser window (Void Runner) scales in slightly from behind (0.97 → 1.00) while the
> two game tiles (Orbit, Stack) slide in from off-frame and settle into place. The headline
> 「簡単に遊べる、ブラウザゲーム。」 is already fully risen and stays still. Inside the browser, only a
> faint drift of thin horizontal lines to the left. Near-locked camera.
> Keep text legible, no extra text, never alter the URL bar or the tile captions.

**Negative** — `common negative` ＋ `changing URL text, new game HUD, tiles overlapping the centre window`

---

### Shot 04 — `f04.jpg` → `f05.jpg` ・ 1.6秒

**JA**
> 左のOrbitウィンドウの上でカーソルが小さく動き、1回タップする。タップ地点から
> アイスブルーの薄いリングが2重に広がって消える。2枚のウィンドウは視差でごくわずかに
> 逆方向へ漂う（±5px程度）。Orbit の中心の光点がタップの瞬間に一段明るくなる。
> カメラは右へ数十ピクセルだけゆっくりパン。文字は変えないこと。

**EN**
> The cursor moves a short distance over the left Orbit window and taps once. Two thin ice-blue
> rings expand from the tap point and fade. The two windows drift a few pixels in opposite
> directions (parallax). The bright dot at the centre of Orbit flares one step brighter on the tap.
> Camera pans right by a few dozen pixels, very slowly.
> Keep text legible, no extra text.

**Negative** — `common negative` ＋ `hand, finger, mouse device, multiple cursors, click sound burst, UI popup`

---

### Shot 05 — `f05.jpg` → `f06.jpg` ・ 2.0秒

**JA**
> ランキングボードが下から静かに浮き上がり（+40px→0）、1位から5位までの行が
> 上から順に0.1秒差でフェードインする。右側のスコアの数字だけが高速に回って
> それぞれの値で確定する（数字以外は変化しない）。ボード背景の光の筋は
> ゆっくり上へ流れる。カメラは固定。プレイヤー名・バッジ・順位は絶対に変えないこと。

**EN**
> The ranking board floats up gently (+40px → 0) and rows 1 to 5 fade in from the top, staggered by
> about 0.1 s. Only the score numerals on the right spin up quickly and lock onto their final values;
> nothing else changes. The light streaks behind the board drift slowly upward. Locked-off camera.
> Keep text legible, no extra text, never change the player names, badges or rank numbers.

**Negative** — `common negative` ＋ `new rows, reordering rows, changing names, scrolling list, leaderboard logo`

---

### Shot 06 — `f06.jpg` → `f07.jpg` ・ 1.5秒

**JA**
> 5つのフィルターチップが左から順に、ごく小さくバウンドしながら現れる。
> 最後の「FRIENDS」チップだけがアイスブルーに点灯する。
> その下のフレンドコードカードが下から現れ、コード「7K4M-92QX」が左から1文字ずつ確定する
> （確定後は一切変化しない）。カメラは固定。他の文字は追加しないこと。

**EN**
> Five filter chips appear one after another from the left with a tiny overshoot. Only the last chip,
> "FRIENDS", lights up in ice blue. Below, the friend-code card rises into place and the code
> "7K4M-92QX" resolves one character at a time from the left, then stays absolutely fixed.
> Locked-off camera. Keep text legible, no extra text.

**Negative** — `common negative` ＋ `scrambling code after it resolves, different code characters, extra chips, dropdown menu`

---

### Shot 07 — `f07.jpg` → `f08.jpg` ・ 1.9秒

**JA**
> 重なっていた3枚のテンプレートカバー（ZEN / RAY / PULSE）が、中央のRAYを軸に
> 左右へ扇状に開く。それぞれがわずかに回転しながら定位置で止まり、RAYだけが手前に残る。
> 開き切ったあと、下の「¥2,980 応援価格／無料版あり／個人・商用利用可」がフェードインする。
> カバー画像の中身（配色・レイアウト）は変えないこと。カメラは固定。

**EN**
> Three stacked template covers (ZEN / RAY / PULSE) fan open left and right around the central RAY
> card, each rotating slightly as it settles; RAY stays in front. After they open, the line
> 「¥2,980 応援価格／無料版あり／個人・商用利用可」 fades in below. Locked-off camera.
> Keep text legible, no extra text, do not alter the artwork inside the covers.

**Negative** — `common negative` ＋ `changing price, new cards, cards flipping, covers redrawn, different template artwork`

---

### Shot 08 — `f08.jpg` → `f09.jpg` ・ 1.6秒

**JA**
> 「遊べる。」「競える。」「作れる。」の3つの句が、マスクの下から0.2秒差で順に立ち上がる。
> 「作れる。」だけがアイスブルーに発光する。背景のオーロラのカーテンはゆっくり上下に呼吸し、
> 左右にわずかに揺れる。カメラはごくゆっくり引く（1.03→1.00倍）。
> 句読点を含め文字は一切変えず、鮮明に保つこと。

**EN**
> The three phrases 「遊べる。」「競える。」「作れる。」 rise from behind a mask one after another,
> staggered by about 0.2 s; only 「作れる。」 glows ice blue. The aurora curtains behind breathe slowly
> up and down and sway a little sideways. Camera pulls back very slowly (1.03 → 1.00).
> Keep text legible, no extra text, do not change a single character or punctuation mark.

**Negative** — `common negative` ＋ `translating the Japanese, romanised text, letters swapping, aurora turning green or purple`

---

### Shot 09 — `f09.jpg`（エンドカード・ホールド） ・ 1.6秒

**JA**
> ワードマーク「IDATSUKA」がごくわずかにスケールインして止まり、その下の縦線が伸び、
> 「idatsuka.com」が字間を詰めながらフェードインし、最後に「Design / Games / Art」が現れる。
> 背後のリングは静かに回り続ける。最後の0.3秒は完全なホールド（すべて静止）。
> カメラは固定。新しい要素は一切足さないこと。

**EN**
> The wordmark "IDATSUKA" scales in a touch and stops; the vertical line grows beneath it;
> "idatsuka.com" fades in as its letter-spacing tightens; finally "Design / Games / Art" appears.
> The ring keeps turning quietly behind. The last 0.3 s is a full hold — everything frozen.
> Locked-off camera. Keep text legible, no extra text, add nothing new.

**Negative** — `common negative` ＋ `URL changing, added tagline, added social icons, fade to white`

---

### 尺の合計

`1.6 + 1.4 + 1.8 + 1.6 + 2.0 + 1.5 + 1.9 + 1.6 + 1.6 = 15.0 秒`
