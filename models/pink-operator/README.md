# Pink Operator — 3D キャラクターモデル（リグ付き）

ピンク×ホワイトのタクティカル衣装キャラクターと剣。`tools/blender/characters/pink_operator.py` から
Blender (bpy) でプロシージャルに生成している。

| ファイル | 内容 |
| --- | --- |
| `pink-operator.glb` | キャラクター本体（アーマチュア／スキンウェイト込み、glTF 2.0 Binary） |
| `pink-operator-sword.glb` | 剣（単体、原点＝刃先） |
| `pink-operator.blend` | Blender ファイル（リグ・マテリアル・ライト・カメラ込み） |
| `index.html` | three.js ビューア（`https://idatsuka.com/models/pink-operator/`） |
| `front.png` `back.png` `side.png` `three-quarter.png` | レストポーズのレンダリング |
| `pose.png` | リグでポーズを付けたテストレンダリング（剣を構える） |
| `sword.png` | 剣のレンダリング |

## リグ（ボーン構成）

Blender 標準の命名（`.L` = キャラクターの左 = +X）。Unity / Unreal / Mixamo 系のヒューマノイドにリターゲット可能な階層。

```
root
└ hips
  ├ spine → chest → neck → head → ponytail.000 … ponytail.003
  │                 ├ shoulder.L → upper_arm.L → forearm.L → hand.L
  │                 └ shoulder.R → upper_arm.R → forearm.R → hand.R
  ├ thigh.L → shin.L → foot.L → toe.L
  └ thigh.R → shin.R → foot.R → toe.R
```

- 関節をまたぐパーツ（腕・脚・膝パッド・ブーツ）は最寄り 2 ボーンのブレンドウェイト、装備品は 1 ボーンに剛体割り当て
- Blender で `pink-operator.blend` を開き、`PinkOperatorRig` を選んで **Pose Mode** にすると動かせる
- three.js では `SkinnedMesh` として読み込まれ、`skeleton.getBoneByName("upper_arm.R")` などで直接回転できる
- 剣はキャラクターとは別オブジェクト。手に持たせる場合は `hand.R` ボーンに親子付けする（`pose.png` はその例）

## 再生成

```bash
tools/blender/blender.sh tools/blender/characters/pink_operator.py          # 本番（約 80 秒）
tools/blender/blender.sh tools/blender/characters/pink_operator.py --quick  # 低解像度プレビュー（約 15 秒）
```
