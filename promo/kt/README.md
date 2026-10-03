# IDATSUKA — 15秒キネティックタイポCM

`.claude/skills/kinetic-typography` の手法（参考：GYARU / CREATIVE DIRECTOR のブランドフィルム）を
idatsuka.com に置き換えたCMです。2通りの作り方を用意しています。

| ルート | 入力 | 出力 | 文字の正確さ |
|---|---|---|---|
| **A. コードで描画**（完成品） | `kt.html` + サイトの素材 | `kt-16x9.mp4` / `kt-9x16.mp4` | 100%（ブラウザでフォント描画） |
| **B. 画像1枚から生成**（参考動画と同じ作り方） | `board.png`（ブランドボード1枚） | Higgsfield などの image-to-video | モデル任せ。小さい文字は崩れやすい |

## 成果物

| ファイル | 内容 |
|---|---|
| `kt-16x9.mp4` | 1920×1080 / H.264 crf20 / **24fps・360フレーム・15.000秒** / AAC 192k |
| `kt-9x16.mp4` | 1080×1920（クロップではなく**再レイアウト**）/ 同仕様 |
| `poster-16x9.jpg` / `poster-9x16.jpg` | エンドカード（t=13.75s） |
| `board.png` | ルートB用のブランドボード（1888×3332）。ソースは `board.html` |
| `kt.html` | CM本体。`__KT.seek(t)` で任意の時刻を描画。`?ar=v` で縦、`?t=5.2` で静止、パラメータなしでループ再生 |
| `src/score.py` | 90 BPMのBGMを合成するスクリプト（numpyのみ・決定論的）。キック・ハット・ベース・パッド、ワイプにウーシュ、エンドカードで1発 |
| `assets/fonts/` | 使用文字だけにサブセットしたwoff2（Zen Kaku Gothic New / Space Grotesk / Space Mono / Caveat、計約130KB） |
| `assets/phone-games.jpg` | スマホ画面用に games.html を390px幅で撮ったもの |

## 構成（90 BPM：1拍＝0.667秒＝24fpsで16フレーム）

| # | 秒 | 拍 | 画面 | コピー / 要素 | 動き |
|---|---|---|---|---|---|
| 1 | 0.00–0.33 | ½ | 黒 | ワードマーク＋アイスの点 | 点がポップ |
| 2 | 0.33–1.33 | 1½ | aurora プレート | 「その5分、／まだ退屈?」 | 2行目が半拍遅れで立ち上がる |
| 3 | 1.33–2.00 | 1 | 白 | 「遊ぶ。競う。作る。」 | 字間が詰まって着地 → 鋼青の罫が伸びる |
| 4 | 2.00–2.67 | 1 | アイス＋黒の斜め帯 | 「ブラウザひとつで、／遊べて、競えて、作れる。」 | アイス→黒のスラッシュワイプで入る |
| 5 | 2.67–3.33 | 1 | 白＋Orbitのカード | 手書き「Just Play.」＋矢印 | 書き順どおりに表示 |
| 6 | 3.33–4.00 | 1 | 白 | Click → **Play** → Rank. | カーソルがクリック、Playが1.8倍に |
| 7 | 4.00–5.33 | 2 | 黒＋ファインダー枠 | **01** GAMES「ブラウザで遊べる、6本のゲーム。」 | 半拍ごとにゲーム画面が切り替わる |
| 8 | 5.33–6.67 | 2 | 同上 | **02**（アイス）RANKING「スコアで、競い合う。」 | 行が順に入り、スコアがカウントアップ |
| 9 | 6.67–8.00 | 2 | 同上 | **03** TEMPLATES「1ファイルで完成する、テンプレート。」 | テンプレートの表紙3枚が扇状に開く |
| 10 | 8.00–9.33 | 2 | 黒＋スマホ | 「スマホでも、そのまま。」＋手書き「Nice Run!」 | スマホがせり上がり、画面がスクロール |
| 11 | 9.33–10.00 | 1 | 白 | 「完璧より、／夢中を。」 | 1行ずつ |
| 12 | 10.00–11.33 | 2 | 黒＋アイスの帯 | 「遊ぶことを、／本気でつくっている。」＋流れるタグ | 帯が次の文を押し込むワイプ |
| 13 | 11.33–13.33 | 3 | アイス＋ring プレート | 「今日の5分、／どう遊ぶ?」＋手書き「Let's Play」 | 帯が逆方向に戻る |
| 14 | 13.33–15.00 | 2½ | 黒 | 「一度、遊んでみよう。」＋ロゴ＋idatsuka.com＋矢印 | 矢印を描いたあと**静止** |

参考動画の赤 `#E60012` は、サイトのアクセント（暗＝アイス `#9fd6ec`／明＝鋼青 `#1d6d8e`）に置き換えています。
人物写真の代わりに、サイトの実素材（hero-scene のプレート、ゲームのサムネイル、テンプレートの表紙、スマホ画面のキャプチャ）を使っています。

## 音声の制作方針

| 種類 | 使うもの |
|---|---|
| ナレーション | **Gemini** |
| BGM | **Gemini**（90 BPM・15秒で指定） |
| 効果音 | **効果音ラボ** |

現在の `src/score.py` の音は仮のものです。上の素材がそろったら差し替えます。
効果音を入れる位置の目安：ワイプのウーシュ（2.00 / 10.00 / 11.33秒）、各カット頭のクリック音、エンドカードのヒット（13.33秒）。

## 再現手順（ルートA）

```
python3 src/score.py score.wav
# kt.html?render を 1920×1080（縦は ?render&ar=v を 1080×1920）で開き、
# i=0..359 について __KT.seek(i/24) → PNG を1枚ずつ撮る（Playwright）
ffmpeg -framerate 24 -i f%04d.png -i score.wav -c:v libx264 -preset slow -crf 20 \
       -pix_fmt yuv420p -r 24 -c:a aac -b:a 192k -shortest -movflags +faststart kt-16x9.mp4
```

## ルートB — 画像1枚から生成する（Higgsfield）

参考動画は**ブランドボード1枚**から作られていました。ボード上のモジュールが、それぞれ1カットになっています。
対応は「ヒーロー → 冒頭の問いかけ」「ロゴ → オープニング」「タイポグラフィ → 主張」「スマホ → 製品カット」
「サービス01〜03 → 番号付きの3カット」「CTAの帯 → 問いかけ」「フッターのロゴ → エンドカード」です。
`board.png` は同じ並びで作ってあります。

**プロンプト（英語で入力）**
> 15-second kinetic typography brand film built only from this brand board. Cut on the beat at 90 BPM.
> Shot order: logo mark on black → headline 「その5分、まだ退屈?」 over the particle ring →
> 「遊ぶ。競う。作る。」 with an ice-blue underline → diagonal ice-blue and black slash wipe →
> handwritten "Just Play." writing itself on → numbered service cards 01, 02, 03 pushed in one by one inside camera viewfinder brackets →
> the phone mockup rising from the bottom with "Nice Run!" written on top →
> 「完璧より、夢中を。」 → ice-blue panel 「今日の5分、どう遊ぶ?」 with "Let's Play" →
> end card on black: 「一度、遊んでみよう。」, the IDATSUKA wordmark and an ice-blue arrow, hold for 2 seconds.
> Palette strictly near-black #060607, white, ice blue #9fd6ec. Flat graphic motion, slow push-ins, no people.

**ネガティブ**
> `new text, misspelled japanese, garbled kana, extra words, warped logo, people, faces, hands, red, neon, camera shake, morphing UI`

**注意**：参考動画では、小さい文字がモデルの手で描き直されて崩れていました（「考えここと」「コーンミーション」など）。
ボードの見出しは大きく作ってありますが、生成結果の日本語は必ず1フレームずつ確認してください。
崩れたカットは、ルートAの該当ショット（`kt.html?t=秒`）に差し替えるのが確実です。

## コンプライアンス

- ランキングは架空の名前とスコアです。画面内に「※ ランキング表示はサンプル（架空の名前・スコア）です」と表示しています。
- 「6本のゲーム」は games.html の掲載数（Void Runner / Signal / Orbit / Stack / Aurora Pinball / Lattice）と一致しています。
- 利用者数・評価・受賞などの実績表現は使っていません。
