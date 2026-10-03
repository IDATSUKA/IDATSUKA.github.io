# Cowork への依頼：15秒フィルムの音を仕上げる

idatsuka.com の15秒フィルム（`promo/kt/kt-16x9.mp4` / `kt-9x16.mp4`）は、映像が完成しています。
音は仮のBGMしか入っていません。あなた（Cowork）の仕事は、この依頼文だけで次の3つを最後まで仕上げることです。

- **ナレーション**を Gemini TTS で作る
- **BGM** を Gemini music で作る
- **効果音**を効果音ラボから選ぶ

できあがった素材を付属のスクリプトでミックスし、2本の動画に差し込みます。

---

## 0. 準備

1. リポジトリ `IDATSUKA/IDATSUKA.github.io` を手元に用意し、ブランチ **`claude/stoic-gates-dw8dfn`** に切り替えて最新にする。
   ```
   git fetch origin claude/stoic-gates-dw8dfn
   git checkout claude/stoic-gates-dw8dfn
   git pull origin claude/stoic-gates-dw8dfn
   ```
2. **Python 3** と **ffmpeg** が使えることを確認する（`python3 --version` / `ffmpeg -version`）。
   無ければ入れてよい（macOS なら `brew install ffmpeg`）。
3. 台本と指示は `promo/kt/audio/cues.json` にあります。下の文言はそれと同じです。食い違ったら `cues.json` を正とする。
4. 作業フォルダはすべて `promo/kt/audio/` の中です。

## 1. ナレーション — Gemini TTS（3ファイル）

ブラウザで **Google AI Studio**（aistudio.google.com）を開き、音声生成（Generate speech / TTS）を使う。
Gemini アプリに音声生成があれば、そちらでもよい。

- 話者は1人。声は **Sulafat**。合わなければ **Achernar** か **Kore** を試して、いちばん落ち着いて聞こえるものを選ぶ。
- 声の指示（スタイル）に次をそのまま入れる：
  > 高級ブランドのCMナレーション。落ち着いた低めの声で、ゆっくり、息を含ませて、上品に。語尾は置くように静かに。間を大切に。
- 次の3行を**1行ずつ別々に**生成し、WAV（なければ MP3）で保存する。

| 保存先 | 読ませる文 | 長さの目安 |
|---|---|---|
| `promo/kt/audio/vo/vo1.wav` | その五分、まだ退屈？ | 1.3〜1.8秒 |
| `promo/kt/audio/vo/vo2.wav` | 完璧より、夢中を。 | 1.2〜1.6秒 |
| `promo/kt/audio/vo/vo3.wav` | 一度、遊んでみよう。 | 1.2〜1.6秒 |

**確認**
- 「五分」が「ごふん」と読まれていること。
- 前後に長い無音があれば、0.05秒程度を残して切る（`ffmpeg -af silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse`）。
- 長すぎる行は、少し速めに生成し直す。

## 2. BGM — Gemini music（1ファイル）

Gemini の音楽生成（Gemini music / Lyria。AI Studio か Gemini アプリ）で、次をそのまま入れて生成する。
**2〜3テイク**作り、いちばん上品なものを `promo/kt/audio/bgm.wav` として保存する（MP3 でもよい）。

> 15-second instrumental for a luxury brand film. 90 BPM, A minor. Minimal and elegant: soft felt piano motif, warm analog sub bass, airy string pad, restrained crisp percussion with a quiet kick on every beat. Structure: 0-1.3s near silence with a single piano note; 1.3s pulse begins softly; 4.7s gentle lift as percussion fills in; 10.0s a breath (drums drop out, piano and pad only); 11.3s pulse returns; 13.33s one deep resolving hit, then a long reverb tail to 15s. No vocals, no risers, no EDM drops. Calm, precise, expensive, cinematic. Like a high-end watch or design studio commercial.

**扱い**
- 15秒より長くてもかまわない（ミックス側で15秒に切り、最後の0.9秒でフェードアウトする）。
- 曲の頭に無音や前置きがある場合は、`cues.json` の `bgm.offset` に、曲を使い始めたい秒数を入れる（例 `0.4`）。

## 3. 効果音 — 効果音ラボ（5ファイル）

**効果音ラボ**（soundeffect-lab.info）から、**短く・小さく・品のある音**を選ぶ。派手な「ドーン」「キュイーン」系は避ける。
**使う前に効果音ラボの利用規約を確認する**こと。規約に合わない用途なら、その音は使わずに報告する。

| 保存先（拡張子は wav / mp3 どちらでも） | 探す方向 | 鳴る場面 |
|---|---|---|
| `promo/kt/audio/sfx/shimmer` | キラッ・光る（ごく短い） | 0.06秒：冒頭の細い線が伸びる |
| `promo/kt/audio/sfx/whoosh` | シュッ・風を切る（素早く通り過ぎる） | 3.08秒・11.08秒：黒い帯が画面を横切る |
| `promo/kt/audio/sfx/tick` | カーソル移動・小さな決定音 | 4.67秒・6.00秒・7.33秒：01→02→03 の切り替え |
| `promo/kt/audio/sfx/swish` | スワイプ・紙をめくる（軽い） | 8.67秒：スマホがせり上がる |
| `promo/kt/audio/sfx/hit` | 余韻のある低い単音（ピアノ・鐘の一打） | 13.33秒：エンドカード |

各音の大きさは `cues.json` の `gain_db` で調整できる。

## 4. ミックスして動画に入れる

```
python3 promo/kt/audio/mix.py
```

このスクリプトがやること：
- ナレーションと効果音を決まった時刻に置く
- BGM はナレーションの間だけ自動で下げる
- 全体を -14 LUFS / -1.5 dBTP に整える
- `promo/kt/kt-16x9.mp4` と `kt-9x16.mp4` の音声を差し替える（映像はそのまま）

最後に「未投入の素材」が表示されたら、それが残っている素材です。全部そろうまで1〜3に戻る。

## 5. 仕上がりの確認

1. 両方の動画を**実際に再生して聴く**。確認する点：
   - ナレーションが聞き取れるか
   - BGM がうるさくないか
   - 効果音が画面の動きと合っているか
   - 終わりが余韻で静かに消えるか
2. 気になる点があれば、`cues.json` の `gain_db`・`at`（秒）・`bgm.offset` を直して、`mix.py` を再実行する。
3. 数値の確認：
   ```
   ffprobe -v error -show_entries format=duration -of default=nw=1 promo/kt/kt-16x9.mp4   # duration=15.000000
   ffmpeg -i promo/kt/audio/mix.wav -af ebur128=peak=true -f null - 2>&1 | tail -12        # I ≈ -14 LUFS, Peak ≤ -1.5 dBFS
   ```

## 6. コミットとプッシュ

- **コミットするもの**：
  - `promo/kt/kt-16x9.mp4`
  - `promo/kt/kt-9x16.mp4`
  - `promo/kt/audio/vo/*.wav`
  - `promo/kt/audio/bgm.wav`
  - 調整した場合は `promo/kt/audio/cues.json`
- **コミットしないもの**：
  - 効果音ラボの元ファイル（`sfx/` の wav・mp3）。このリポジトリは公開サイトなので、元ファイルを載せると再配布にあたるおそれがある。`.gitignore` 済み。
  - `mix.wav`
- `claude/stoic-gates-dw8dfn` にプッシュする。**main にはマージしない**。
  ```
  git add promo/kt/kt-16x9.mp4 promo/kt/kt-9x16.mp4 promo/kt/audio/vo promo/kt/audio/bgm.* promo/kt/audio/cues.json
  git commit -m "Add Gemini TTS narration, Gemini music BGM and 効果音ラボ SFX to the 15s film"
  git push -u origin claude/stoic-gates-dw8dfn
  ```

## 7. 報告すること

- 使った声の名前、BGM のテイク数と選んだ理由
- 効果音ラボで選んだ5つの音の名前（ページ名）と、利用規約を確認した結果
- `mix.py` が出した最終の数値（長さ・LUFS・ピーク）
- 完成した2本の動画
