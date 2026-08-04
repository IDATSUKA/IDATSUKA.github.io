# Codex 連携セットアップ

Claude Code が **OpenAI Codex CLI** を配下のエージェントとして使えるようにするための設定です。
Claude が指示を組み立て → Codex が実行 → Claude が diff を検証して報告、という流れになります。

---

## 何が入っているか

| ファイル | 役割 |
|---|---|
| `AGENTS.md` | リポジトリの前提・規約・検証方法。**Codex が自動で読む**ファイル |
| `CLAUDE.md` | Claude 向けの指示。`AGENTS.md` を参照しつつ委譲ルールを定義 |
| `.claude/hooks/session-start.sh` | セッション開始時に `codex` CLI を自動インストール（リモート環境のみ） |
| `.claude/scripts/codex-run.sh` | Codex を非対話で呼ぶラッパー。認証チェックと終了コードを整理 |
| `.claude/agents/codex.md` | Claude が起動するサブエージェント。Codex を実行し diff を検証して報告する |
| `.claude/skills/codex/SKILL.md` | `/codex` として呼べるスキル。委譲の手順書 |
| `.claude/settings.json` | SessionStart フックの登録と、codex 系コマンドの許可 |

---

## 動かすのに必要なもの（2つ）

### 1. 認証

どちらか一方を用意します。

**A. 環境シークレット（Claude Code on the web 向け・推奨）**

Claude Code の環境設定で `OPENAI_API_KEY` を環境変数として登録します。
リモートセッションはコンテナが毎回作り直されるため、`codex login` の対話ログインは残りません。API キー方式が唯一の実用的な選択肢です。

**B. 対話ログイン（手元のマシン向け）**

```bash
codex login          # ChatGPT アカウントでログイン
codex login status   # 確認
```

認証情報は `~/.codex/` に保存されます。

### 2. ネットワーク許可

Codex は以下のホストへ HTTPS で通信します。

- `api.openai.com`
- `chatgpt.com`（ChatGPT アカウント認証を使う場合）

**Claude Code on the web ではこれが egress ポリシーで制限されている場合があります。**
実際、このセットアップを行ったセッションでは両ホストとも 403（ポリシー拒否）でした。

確認方法:

```bash
codex doctor                                   # reachability の行を見る
curl -sS "$HTTPS_PROXY/__agentproxy/status"    # 直近の拒否ホストが出る
```

`connect_rejected` に上記ホストが出る場合は、環境のネットワークポリシーを
「カスタム許可リスト」にして `api.openai.com` と `chatgpt.com` を追加してください
（環境設定は https://code.claude.com/docs/en/claude-code-on-the-web を参照）。
ローカルの Claude Code で使う場合はこの制限はありません。

---

## 使い方

### Claude に任せる

普通に頼めば `CLAUDE.md` のルールに従って Claude が判断します。明示するなら:

- 「この件は Codex にやらせて」
- 「Codex にセカンドオピニオンを取って」
- `/codex <やらせたいこと>`

### 手で叩く

```bash
# 調査・レビュー（読み取り専用）
.claude/scripts/codex-run.sh "store.html の購入導線を読んで、リンク切れや不整合を指摘して"

# 編集させる
.claude/scripts/codex-run.sh --write "about.html に OGP の og:image:alt を追加して"

# モデル指定
.claude/scripts/codex-run.sh --model gpt-5-codex "..."
```

終了コード:

| コード | 意味 |
|---|---|
| 0 | 正常終了。最終メッセージを標準出力に表示 |
| 2 | `codex` が未インストール → `npm install -g @openai/codex` |
| 3 | 認証情報なし → 上記「認証」を参照 |
| 4 | `api.openai.com` がネットワークポリシーで遮断 → 上記「ネットワーク許可」を参照 |
| 64 | 引数エラー |

コード 4 は再試行しても無意味（ポリシー拒否）なので、ラッパー側で即座に打ち切ります。
Codex 本体に任せると WebSocket と HTTPS の両方で計10回リトライして数分無駄になるため、
事前に `api.openai.com` へ疎通確認を1回だけ行っています。

---

## 設計上の決めごと

- **既定は読み取り専用。** ファイルを書き換える必要があるときだけ `--write` を付けます。
- **`--dangerously-bypass-approvals-and-sandbox` は使いません。** Codex 自身のサンドボックスを効かせたままにします。
- **Codex は commit も push もしません。** 変更はワーキングツリーに残し、Claude か人間がレビューしてからコミットします。
- **Codex の要約は「主張」であって証拠ではありません。** `--write` の後は必ず `git diff` を読んで突き合わせます。
- **ローカル環境では自動インストールしません。** `session-start.sh` は `CLAUDE_CODE_REMOTE=true` のときだけ動きます。手元のマシンの環境は手元で管理する前提です。
