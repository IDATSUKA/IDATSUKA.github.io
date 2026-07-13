# Blender / Unity MCP セットアップガイド

このリポジトリには、Claude Code から **Blender** と **Unity** を操作するための
MCP(Model Context Protocol)設定 [`.mcp.json`](../.mcp.json) が含まれています。

> **重要:** Blender や Unity は GUI アプリケーションのため、MCP 接続が実際に機能するのは
> **Blender / Unity を起動できるローカルマシン**(Claude Code CLI / デスクトップアプリ)上だけです。
> クラウド上のリモートセッションでは接続できません。

---

## 前提条件(共通)

| ツール | 要件 |
|---|---|
| [uv](https://docs.astral.sh/uv/) | Python パッケージマネージャ。MCP サーバーの起動に使用 |
| Python | 3.10 以上 |
| Claude Code | ローカルにインストール済みであること |

uv のインストール:

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

---

## 1. Blender MCP([ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp))

Blender 3.0 以上が必要です。

### 手順

1. **アドオンのダウンロード**
   リポジトリから [`addon.py`](https://github.com/ahujasid/blender-mcp/blob/main/addon.py) をダウンロードします。

2. **Blender にアドオンをインストール**
   - Blender を起動 → `編集 (Edit)` → `プリファレンス (Preferences)` → `アドオン (Add-ons)`
   - `インストール...` をクリックし、ダウンロードした `addon.py` を選択
   - `Interface: Blender MCP` にチェックを入れて有効化

3. **接続を開始**
   - 3D ビューポートのサイドバー(`N` キー)に **BlenderMCP** タブが表示されます
   - `Connect to Claude` をクリック(既定でポート `9876` を待ち受けます)

4. **Claude Code 側**
   このリポジトリのルートで Claude Code を起動すると、`.mcp.json` の
   `blender` サーバー(`uvx blender-mcp`)が自動的に読み込まれます。
   初回はプロジェクトの MCP サーバーを承認するプロンプトが表示されるので許可してください。

### 動作確認

Claude Code 内で `/mcp` を実行し、`blender` が **connected** になっていれば成功です。
「立方体を作って赤いマテリアルを付けて」などと指示して動作を確認できます。

### カスタマイズ(任意)

環境変数でホスト・ポートを変更できます:

- `BLENDER_HOST`(既定: `localhost`)
- `BLENDER_PORT`(既定: `9876`)

---

## 2. Unity MCP([CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp))

Unity **2021.3 LTS 〜 6.x** に対応しています。

### 手順

1. **Unity パッケージのインストール**
   - Unity で対象プロジェクトを開く
   - `Window` → `Package Manager` → `+` → `Add package from git URL...`
   - 次の URL を入力:

     ```
     https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main
     ```

     (安定版に固定したい場合はリリースタグ、例 `#v10.0.0` を指定。
     OpenUPM 派なら `openupm add com.coplaydev.unity-mcp` でも可)

2. **クライアントの自動設定(推奨)**
   - Unity メニューの `Window` → `MCP for Unity` を開く
   - `Configure All Detected Clients` をクリック
   - Claude Code / Claude Desktop が検出され、MCP 設定が自動で書き込まれます。
     **この方法を使う場合、下記の手動設定は不要です。**

3. **手動設定を使う場合(このリポジトリの `.mcp.json` を利用)**
   `.mcp.json` の `unityMCP` エントリは環境変数 `UNITY_MCP_SRC` で
   サーバーのインストール先を参照します。Unity パッケージが展開した
   Python サーバーの `src` ディレクトリを指すように設定してください:

   ```bash
   # macOS / Linux(~/.bashrc や ~/.zshrc に追記)
   export UNITY_MCP_SRC="$HOME/.local/share/UnityMCP/UnityMcpServer/src"
   ```

   ```powershell
   # Windows (PowerShell)
   [Environment]::SetEnvironmentVariable("UNITY_MCP_SRC",
     "$env:LOCALAPPDATA\Programs\UnityMCP\UnityMcpServer\src", "User")
   ```

   ※ 実際のインストール先はバージョンにより異なる場合があります。
   Unity の `Window → MCP for Unity` ウィンドウに表示されるサーバーパスを確認してください。

4. **接続**
   - Unity エディタを開いたまま、ローカルで Claude Code を起動
   - `/mcp` で `unityMCP` が **connected** になっていれば成功です

---

## トラブルシューティング

- **`uvx: command not found`** — uv が未インストール、または PATH が通っていません。
  上記の手順で uv をインストールし、ターミナルを再起動してください。
- **Blender に接続できない** — Blender 側で `Connect to Claude` を押しているか、
  ポート `9876` が他プロセスに使われていないか確認してください。
- **Unity MCP が起動しない** — `UNITY_MCP_SRC` のパスが正しいか、
  もしくは Unity の `Configure All Detected Clients` による自動設定に切り替えてください。
- **MCP サーバーの状態確認** — Claude Code 内で `/mcp` を実行すると
  各サーバーの接続状態とエラーが確認できます。
