# KIRA（キラ）— 劇場版アニメ・作品公式サイトテンプレート v2.0

by IDATSUKA — https://idatsuka.com

劇場版アニメ／OVA／舞台／ゲームなど、「作品」の公式サイトのための HTML テンプレートです。
ビルドツールもフレームワークも不要。`index.html` を編集して `assets/` フォルダごとアップロードすれば公開できます。

夜空のキービジュアル、開いていくレターボックス、縦に積まれたタイトル——
「公開が待ち遠しい」という気持ちを、そのまま画面にしました。

デモの掲載内容は架空の作品「約束の星」です。作品名以外（スタッフ・キャスト・劇場・価格・公開日）は
すべて「◯◯」のプレースホルダーになっています。

## 使い方

1. `index.html` をテキストエディタで開く
2. ファイル冒頭のコメントに従い、`EDIT:` と書かれた箇所を自分の作品の内容に差し替える
3. `<style>` 内の `:root` の CSS 変数で配色を調整する
   （明るいテーマは `[data-theme="dawn"]` ブロックで調整）
4. `index.html` と `assets/` フォルダをサーバー（GitHub Pages / Netlify / レンタルサーバー等）にアップロード

### 最初に差し替える6か所

| 場所 | 内容 |
| --- | --- |
| `<title>` / `description` / `og:` / `canonical` | 作品名・キャッチコピー・公開URL |
| Hero の `<h1 class="kv-title">` | 作品タイトル（1文字ずつ `<span>` で囲む） |
| Hero の `<p class="kv-release">` | 公開日（「2027.◯.◯ Roadshow」） |
| `assets/kv-sky.jpg` / `assets/chara.png` | キービジュアルの空と立ち絵（同梱品は仮のものです） |
| `<symbol id="city">` | 街のシルエット |
| TRAILER の `data-youtube-id="◯◯◯◯◯◯"` | YouTube の動画ID（11文字） |

## キービジュアル（HERO）の差し替え

キービジュアルは **空 → 街 → 人物** の3層構造です。層ごとに視差（パララックス）がかかります。

### 1. 空（背景）

初期状態は `assets/kv-sky.jpg`（2400×1350）の静止画です。`<img class="kv-video">` を差し替えてください。
ファイルが無い場合は CSS のグラデーション（`--sky1`〜`--sky4` の夕暮れの空）が表示されます。

**動画にしたい場合**は、`assets/` に次を置き、HERO の `<img class="kv-video">` を
すぐ下のコメント内にある `<video>` に置き換えてください。

| ファイル | サイズ | 用途 |
| --- | --- | --- |
| `assets/kv-sky.jpg` | 2400×1350 | 静止画（動画の読み込み前・予告編のポスター） |
| `assets/kv-sky.mp4` | 1920×1080 | 背景動画（ループ） |
| `assets/kv-sky.webm` | 1920×1080 | 背景動画（ループ・軽量） |

- 動画は `autoplay muted loop playsinline` で再生されます（スマホでも自動再生されます）
- 容量は合計5MB以内が目安です。長さは10〜20秒のループを推奨します

### 同梱しているキービジュアルについて（重要）

`assets/kv-sky.jpg`（空）と `assets/chara.png`（立ち絵）は、**デモ用の仮ビジュアルです。**
画像生成モデル FLUX.1 Krea [dev] で作成し、立ち絵は背景を抜いて収録しています。

- **公開前に、ご自身の作品の絵に差し替えてください。**このまま公開すると、他の購入者と同じ絵になります
- 生成物の利用条件はモデルの提供元のライセンスに従います。商用利用の可否はご自身でご確認ください
- 差し替え用の絵が用意できるまでの「仮置き」としてお使いください。差し替え手順は下の「キービジュアルを画像生成ツールで作る場合」を参照

### 2. 街と人物（シルエット）

`<symbol id="city">`（2400×600）と `<symbol id="chara-main">`（600×900）の中身を、
自分のイラストのパスに差し替えてください。キャラクター紹介の3人は `#chara-a` / `#chara-b` / `#chara-c` です。

- `fill="currentColor"` のままにしておくと、CSS の `--silhouette` で色が変わります
- 画像を使う場合は、`<svg>…</svg>` ごと `<img class="kv-chara-img" src="assets/chara.png" alt="">` に置き換えてください
- 街は画面下端いっぱいに、人物は右3分の1（スマホでは中央）に立つよう配置されます

### 3. 動き

| 演出 | 内容 | 調整場所 |
| --- | --- | --- |
| パララックス | マウスの動きで各層が最大18pxずれる（PCのみ） | JavaScript の `MAX` |
| Ken Burns | キービジュアル全体が30秒かけて1.0→1.06倍 | CSS の `@keyframes kenburns` |
| 光の粒 | 金と淡い青の光が60〜90粒、ゆっくり上へ流れる | JavaScript の `COLORS` / 粒の数 |
| 流れ星 | 6〜12秒に1回、斜めに流れる | JavaScript の `nextShoot` |
| 光のにじみ | 夕日の位置がゆっくり明滅する | CSS の `.kv-flare` |
| オープニング | 黒帯が開き、タイトルが浮かび上がる | CSS の `@keyframes lbOpen` / `lockIn` |

オープニング演出は `sessionStorage`（キー `kira-intro`）で**1セッションに1回だけ**再生されます。
毎回再生したい場合は、`<head>` の判定スクリプトから `sessionStorage` の行を外してください。
動きを抑える設定（`prefers-reduced-motion`）のブラウザでは、演出はすべて止まり、最初から全部が表示されます。

## キービジュアルを画像生成ツールで作る場合

同梱の空と立ち絵は、差し替えを前提とした仮のビジュアルです。
自分の作品の絵に差し替える手順を、画像生成ツール（Midjourney / Nano Banana / Stable Diffusion など）を
使う場合の例として書いておきます。差し替え先は上の3層と同じです。

### 手順

1. 空（16:9、2400×1350 以上）を生成し、`assets/kv-sky.jpg` として保存する
2. 動かしたい場合は、その静止画を image-to-video（Kling / Runway / Higgsfield など）に渡して 8〜12 秒のループを作り、下の ffmpeg で `mp4` と `webm` に変換する
3. 人物は背景透過の PNG（立ち絵）を生成し、`assets/chara.png` を置き換える。シルエットに戻したい場合は、HERO の `<img class="kv-chara-img">` をコメント内の `<svg>` に戻す

### プロンプト例 — 空

- EN: `anime background art, dusk sky just after sunset, towering cumulus clouds lit from below in peach and rose, upper sky deep indigo with the first stars, thin cirrus, soft crepuscular rays from a low sun at the lower right, painterly cel shading, key visual background, no people, no buildings, no text, 16:9`
- JA: `アニメ背景美術、日没直後の夕空、下から桃色と薔薇色に照らされた入道雲、上空は藍色で星が出はじめる、薄い筋雲、右下の低い太陽からの柔らかな光芒、セル調の塗り、人物なし、建物なし、文字なし、16:9`
- Negative: `text, watermark, people, buildings, photo, lens flare artifacts, blur`

### プロンプト例 — 人物（立ち絵）

- EN: `anime key visual, high-school girl seen from behind, leaning on a rooftop railing, long hair and a scarf blowing in the wind, looking up at the dusk sky, full body, clean lineart, soft cel shading, transparent background, 3:4`
- JA: `アニメのキービジュアル、屋上の手すりにもたれる後ろ姿の女子高生、長い髪とマフラーが風になびく、夕空を見上げる、全身、清潔な線画、柔らかいセル塗り、背景透過、3:4`

### プロンプト例 — 動画化（image-to-video）

`slow drifting clouds, gentle light breathing on the horizon, subtle twinkling stars, static camera, no people, seamless loop, 10 seconds`

### 変換コマンド（ffmpeg）

```
ffmpeg -i sky.mp4 -c:v libx264 -crf 21 -pix_fmt yuv420p -movflags +faststart -an assets/kv-sky.mp4
ffmpeg -i sky.mp4 -c:v libvpx-vp9 -crf 34 -b:v 0 -an assets/kv-sky.webm
ffmpeg -i sky.mp4 -frames:v 1 -q:v 3 assets/kv-sky.jpg
```

生成ツールの利用規約と、生成物の商用利用可否は必ず確認してください。
他社のストック素材やテンプレート素材（デザインツール内の素材など）は、再配布制限があるため同梱できません。

## 予告編（TRAILER）の設定

```html
<div class="tr-frame" id="trFrame" data-youtube-id="◯◯◯◯◯◯">
```

`data-youtube-id` に YouTube の動画ID（URL の `v=` のあとの11文字）を入れてください。

```
https://www.youtube.com/watch?v=abcdEFGhijk  →  data-youtube-id="abcdEFGhijk"
```

- 再生ボタンを押した時点で初めて iframe を読み込みます（ページの表示は重くなりません）
- 埋め込みは `youtube-nocookie.com` を使っています
- IDがプレースホルダーのままだと「YouTube の動画IDを設定してください」と画面下に表示されます
- ポスター画像は `assets/kv-sky.jpg` です。別の画像にする場合は CSS の `.tr-poster` を書き換えてください

### テーマについて

- ナビ右上の「Night／Dawn」で、夜（night）と夜明け（dawn）の2テーマを切り替えられます（選択はブラウザに保存されます）
- 最初から dawn で表示したい場合は `<html lang="ja" data-theme="night">` を `data-theme="dawn"` に変更してください
- 切替ボタンが不要な場合は `#themeToggle` の `<button>` を削除してください
- `theme-color`（スマホのアドレスバーの色）は切替に追従します
- キービジュアルの上の文字は、どちらのテーマでも明るい色のままです（空の絵は夜のままのため）

## 特徴

- HTML / CSS / JavaScript すべて1ファイル。外部ライブラリゼロ、外部画像は `assets/` のキービジュアルのみ
- 夜（night）／夜明け（dawn）の2テーマ切替、設定をブラウザに保存
- 3層パララックスのキービジュアル（動画＋シルエット＋光の粒＋流れ星＋レンズフレア）
- レターボックスが開くオープニング演出（1セッション1回・動きを抑える設定では省略）
- タイトルは1文字ずつ縦に積む組み方（スマホでは自動で1行の横書き）
- セクションが下からマスクが開くように現れるリビール演出（`cubic-bezier(.16,1,.3,1)`）
- 金の細いスクロール進捗線、スクロールで暗く沈むナビ、スマホは全画面メニュー
- キャラクターのタブ切替（クロスフェード・キーボードの左右キー対応）
- 劇場情報の地域別アコーディオン（`<details>`。JavaScript が無くても開閉します）
- YouTube の遅延読み込み（再生ボタンを押すまで iframe を作りません）
- フィルムグレイン（SVG生成・静止）とヴィネット
- レスポンシブ（390px で確認済み・横スクロールなし）
- `prefers-reduced-motion` 対応
- OGP / canonical / theme-color / SVG ファビコン内蔵
- 日本語コメント付きで、HTML に不慣れな方でも差し替えやすい構成

## セクション構成

| # | セクション | 内容 |
| --- | --- | --- |
| — | HERO | キービジュアル・縦積みタイトル・キャッチコピー・公開日の帯・CTA2つ |
| 01 | NEWS | 日付・分類チップ・見出しの4件＋「一覧を見る」 |
| 02 | INTRODUCTION | 大きな一文＋導入2段落＋縦書きの添え書き（PCのみ） |
| 03 | STORY | 金の罫で囲んだあらすじ（書き出し1行＋本文3段落＋締めの一行） |
| 04 | CHARACTER | 3人のタブ切替（シルエット／役名／CV／説明） |
| 05 | STAFF & CAST | スタッフ8行・キャスト4行の2段組み |
| 06 | TRAILER | 16:9 のポスター枠＋再生ボタン（YouTube 埋め込み） |
| 07 | MUSIC | 主題歌カード（レコード盤モチーフ・配信リンクのピル） |
| 08 | THEATER | 6地域のアコーディオン（劇場名／電話／備考）＋前売券の案内 |
| 09 | SPECIAL | 入場者特典／描き下ろしビジュアル／舞台挨拶の3枚（2:3のポスター枠） |
| 10 | GOODS | パンフレット／クリアファイル／Blu-ray の3枚 |
| — | FOOTER | 製作委員会表記・SNS・ページトップ |

セクションを削除する場合は `<section>` ごと消し、ナビとスマホメニューの該当リンクも削除してください。

## 配色の変え方

`<style>` 冒頭の `:root` を書き換えると全体に反映されます。

| 変数 | 役割 |
| --- | --- |
| `--bg` / `--bg2` | 背景（夜空のいちばん暗いところ／一段明るい面） |
| `--fg` / `--fg-dim` / `--muted` | 本文／補助文字／ラベル |
| `--gold` / `--rule` | 金（EN小見出し・罫・アクセント）／金の細罫 |
| `--pink` / `--sky` | 夕暮れのピンク／空色（グラデーションに使用） |
| `--silhouette` / `--rim` | シルエットの色／青いリムライト |
| `--sky1`〜`--sky4` | 動画が無いときの空のグラデーション（上から下へ） |
| `--grain` / `--vignette` | フィルムグレインの強さ／四隅の落ち込み |

## 掲載内容についてのお願い（重要）

- スタッフ・キャスト・劇場名・電話番号・価格・公開日は、すべて「◯◯」「¥◯,◯◯◯」などのプレースホルダーです。公開前に必ず実際の内容へ差し替えてください
- **受賞歴・動員数・興行収入・レビュー・「全米No.1」「感動の超大作」といった実績や評価の表現は、確認できる事実のみ**をご記載ください。根拠のない表示は景品表示法（優良誤認）に触れるおそれがあります
- 未確定の公開日・上映劇場・舞台挨拶の登壇者を、確定情報のように書かないようご注意ください（「予定」「決定次第お知らせします」と明記する）
- グッズを通信販売する場合は「特定商取引法に基づく表記」のページを別途ご用意ください
- 前売券・ムビチケの特典は「数量限定・なくなり次第終了」などの条件を明記してください
- 収録しているシルエット（街・人物）と空のグラデーションは、このテンプレート用の仮の素材です。差し替える際は、ご自身が権利を持つ（または利用許諾を得た）素材をお使いください
- YouTube の埋め込みは YouTube の利用規約に従ってご利用ください

## ライセンス

- 個人・商用サイトでの利用: ○
- 改変: ○
- テンプレートとしての再販・再配布: ✕
- クレジット表記: 不要（残していただけたら嬉しいです）

## サポート

不具合・質問は https://idatsuka.com/contact.html までお気軽にどうぞ。

## v2.0 変更履歴

- **コンセプトを全面刷新**。キャラクター紹介ページから、劇場版アニメの作品公式サイトへ
- 3層パララックスのキービジュアル（空の動画／街／人物）を新設。動画が無い場合はグラデーションで成立
- 光の粒と流れ星を描く Canvas を追加（事前に描いた光の画像を貼る方式。画面外・別タブでは停止）
- レターボックスが開くオープニング演出（1セッション1回）
- 配色を夜空（`#0b0a14` → `#141230`）＋金（`#e8c27a`）に変更。2テーマを night / dawn に
- 書体を Shippori Mincho / Noto Sans JP / Cormorant Garamond の3種に整理
- NEWS / INTRODUCTION / STORY / CHARACTER / STAFF & CAST / TRAILER / MUSIC / THEATER / SPECIAL / GOODS の10セクション構成へ
- YouTube 予告編の遅延読み込み、劇場情報のアコーディオン、キャラクターのタブ切替を追加
- リビール演出をマスクが開く方式（`clip-path`）に変更

## v1.0 変更履歴

- 初版リリース（キャラクター＆クリエイター向けテンプレート）
