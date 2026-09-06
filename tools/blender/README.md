# Blender 連携 (`tools/blender/`)

このリポジトリでは Blender を 2 通りの方法で使えます。

| 方法 | 使う場面 | 仕組み |
| --- | --- | --- |
| **ヘッドレス (bpy)** | Claude Code on the web / CI / ローカルのスクリプト実行 | PyPI の `bpy` (Blender as a Python module) を venv に入れて Python から直接 Blender を動かす |
| **Blender MCP** | ローカルで Blender の GUI を開きながら Claude に操作させたい時 | `.mcp.json` の `blender` サーバー (`uvx blender-mcp`) が Blender アドオン経由でシーンを操作する |

## ヘッドレス (bpy)

```bash
bash tools/blender/setup.sh                        # 初回セットアップ（web セッションでは自動）
tools/blender/blender.sh script.py [args]          # スクリプト実行
tools/blender/blender.sh -c "import bpy; print(bpy.app.version_string)"
tools/blender/blender.sh tools/blender/examples/render_preview.py   # 動作確認
```

- venv の場所: `$BLENDER_VENV`（既定 `~/.cache/idatsuka-blender/venv`）
- Claude Code on the web では `.claude/hooks/session-start.sh` がセッション開始時に自動セットアップします
- `import idk_blender as ib` でヘルパー（シーン初期化・カメラ・ライト・マテリアル・レンダ・GLB 出力）が使えます
- レンダリングエンジンは `CYCLES`（CPU）が最も確実です。GPU はありません

既存のキャラクター:

- `tools/blender/characters/pink_operator.py` — リグ付きキャラクター「Pink Operator」と剣。`arc_shell`（前開きジャケット）、`ribbon`（髪の毛束）、
  名前ベースのボーン割り当てなど、キャラクター生成の実装例として流用できる。出力は `models/pink-operator/`

出力先の目安:

- サムネイル / OG 画像 → `img/`
- three.js 用モデル → `pinball/` や `models/<name>/`（`export_glb`）

## Blender MCP（ローカル GUI 連携）

1. Blender に [blender-mcp](https://github.com/ahujasid/blender-mcp) のアドオン (`addon.py`) を入れる
2. Blender の サイドバー (N) → BlenderMCP → **Connect to Claude** を押す（localhost:9876 で待受）
3. このリポジトリで `claude` を起動すると `.mcp.json` の `blender` サーバーが使えるようになる（初回は承認ダイアログが出ます）
4. `uv` が必要: `curl -LsSf https://astral.sh/uv/install.sh | sh`

web セッションではローカルの Blender に接続できないため、MCP ではなくヘッドレス (bpy) を使ってください。
