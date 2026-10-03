# IDATSUKA — 15秒キネティックタイポCM

`.claude/skills/kinetic-typography` の手法（参考：GYARU / CREATIVE DIRECTOR のブランドフィルム）を
idatsuka.com に置き換えたCMです。2通りの作り方を用意しています。

| ルート | 入力 | 出力 | 文字の正確さ |
|---|---|---|---|
| **A. コードで描画**（完成品） | `kt.html` + サイトの素材 + `audio/` | `kt-16x9.mp4` / `kt-9x16.mp4` | 100%（ブラウザでフォント描画） |
| **B. 画像1枚から生成**（参考動画と同じ作り方） | `board.png`（ブランドボード1枚） | Higgsfield などの image-to-video | モデル任せ。小さい文字は崩れやすい |

## 成果物

| ファイル | 内容 |
|---|---|
| `kt-16x9.mp4` | 1920×1080 / H.264 crf18 / **24fps・360フレーム・15.000秒** / AAC 256k・-14 LUFS |
| `kt-9x16.mp4` | 1080×1920（クロップではなく**再レイアウト**）/ 同仕様 |
| `poster-16x9.jpg` / `poster-9x16.jpg` | エンドカード（t=14.5s） |
| `kt.html` | フィルム本体（v2）。`__KT.seek(t)` で任意の時刻を描画。`?ar=v` で縦、`?t=5.2` で静止、パラメータなしでループ再生 |
| `audio/` | 音声一式。`cues.json`（台本・BGM指示・効果音の時刻）、`gen_vo.py`（Gemini TTS）、`gen_bgm.py`（Gemini music）、`mix.py`（ミックスして2本に差し込む） |
| `board.png` | ルートB用のブランドボード（1888×3332）。ソースは `board.html` |
| `src/score.py` | **仮のBGM**（numpyで合成）。`audio/bgm.wav` が無いときだけ `mix.py` が使う |
| `assets/fonts/` | 使用文字だけにサブセットしたwoff2（Zen Old Mincho / Zen Kaku Gothic New / Cormorant Garamond Italic / Space Grotesk / Space Mono。ボード用に Caveat も） |
| `assets/phone-games.jpg` | スマホ画面用に games.html を390px幅で撮ったもの |

## 構成 v2 — 上品・高級に寄せた版（90 BPM：1拍＝0.667秒＝16フレーム）

v1（14カット）から、カットを11に減らして1カットを長く見せる方向に直しました。

- **書体**：感情の言葉は明朝（Zen Old Mincho）、事実はゴシック（Zen Kaku Gothic New）、英語の添え書きはイタリックのセリフ体（Cormorant Garamond）
- **色**：アイスは細線と一点だけ。大きな色面はなくしました
- **動き**：文字はぼかしが晴れながら立ち上がります。ワイプは「アイスの細線が先頭についた黒い帯」1種類だけ
- **画面の四隅**：小さなモノスペースの表示（ブランド名・カット番号・URL）を入れています
- **01→03**：同じフレームの中で中身と数字だけが切り替わります

| # | 秒 | 拍 | 画面 | コピー / 要素 | 動き | 音 |
|---|---|---|---|---|---|---|
| 1 | 0.00–1.33 | 2 | 黒 | ワードマーク＋細線＋PLAY / RANK / MAKE | 線が伸び、ロゴがぼかしから現れる | shimmer |
| 2 | 1.33–2.67 | 2 | aurora | 「その5分、／まだ退屈？」（明朝） | 半拍ずれで2行が立ち上がる | **VO1** |
| 3 | 2.67–3.33 | 1 | 白 | 「遊ぶ。競う。作る。」（ゴシック） | 字間が詰まって着地、鋼青の罫 | |
| 4 | 3.33–4.67 | 2 | 黒 | *Just play.*／ブラウザを開けば、すぐに。 | 黒帯ワイプで入り、筆記体が左から現れる | whoosh |
| 5 | 4.67–6.00 | 2 | 黒＋フレーム | **01** ブラウザで遊べる、6本のゲーム。 | 半拍ごとにゲーム画面が替わる | tick |
| 6 | 6.00–7.33 | 2 | 同じフレーム | **02** スコアで、競い合う。 | 数字が回り、ランキングがカウントアップ | tick |
| 7 | 7.33–8.67 | 2 | 同じフレーム | **03** 1ファイルで完成する、テンプレート。 | 表紙3枚が開く | tick |
| 8 | 8.67–10.00 | 2 | 黒＋スマホ | 「スマホでも、そのまま。」／*Nice run.* | スマホがせり上がり、画面がスクロール | swish |
| 9 | 10.00–11.33 | 2 | 白 | 「完璧より、／夢中を。」 | 1行ずつ | **VO2**（BGMは一息） |
| 10 | 11.33–13.33 | 3 | ring | 「今日の5分、／どう遊ぶ？」／*Let's play.* | 黒帯ワイプ（逆方向） | whoosh |
| 11 | 13.33–15.00 | 2½ | 黒 | 「一度、遊んでみよう。」＋ロゴ｜idatsuka.com＋細い矢印 | 1字ずつ現れ、そのあと**静止** | **VO3**・hit |

## 音声 — Gemini TTS / Gemini music / 効果音ラボ

| 種類 | 使うもの | 置き場所 |
|---|---|---|
| ナレーション | **Gemini TTS**（`gemini-3.8-flash-tts`、声 `Sulafat`） | `audio/vo/vo1.wav` ほか |
| BGM・音楽 | **Gemini music**（`lyria-3-clip-preview`、90 BPM・15秒） | `audio/bgm.wav` |
| 効果音 | **効果音ラボ** | `audio/sfx/*.wav`（一覧は `audio/sfx/README.md`） |

ナレーションは3行だけです。言葉を詰め込まず、間を残すのが高級感のポイントです。読み方を固定するため「五分」は漢数字で書いています。
手順：

```
export GEMINI_API_KEY=…            # 環境設定に登録しておく
cd promo/kt/audio
python3 gen_vo.py                  # vo/vo1〜3.wav（気に入らない行は python3 gen_vo.py vo2 で録り直し）
python3 gen_bgm.py                 # bgm.wav（何テイクか作って一番良いものを残す）
#  効果音ラボで選んだ音を sfx/ に置く
python3 mix.py                     # ミックス → kt-16x9.mp4 / kt-9x16.mp4 の音声を差し替え
```

`mix.py` は、足りない素材を飛ばして一覧を出します。BGM が無いときは仮のBGM（`src/score.py`）を使います。
BGM はナレーションの下で自動的に下がり（サイドチェイン）、全体を -14 LUFS / -1.5 dBTP に整えます。
声質・間・音量は `audio/cues.json` だけで調整できます。

**現在の状態**：この環境には `GEMINI_API_KEY` がなく、`soundeffect-lab.info` へのアクセスもネットワーク設定で止められています。
そのため、今の2本に入っている音は仮のBGMだけです（ナレーション・効果音なし）。

## 再現手順（映像）

```
# kt.html?render を 1920×1080（縦は ?render&ar=v を 1080×1920）で開き、
# i=0..359 について __KT.seek(i/24) → PNG を1枚ずつ撮る（Playwright）
ffmpeg -framerate 24 -i f%04d.png -c:v libx264 -preset slow -crf 18 -tune film \
       -pix_fmt yuv420p -r 24 -movflags +faststart kt-16x9.mp4
python3 audio/mix.py
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
