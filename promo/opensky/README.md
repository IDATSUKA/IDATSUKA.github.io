# OpenSky — モーショングラフィックス広告（60秒 / 15秒）

建築会社 **OpenSky**（東京都渋谷区）の広告映像（60秒版・15秒版）。ブランドの言葉「夜空を開放した街」を、
**「ひらく」**という一つの動きで組み立てています。すべてのカットは水平のスリットが天窓のように開いて切り替わり、
最後はカメラが夜の街から空へ見上げ、星空の中にロゴが現れます。

| ファイル | 内容 |
|---|---|
| `opensky-60s.mp4` | **60秒版**。1920×1080 / 60fps / H.264 High / AAC 48kHz / **60.000秒** |
| `opensky-60.html` / `audio-60.mjs` | 60秒版の本体とBGM。`SHOTS` と `TEXT` の表を書き換えれば尺・コピーを変更できる |
| `opensky-15s.mp4` | 15秒版。1920×1080 / 60fps / H.264 High / AAC 48kHz / **15.000秒** |
| `poster.jpg` / `poster-60.jpg` | サムネイル（15秒版 t = 14.5s ／ 60秒版 t = 59.5s のエンドカード） |
| `opensky.html` | 15秒版の本体（Canvas 2D + DOM）。`window.__R.seek(t)` で任意の瞬間を描画。`?play` でリアルタイム再生 |
| `audio.mjs` | 15秒版のBGM・効果音をサンプルなしで合成（Dメジャーのパッド＋フェルトピアノ風のモチーフ） |
| `render.mjs` | ローカルHTTPで配信し、Playwright で1フレームずつ決定論的に書き出す |
| `img/` | 支給画像 4点（wall / vase / studio / city） |
| `fonts/` | しっぽり明朝 B1（使用文字のみ）、Cormorant Garamond、Jost。いずれも OFL |

## 60秒版の構成

同じ4枚の画像を、章ごとに「引き（ワイド）→ 寄り（別アングル）」の2カットで使っています。章の切り替えはスリット（天窓）、章内はディゾルブ。

| 時間 | 章 | コピー | 画 |
|---|---|---|---|
| 0.0–5.6 | プロローグ | 都市の夜は、明るすぎる。／見上げても、星が見えない。 | 黒地に一本の光の線。その線がそのまま最初のスリットになる |
| 5.6–16.8 | 01 LIGHT | 光を、素材に。／必要な場所に、必要なだけの光を。 | 壁のワイド → 杉板型枠の質感に寄る |
| 16.8–28.4 | 02 TEXTURE | 手ざわりまで、設計する。／時間とともに、美しくなる素材を。 | ピント送り → 布から器へのパン |
| 28.4–40.0 | 03 WINDOW | 夜に、ひらく窓。／部屋の灯りを落とすと、空が近づく。 | 室内のドリー → 窓の外の空へ寄る |
| 40.0–51.0 | 04 CITY | 見上げるための、街をつくる。／足もとには、灯りを。頭上には、星を。 | 街並み → 濡れた路面に落ちる雨の波紋 → 空に星が灯る |
| 51.0–56.5 | 空へ | 光を設計すると、夜空が、かえってくる。 | ティルトアップで星空へ。流れ星 |
| 56.5–60.0 | エンド | OpenSky ／ 夜空を開放した街 ／ 東京都渋谷区 | 「空がひらく」マークとロゴ |

## 15秒版の構成

| 時間 | カット | コピー | 動き |
|---|---|---|---|
| 0.0–3.3 | 01 LIGHT（コンクリート壁） | 光を、素材に。 | 黒からスリットが開く。二本目の光の帯が壁を横切り、光の中だけ塵が舞う |
| 3.3–6.4 | 02 TEXTURE（器と布） | 手ざわりまで、設計する。 | スリットで切り替え。ピントが合っていく（ぼけ 11px → 0） |
| 6.4–9.4 | 03 WINDOW（夜のアトリエ） | 夜に、ひらく窓。 | 横へゆっくりドリー。ペンダントライトがわずかに呼吸する |
| 9.4–12.4 | 04 CITY（雨上がりの街並み） | 見上げるための、街をつくる。 | 空にだけ星が灯る（画像から空の画素を判定してマスク）→ カメラが空へティルトアップ |
| 12.4–15.0 | エンドカード | OpenSky ／ 夜空を開放した街 ／ 東京都渋谷区 | 円が描かれ、上半分が持ち上がって「空がひらく」マーク。流れ星が一つ |

縦書きの明朝でコピーを置き、1文字ずつ「ぼかし→くっきり」で立ち上げています。
画面右下には常時「※画像はイメージです。」を表示しています（支給画像はイメージ画像のため）。

## 再現

60秒版：

```
PAGE=opensky-60.html node render.mjs frames 120 4   # out60/frames/*.png（7200枚、約1時間）
node audio-60.mjs                                  # out/opensky-60.wav
ffmpeg -framerate 120 -i out60/frames/f%05d.png -i out/opensky-60.wav \
  -vf "tmix=frames=2,select='eq(mod(n\,2)\,1)',setpts=N/60/TB,format=yuv420p" -r 60 \
  -c:v libx264 -preset slower -crf 20 -maxrate 8M -bufsize 16M -tune grain -profile:v high \
  -c:a aac -b:a 256k -movflags +faststart -t 60 opensky-60s.mp4
```

15秒版：

```
node render.mjs frames 120 4     # out/frames/*.png（1800枚）
node audio.mjs                   # out/opensky.wav
ffmpeg -framerate 120 -i out/frames/f%05d.png -i out/opensky.wav \
  -vf "tmix=frames=2,select='eq(mod(n\,2)\,1)',setpts=N/60/TB,format=yuv420p" -r 60 \
  -c:v libx264 -preset slower -crf 17 -maxrate 14M -bufsize 28M -tune grain -profile:v high \
  -c:a aac -b:a 256k -movflags +faststart -t 15 opensky-15s.mp4
```
