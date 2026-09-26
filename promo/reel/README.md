# Motion Reel — 15.000s

Claude が「モーショングラフィックの履歴書」として制作した15秒のリール。
**キーフレームは0個。** すべてのフレームは `reel.html` の `window.__R.seek(t)`、つまり時間 t の純粋な関数として描かれています。

| ファイル | 内容 |
|---|---|
| `reel-x.mp4` | 本編。1920×1080 / 60fps / H.264 High / 音声 AAC 48kHz / 約15Mbps・28MB / **15.000秒・900フレーム**。X投稿用（Xは無音で自動再生されるので、音なしでも成立する構成） |
| `poster.jpg` | サムネイル（t = 13.95s のエンドカード） |
| `reel.html` | 本体。Canvas 2D + DOM。`?play` でリアルタイム再生、`?t=6.9` で任意の瞬間を表示 |
| `audio.mjs` | 効果音・音楽をサンプルなしでゼロから合成（120 BPM、映像のヒットに同期） |
| `render.mjs` | Playwright で1フレームずつ決定論的に書き出すレンダラー |
| `fonts/` | Archivo（可変：wdth 62–125 / wght 100–900）、Space Grotesk、Space Mono、Zen Kaku Gothic New（使用文字のみ）。いずれも OFL |

## 構成（120 BPM・0.5秒 = 1拍）

| 時間 | 章 | 内容 |
|---|---|---|
| 0.00–1.50 | 01 起点 | オレンジの点が拍で脈打ち、波紋。溜め → 落下 → 着地でつぶれる |
| 1.50–4.00 | 02 文字 | 点が水平線に弾け、EVERY / FRAME / IS A / FUNCTION / OF TIME がマスクから立ち上がる。可変フォントの幅と太さを同時に動かす。FUNCTION で白に反転。線が縮んで TIME のピリオドになる |
| 4.00–6.50 | 03 形 | ピリオドが円 → 5,832点の球 → トーラス → 二重らせんへ、高さ方向に遅延をつけてモーフ |
| 6.50–9.00 | 04 流れ | 爆発 → カールノイズの流体（事前積分で決定論的）→ 粒子が集まって f(t) を形成 |
| 9.00–11.50 | 05 体系 | 波で回転・変形するスイスグリッド ＋ 実際の仕様を刻むスロット数字（15.000秒 / 900フレーム / 5832粒子 / 1ファイル / 0キーフレーム） |
| 11.50–13.05 | 06 結論 | NO TIMELINE.（帯スライス）/ NO PLUGINS.（落下）/ JUST MATH.（幅の伸縮）→ オレンジ面が円で縮んで点に戻る |
| 13.05–15.00 | エンド | 点が弧を描いて「Claude」のピリオドに着地。最後はすべてが点に畳まれ、**0秒目と同じ絵で終わる＝完全ループ** |

仕上げ：ヒット時のカメラパンチ・RGBずれ・フラッシュ、常時のフィルムグレインとビネット、
180fps で書き出して3フレームずつ平均する**実モーションブラー**（シャッター360°相当）。

## 再現

```
node render.mjs frames 180 4          # out/frames/f00000.png … f02699.png
node audio.mjs                        # out/reel.wav
ffmpeg -framerate 180 -i out/frames/f%05d.png -i out/reel.wav \
  -vf "tmix=frames=3,select='eq(mod(n\,3)\,2)',setpts=N/60/TB,format=yuv420p" -r 60 \
  -c:v libx264 -preset slow -crf 17 -maxrate 14M -bufsize 28M -tune grain -profile:v high -g 60 \
  -c:a aac -b:a 256k -movflags +faststart -t 15 reel-x.mp4
```
