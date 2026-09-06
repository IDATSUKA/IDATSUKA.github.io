# IDATSUKA.github.io

IDATSUKA の個人サイト（GitHub Pages、静的 HTML/CSS/JS）。ビルド工程は無く、ルートの HTML をそのまま配信する。

## 構成

- `*.html`, `style.css`, `img/` — サイト本体（トップ、works、blog、games など）
- `pinball/` — three.js / matter.js 製ピンボールゲーム（PWA）
- `products/` — 販売テンプレート
- `PinballGame/` — iOS (SpriteKit) 版ピンボールの Xcode プロジェクト
- `tools/blender/` — Blender 連携（詳細は `.claude/skills/blender/SKILL.md`）

## Blender

3D モデル・レンダリング・GLB 出力の依頼は `blender` スキルを使う。web セッションでは `tools/blender/blender.sh` でヘッドレス Blender (bpy) が使える（セッション開始時に自動セットアップ）。ローカルでは `.mcp.json` の Blender MCP でも操作できる。
