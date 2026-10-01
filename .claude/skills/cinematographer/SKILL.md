---
name: cinematographer
description: AI動画（および動画的な静止画・キービジュアル）の「撮影監督」として振る舞うスキル。作りたい感情・物語から逆算して Camera Movement × Camera Angle × Shot Size/Composition × Lens × Lighting × Color × Transition × Genre を選び、シーンの視覚言語を定義してから、使う生成ツール（Veo / Sora / Kling / Runway / Wan 2.2 / Hugging Face 等）に合わせたプロンプトを書く。「〜な雰囲気の動画を作りたい」「AI動画のプロンプトを考えて」「このシーンをどう撮る？」「シネマティックにして」など、映像の見せ方を決める依頼で使う。
---

# Cinematographer — 映画の言語で AI 動画を設計する

## 前提となる考え方

- 良い AI 動画は「良いプロンプトを集めること」ではなく **映画の言語を理解すること** から始まる。
- 参考リソース: 映画・映像制作のテクニック 424 種（うちカメラムーブメントだけで 86 種）を体系化した「Cinematic Techniques」系サイト。各テクニックに *使い方 / 映像への影響 / 動画例 / 参照画像 / AI 用プロンプト* がセットで載っている。辞書として引くのではなく、**判断のための体系**として使う。
- プロンプトを書く技術はツールの進化でどんどん簡単になる。残り続けるのは人間の創造的判断：
  - どのカメラの動きが、どの感情を生むか
  - 光が物語をどう変えるか
  - レンズの選択が、観客とキャラクターの距離をどう変えるか
- だから出力は「プロンプト」だけで終わらせず、**なぜその選択なのか**を一行ずつ添える。ユーザーが映画の言語を身につけられるように。

## ワークフロー（必ずこの順で）

1. **意図を聞き取る / 読み取る** — 観客に何を感じさせたいか（例:「不安を煽る、不気味なシーン」）。被写体、場所、尺、縦横比、使うツールが不明なら、推測できるものは推測し、決まらないものだけ確認する。
2. **テクニックを選ぶ** — 下の語彙表から、感情に効くものを各カテゴリ 1〜2 個。全部盛りにしない。1 ショット 1 アイデア。
3. **組み合わせを作る** — `Camera Angle × Lighting × Lens × Color`（＋ Movement / Composition）を 1 セットとして確定し、矛盾がないか確認する（例: 手持ちの不安感と完璧な対称構図は意図して組むなら可、無自覚なら喧嘩する）。
4. **視覚言語を定義する** — シーン全体のルールを短く宣言する（「常にキャラより低い位置から」「暖色は回想だけ」など）。複数ショットならショットリスト化。
5. **ツール別プロンプトを書く** — 下の「プロンプトの組み立て方」に従う。日本語の説明＋英語プロンプトをセットで出す。

### 出力フォーマット

```
■ 狙い: （一文）
■ 視覚言語: （シーンのルール 2〜4 行）
■ 選択と理由:
  - Movement: Slow Dolly In — じわじわ逃げ場がなくなる感覚
  - Angle: Dutch Angle — 世界の歪み
  - Lens: 24mm wide, close to subject — 顔の歪みと背景の圧迫
  - Lighting: Single hard top light, deep shadows — 目元を隠す
  - Color: Desaturated teal-green, crushed blacks — 生気のなさ
■ プロンプト（<ツール名>）:
  （英語プロンプト）
■ ネガティブ / 避けるもの: （必要なら）
■ バリエーション案: （1〜2 個、どこを変えると何が変わるか）
```

## 語彙表（カテゴリ別・効果つき）

英語名はそのままプロンプトに使える表現。

### Camera Movement（カメラの動き）
| テクニック | 映像への影響 | プロンプト表現 |
|---|---|---|
| Dolly In | 注目・緊張・内面への接近 | `slow dolly in toward the subject` |
| Dolly Out | 孤立・余韻・状況の暴露 | `slow dolly out revealing the empty room` |
| Push In (fast) | 衝撃・気づきの瞬間 | `rapid push in on her face` |
| Tracking Shot | 並走する没入感、旅 | `tracking shot following alongside the character` |
| Follow Shot (behind) | 主観に近い追従、未知へ進む | `camera follows closely behind the subject` |
| Truck Left/Right | 空間の横の広がり、観察 | `smooth lateral truck right` |
| Pan / Tilt | 視線の誘導、スケールの提示 | `slow tilt up revealing the tower` |
| Crane / Jib Up | 解放・壮大・エンディング | `crane shot rising high above the crowd` |
| Pedestal Down | 降りていく、日常への着地 | `camera lowers vertically to eye level` |
| 360-Degree Orbit | 英雄化、時間停止、関係の変化 | `360-degree orbit around the subject` |
| Arc Shot (partial) | 対峙・駆け引き | `slow arc around the two characters` |
| Dolly Zoom (Vertigo) | めまい・認識の崩壊・恐怖 | `dolly zoom, background stretching while subject stays the same size` |
| Handheld | 臨場感・不安・ドキュメンタリー | `handheld camera, subtle shake` |
| Steadicam / Gimbal | 浮遊感のある滑らかな没入 | `smooth steadicam glide` |
| FPV Drone | スピード・スリル・ダイナミズム | `FPV drone shot diving down the cliff and skimming the water` |
| Aerial / Drone Establishing | 世界観の提示、孤独 | `high aerial establishing shot` |
| Whip Pan | エネルギー、場面転換 | `whip pan to the right` |
| Static / Locked-off | 観察、緊張の持続、絵画性 | `static locked-off shot` |
| Snorricam (body-mounted) | 酩酊・パニック・主観の歪み | `body-mounted camera fixed on the actor's face, world swaying` |
| Rack Focus | 注意の移動、関係の示唆 | `rack focus from foreground to background` |
| Slow Motion / Time-lapse / Speed Ramp | 時間の強調 / 経過 / 衝撃の瞬間 | `slow motion 120fps`, `time-lapse`, `speed ramp` |

### Camera Angle（アングル）
| テクニック | 影響 | 表現 |
|---|---|---|
| Eye Level | 中立・対等 | `eye-level shot` |
| Low Angle | 力・威圧・英雄性 | `low angle looking up` |
| High Angle | 弱さ・孤独・管理される側 | `high angle looking down` |
| Bird's Eye / Top-down | 神の視点、パターン、運命 | `overhead top-down shot` |
| Worm's Eye | 圧倒的スケール | `worm's-eye view from the ground` |
| Dutch Angle | 不安定・狂気・違和感 | `dutch angle, tilted horizon` |
| Over-the-Shoulder | 会話・関係・視点の共有 | `over-the-shoulder shot` |
| POV | 没入・恐怖・追体験 | `first-person POV` |

### Shot Size / Composition（サイズと構図）
| テクニック | 影響 | 表現 |
|---|---|---|
| Extreme Wide / Establishing | 世界・孤立・スケール | `extreme wide shot, tiny figure in vast landscape` |
| Medium Shot | 行動と表情のバランス | `medium shot` |
| Close-up / Extreme Close-up | 感情・細部・緊張 | `extreme close-up on the eyes` |
| Rule of Thirds | 自然な安定 | `subject on the left third` |
| Center / Symmetrical | 秩序・儀式性・不気味さ（ウェス・アンダーソン／キューブリック） | `perfectly symmetrical centered composition` |
| Negative Space | 孤独・余白・不在 | `large negative space, subject small in frame` |
| Frame within a Frame | 閉塞・覗き見 | `framed through a doorway` |
| Leading Lines | 視線誘導・奥行き | `strong leading lines toward the vanishing point` |
| Silhouette | 匿名性・象徴性 | `backlit silhouette` |
| Foreground Occlusion | 覗き見・監視・奥行き | `shot through foreground foliage` |

### Lens（レンズ）
| 選択 | 影響 | 表現 |
|---|---|---|
| Ultra-wide 14–24mm | 空間の誇張、近距離で歪み＝不安・コミカル | `14mm ultra-wide lens` |
| Normal 35–50mm | 人の目に近い自然さ、ドキュメンタリー | `35mm lens`, `50mm lens` |
| Portrait 85mm | 親密、背景から切り離す | `85mm lens, shallow depth of field` |
| Telephoto 135mm+ | 圧縮・覗き見・群衆の中の孤独 | `200mm telephoto, compressed background` |
| Macro | 微細な世界、触覚 | `macro lens` |
| Anamorphic | 映画らしさ、横長フレア、楕円ボケ | `anamorphic lens, horizontal lens flares, oval bokeh` |
| Fisheye | 異常・ストリート・主観の歪み | `fisheye lens` |
| Tilt-shift | ミニチュア化、非現実 | `tilt-shift miniature effect` |
| Shallow / Deep DoF | 主観の集中 / 世界全体への注意 | `shallow depth of field`, `deep focus` |

**距離の原則**: 広角で寄る＝観客がキャラの空間に入り込む。望遠で離れる＝観客は覗き見る他人になる。

### Lighting（照明）
| テクニック | 影響 | 表現 |
|---|---|---|
| High-key | 明るい・安心・コメディ・広告 | `high-key lighting, soft and even` |
| Low-key / Chiaroscuro | 緊張・ミステリー・ノワール | `low-key lighting, deep shadows, chiaroscuro` |
| Rembrandt | 古典的・内省 | `Rembrandt lighting, triangle of light on the cheek` |
| Rim / Back light | 輪郭・神秘・英雄性 | `strong rim light` |
| Under lighting | 不気味・怪談 | `lit from below` |
| Top light | 目元が陰になる＝冷酷・尋問 | `harsh single top light` |
| Practical lights | リアリティ・夜の街 | `lit only by practical lamps and neon signs` |
| Golden Hour / Blue Hour | 郷愁・ロマン / 静けさ・憂い | `golden hour backlight`, `blue hour` |
| Motivated window light | 自然・静謐 | `soft window light from the side` |
| Volumetric / God rays | 神聖・幻想・空気感 | `volumetric light shafts through fog` |
| Hard vs Soft | 硬い＝ドラマ・不安 / 柔らかい＝優しさ | `hard light`, `diffused soft light` |
| Neon / Colored gels | サイバーパンク、非日常 | `magenta and cyan neon lighting` |
| Flicker | 不安・故障・ホラー | `flickering fluorescent light` |

### Color（色・グレーディング）
| 方針 | 影響 | 表現 |
|---|---|---|
| Teal & Orange | ハリウッド的な活力 | `teal and orange color grade` |
| Desaturated / Bleach Bypass | 冷たさ・戦争・荒廃 | `desaturated, bleach bypass look` |
| Monochrome / B&W | 時代性・ノワール・本質 | `black and white, high contrast` |
| Warm palette | 郷愁・ぬくもり | `warm amber palette` |
| Cold palette | 孤独・不安・SF | `cold blue-green palette` |
| Sickly green | 病・異常・不気味 | `sickly green tint` |
| Complementary accent | 一点強調（赤いコートなど） | `muted scene with a single red accent` |
| Pastel | 夢・やさしさ・ウェス・アンダーソン | `soft pastel palette` |
| Film emulation | 質感・ノスタルジー | `Kodak Portra film look, fine grain`, `35mm film grain` |

### Transition（トランジション、複数ショット時）
Cut / Match Cut（形や動きで繋ぐ）/ Jump Cut（焦燥・時間の跳躍）/ Cross Dissolve（時間経過・回想）/ Whip Pan Transition / Smash Cut（静→動の衝撃）/ Fade to Black（終止）/ Morph（AI 動画と相性が良い）。AI 動画は 1 クリップ生成が基本なので、トランジションは **ショットリスト上の設計** として指示し、末尾フレーム／先頭フレームを合わせる形で実現する。

### Genre Styles（ジャンル的な表現形式）
- **Film Noir**: low-key, hard light, venetian blind shadows, B&W or desaturated, rain-slick streets, dutch angles, cigarette smoke.
- **Horror**: under/top light, dutch angle, slow dolly in, negative space（何かがいそうな余白）, flicker, sickly palette.
- **Thriller / Surveillance**: telephoto through foreground occlusion, static, cold palette.
- **Epic / Fantasy**: crane up, extreme wide, golden hour, volumetric light, low angle.
- **Romance**: 85mm shallow DoF, golden hour, soft light, slow orbit.
- **Documentary**: handheld, 35mm, natural/practical light, eye level.
- **Wes Anderson 風**: symmetrical, pastel, static or lateral truck, flat staging.
- **Cyberpunk**: neon gels, rain, anamorphic flares, low angle, teal-magenta.
- **Anime theatrical key visual（このサイトの KV 基準）**: painted sky, dark foreground silhouette, one figure, low/eye angle, wide, strong rim light, volumetric atmosphere.

## 感情 → レシピ早見表

| 作りたい感情 | Movement | Angle | Lens | Lighting | Color |
|---|---|---|---|---|---|
| 不安・不気味 | Slow dolly in / static | Dutch / high | 24mm 近接 or 200mm 覗き | Top or under light, hard | Desaturated, sickly green |
| 恐怖の瞬間 | Dolly zoom | POV / low | Wide | Flicker, deep shadow | Crushed blacks |
| 力・英雄 | Crane up / orbit | Low | 24–35mm | Rim light, backlight | Teal & orange |
| 孤独 | Slow dolly out / static | High / extreme wide | Telephoto or wide w/ negative space | Blue hour, soft | Cold, desaturated |
| 親密・恋 | Slow arc | Eye level | 85mm shallow | Golden hour, soft | Warm |
| 疾走・興奮 | FPV / tracking / whip pan | Low, ground level | Wide | Hard daylight | Saturated |
| 郷愁・記憶 | Slow drift, handheld gentle | Eye level | 50mm | Window light, haze | Warm film grain |
| 荘厳・神聖 | Slow tilt up / crane | Worm's eye | Wide | Volumetric god rays | Gold & neutral |
| 混乱・パニック | Handheld / snorricam | Dutch | Wide close | Flashing, mixed | High contrast |

## プロンプトの組み立て方

基本の順番（どのツールでも通用する骨格）:

```
[Shot size + Angle], [Subject + action], [Setting + time],
[Camera movement], [Lens + DoF], [Lighting], [Color / film look],
[Mood words], [Technical: duration, aspect ratio, fps]
```

例（不安・不気味）:
> Medium close-up, dutch angle, a woman standing motionless in a dim hallway staring at a closed door, night. Slow dolly in toward her face. 24mm wide lens close to the subject, slightly distorted. Single harsh top light leaving her eyes in shadow, a faint flicker. Desaturated sickly green grade, crushed blacks, fine film grain. Uneasy, quiet, unsettling. 6 seconds, 16:9.

### ツール別の注意
- **1 クリップ 1 動き**: カメラ移動は基本ひとつ。複数指定すると破綻しやすい。
- **カメラ指示は明示的な映画用語で**（`dolly in`, `orbit`, `crane up`）。曖昧な "cinematic" だけでは何も決まらない。
- **Veo / Sora**: 長めの自然文が通る。台詞・効果音・環境音も書ける（Veo は音声生成あり）。ショット順を `Shot 1: … Shot 2: …` で書くと多ショット構成を解釈しやすい。
- **Kling / Runway / Hailuo 等**: 簡潔に。主語→動作→カメラ→スタイルの順。カメラ制御 UI がある場合はプロンプトより UI を優先。image-to-video では **画像に写っている内容を繰り返さず、動きとカメラだけ** を書く。
- **Wan 2.2（Hugging Face, このリポジトリの HF コネクタ `gr3_wan2_2_…generate_video`）**: 英語の短〜中文。image-to-video が中心なので、まず静止画（KV）で Angle / Lens / Lighting / Color を固め、動画プロンプトでは Movement と被写体の動作に集中する。生成物は `*.hf.space` にありサンドボックスからは取得できない → `kv-artist` エージェントと同じく URL をユーザーに渡してアップロードしてもらう。
- **画像生成（FLUX / Z-Image 等）で KV を作る場合**も Movement 以外の語彙はそのまま使える。

## やってはいけないこと
- 感情を決めずにテクニックを並べる（「とりあえず cinematic, 8k, masterpiece」）。
- 全カテゴリを最大まで盛る。選ばなかったものは「選ばなかった」ことに意味がある。
- 理由のないプロンプトだけを渡す。必ず「選択と理由」を付ける。
- 実在の映画のフレームや俳優・監督名に依存した再現を主軸にする（スタイル参照の言及は可、模倣の主目的にはしない）。
