---
name: blender
description: Blender で 3D モデル作成・レンダリング・glTF/GLB 書き出しを行う。「Blender」「3D」「モデリング」「レンダリング」「glb」「three.js 用モデル」「サムネイル画像を3Dで」などの依頼で使う。web セッションではヘッドレス bpy、ローカルでは Blender MCP も使える。
---

# Blender 連携スキル

このリポジトリには Blender を扱うための仕組みが最初から入っている。**Blender をダウンロードしたり探したりする必要はない。**

## まず確認

```bash
tools/blender/blender.sh -c "import bpy; print(bpy.app.version_string)"
```

動かなければ `bash tools/blender/setup.sh` を実行する（web セッションではセッション開始時に自動実行済み。初回は約 300MB の `bpy` を PyPI から入れるので数分かかる）。

## 使い方（ヘッドレス bpy が基本）

1. スクリプトを `tools/blender/` 配下、または一時ディレクトリに書く
2. `tools/blender/blender.sh script.py [args]` で実行する
3. 出力は `img/`（PNG）や `pinball/`（GLB）などサイトに置く場所へ直接書き出す

```python
import bpy
import idk_blender as ib   # tools/blender/idk_blender.py（blender.sh 経由なら自動で import 可）

ib.reset_scene()
bpy.ops.mesh.primitive_uv_sphere_add(radius=1)
ib.add_material(bpy.context.active_object, color=ib.hex_color("#111111"), metallic=0.8, roughness=0.2)
ib.add_camera(location=(4, -5, 3), look_at=(0, 0, 0))
ib.add_sun()
ib.setup_render(width=1200, height=630, samples=32, transparent=False)
ib.render("img/og-3d.png")
ib.export_glb("pinball/sphere.glb")
```

ヘルパー一覧: `reset_scene`, `add_camera`, `add_sun`, `add_point_light`, `add_material`, `hex_color`, `setup_render`, `render`, `export_glb`, `export_obj`, `save_blend`, `open_blend`, `turntable`, `site_path`。
サンプル: `tools/blender/examples/render_preview.py`（PNG+GLB）、`tools/blender/examples/export_glb.py`（.blend→GLB）。
キャラクター生成の実例: `tools/blender/characters/pink_operator.py`（リグ付き人型＋剣。前開きシェル `arc_shell`、髪リボン `ribbon`、
名前ベースのボーン自動割り当て、ポーズテスト、白背景合成 `composite_white` を含む）。新しいキャラクターはこれを複製して作るのが早い。
既存キャラクターの修正依頼はこのスクリプトを編集して再実行し、出力先 `models/pink-operator/` を上書きする。

## 注意点

- GPU は無い。レンダリングは `CYCLES`（CPU）を使い、`samples` は 16〜64 程度に抑える。EEVEE/Workbench は EGL ライブラリがあれば動くが失敗することがある
- `bpy.ops.*` の一部はコンテキスト依存。オブジェクト生成後は `bpy.context.active_object` で取得する
- 出力した PNG は Read ツールで開いて結果を目視確認する
- 大きなバイナリ（.blend, 高解像度 PNG）を無闇にコミットしない。サイトで使う成果物だけを追加する。`.blend1` バックアップは `.gitignore` 済み
- 生成した GLB を three.js で読む場合は `GLTFLoader`（`pinball/scene3d.js` 参照）

## ローカル GUI 連携（Blender MCP）

ローカルで Blender を開いている場合は `.mcp.json` の `blender` MCP サーバー（`uvx blender-mcp`）が使える。Blender 側で blender-mcp アドオンを有効化し「Connect to Claude」を押した状態で、MCP ツール（`get_scene_info`, `execute_blender_code` など）を呼ぶ。web セッションからはローカルの Blender に接続できないので、その場合はヘッドレス bpy を使う。
