# adobe-mcp — Claude から Premiere Pro を操作する

Claude(Claude Desktop / Claude Code)から Adobe Premiere Pro を直接操作するための MCP サーバーと CEP パネルです。
「V1トラックの3秒地点にこのクリップを置いて」「全カットの位置にマーカーを打って」「H.264で書き出して」といった指示が、そのままタイムラインに反映されます。

After Effects / Photoshop / Illustrator も同じパネルで接続できる作りになっています(専用ツールは今後追加、現状は ExtendScript 実行のみ)。

---

## 仕組み

```
Claude Desktop / Claude Code
        │  MCP (stdio)
        ▼
adobe-mcp サーバー (Node.js)
        │  WebSocket  ws://127.0.0.1:8765
        ▼
MCP Bridge パネル (Premiere の中に常駐)
        │  evalScript
        ▼
ExtendScript → Premiere Pro
```

ポイントは **パネルがサーバーに接続しにいく** 点です。Premiere を起動してパネルを開いている間だけ操作が通り、閉じれば切れます。通信は `127.0.0.1` に閉じていて外部には出ません。

> **前提**: この仕組みは Premiere が動いているマシンの上で完結します。クラウド上の Claude(claude.ai/code など)からは、あなたのPCの Premiere には届きません。**ローカルの Claude Desktop か Claude Code から使ってください。**

---

## セットアップ

### 1. リポジトリを取得して依存をインストール

```bash
git clone https://github.com/IDATSUKA/IDATSUKA.github.io.git
cd IDATSUKA.github.io/adobe-mcp
npm install
```

動作確認(Premiere なしで通ります):

```bash
npm test
```

### 2. CEP パネルを Premiere にインストール

**macOS**

```bash
./scripts/install-mac.sh
```

**Windows**(PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

このスクリプトは 2 つのことをします。

1. **PlayerDebugMode を有効化** — Adobe の署名がないパネルを読み込めるようにする設定です。これを入れないとパネルがメニューに出ません。
2. パネル本体を CEP の拡張フォルダにコピー

インストール先:

| OS | パス |
|---|---|
| macOS | `~/Library/Application Support/Adobe/CEP/extensions/com.idatsuka.adobebridge` |
| Windows | `%APPDATA%\Adobe\CEP\extensions\com.idatsuka.adobebridge` |

インストール後、**Premiere を完全に終了して起動し直してください**(プロジェクトを閉じるだけでは反映されません)。

### 3. Claude に MCP サーバーを登録

`/絶対パス/` の部分は自分の環境のパスに置き換えてください。

**Claude Code(ターミナル)**

```bash
claude mcp add adobe -- node /絶対パス/adobe-mcp/server/index.js
```

**Claude Desktop アプリ**

設定ファイルを開いて `mcpServers` に追記します。

| OS | 設定ファイル |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "adobe": {
      "command": "node",
      "args": ["/絶対パス/adobe-mcp/server/index.js"]
    }
  }
}
```

保存したら Claude Desktop を再起動します。

> **注意**: Claude Desktop と Claude Code の両方に登録すると、両方が同じポート 8765 を掴もうとして後から起動した方が失敗します。普段使う方だけに登録するのが確実です。両方使いたい場合は、片方の設定に `"env": { "ADOBE_MCP_PORT": "8766" }` を足し、パネル側でも DevTools のコンソールから `localStorage.setItem("amb_port", "8766")` を実行してください。

### 4. 接続を確認

1. Premiere Pro を起動してプロジェクトを開く
2. メニューの **ウィンドウ > 機能拡張 > MCP Bridge** を開く
3. パネルが「**接続済み**」(緑ランプ)になれば完了
4. Claude に「`adobe_status` を実行して」と頼むと、`PPRO` が接続済みとして返ってきます

---

## 使い方

自然文で頼めば Claude が適切なツールを選びます。

```
今開いてるプロジェクトの構成を教えて
```
```
Footage/Day1 の中のクリップを全部 V1 に順番に並べて
```
```
シーケンス "Main" の5秒、12秒、20秒でカットを入れて
```
```
V1の3番目のクリップを80%に縮小して、不透明度を50にして
```
```
書き出しプリセット一覧を見せて。H.264 のやつで ~/Desktop/out.mp4 に書き出して
```

### 使えるツール(全26種 + ステータス)

| 分類 | ツール |
|---|---|
| プロジェクト | `pr_get_project_info` `pr_list_project_items` `pr_import_files` `pr_create_bin` `pr_save_project` |
| シーケンス | `pr_list_sequences` `pr_get_sequence` `pr_open_sequence` `pr_create_sequence` |
| タイムライン | `pr_list_timeline_clips` `pr_add_clip` `pr_remove_clip` `pr_move_clip` `pr_trim_clip` `pr_razor` `pr_set_track_state` |
| マーカー | `pr_list_markers` `pr_add_marker` |
| 再生位置 | `pr_set_playhead` `pr_set_in_out` |
| エフェクト | `pr_list_clip_components` `pr_set_clip_property` `pr_set_clip_transform` |
| 書き出し | `pr_list_export_presets` `pr_export_sequence` |
| 汎用 | `pr_run_extendscript` `adobe_status` |

`pr_run_extendscript` は任意の ExtendScript を実行できる逃げ道です。専用ツールで足りない操作に使えますが、プロジェクトを壊しうるので実行前に内容を確認してください。

### 覚えておくと便利なこと

- **トラック番号は 0 始まり**です。V1 = `trackIndex: 0`。
- **時間はすべて秒**です。タイムコードではありません。
- **書き出しには `.epr` プリセットの絶対パスが必要**です。持っていない場合は Premiere で「ファイル > 書き出し > メディア」を開き、設定して「プリセットを保存」してから `pr_list_export_presets` を実行してください。
- **エフェクトのプロパティ名は UI 言語で変わります**。`pr_set_clip_transform` が失敗したら、`pr_list_clip_components` で実際の index を調べて `pr_set_clip_property` を使ってください。

---

## うまくいかないとき

**パネルがメニューに出ない**
: PlayerDebugMode が効いていないか、Premiere を再起動していません。インストールスクリプトを再実行し、Premiere を完全終了してから起動し直してください。

**パネルが「未接続」のまま**
: MCP サーバーが起動していません。サーバーは Claude が MCP 接続を張ったときに自動起動するので、まず Claude Desktop / Claude Code を起動してください。パネルは3秒おきに自動で再接続を試みます。

**「Premiere Pro is not connected」と言われる**
: Premiere は起動していてもパネルが開いていません。ウィンドウ > 機能拡張 > MCP Bridge を開いてください。

**ツールが応答しない / タイムアウトする**
: Premiere がモーダルダイアログを表示して待っている可能性が高いです。Premiere の画面を確認してください。

**パネルの中身をデバッグしたい**
: Premiere 起動中に `http://localhost:8088` をブラウザで開くと Chrome DevTools が使えます(ポートは `.debug` で定義)。

---

## After Effects / Photoshop / Illustrator

パネルの `manifest.xml` は AEFT / PHXS / ILST / AUDT にも対応済みで、インストールすればこれらのアプリでもパネルが開き、MCP サーバーに接続します(`adobe_status` に出てきます)。

ただし現時点で専用ツールがあるのは Premiere だけです。他のアプリは `jsx/generic.jsx` が読み込まれ、`getAppInfo` と `runExtendScript` だけが動きます。

専用ツールを足す手順:

1. `cep/com.idatsuka.adobebridge/jsx/aftereffects.jsx` のようなモジュールを作り、`AMB_ACTIONS` と `AMB_dispatch` を定義する(`premiere.jsx` が雛形です。**ファイルは ASCII のみ**で書いてください — `$.evalFile` が UTF-8 を正しく読まないためです)
2. `js/main.js` の `MODULES` にアプリIDを追加する(`AEFT: ["json2.jsx", "aftereffects.jsx"]`)
3. `server/tools/aftereffects.js` にツール定義を書き、`server/index.js` の `tools` 配列に足す

---

## 開発

```
adobe-mcp/
├── server/
│   ├── index.js            MCP サーバー本体(stdio)
│   ├── bridge.js           WebSocket ブリッジ
│   └── tools/premiere.js   Premiere のツール定義とスキーマ
├── cep/com.idatsuka.adobebridge/
│   ├── CSXS/manifest.xml   CEP 拡張の定義
│   ├── index.html          パネル UI
│   ├── js/main.js          接続とディスパッチ
│   └── jsx/premiere.jsx    Premiere を実際に動かす ExtendScript
├── scripts/                インストーラ
└── test/                   Premiere なしで動くテスト
```

`--link` を付けてインストールするとシンボリックリンクになり、ソースを編集してパネルの「スクリプト再読込」を押すだけで反映されます。

```bash
./scripts/install-mac.sh --link
```

テストは Premiere を必要としません。`test/premiere-jsx.test.mjs` はモックの Premiere DOM 上で ExtendScript を実行し、`test/plumbing.test.mjs` は偽パネルを繋いで MCP 往復を検証します。

```bash
npm test
```
