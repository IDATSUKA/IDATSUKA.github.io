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
| `.claude/settings.json` | SessionStart フックの登録と、codex 系コマンド・site-check の許可 |
| `.agents/skills/site-check/` | 両エージェント共通のサイト検証スクリプト（`.claude/skills/site-check` はこれへのリンク） |
| `docs/HANDOFF.md` | セッションとエージェントをまたぐ引き継ぎログ |

---

## 動かすのに必要なもの（2つ）

どちらの設定も、claude.ai/code の**環境ダイアログ**で行います。開き方:

1. [claude.ai/code](https://claude.ai/code) を開く
2. メッセージ入力欄のすぐ上の行にある、現在の環境名が出ているクラウドアイコンをクリック
   （このセレクタ専用の設定ページも直接 URL もありません）
3. 環境名にマウスを乗せると右に出る歯車アイコンをクリック

### 1. 認証

**A. `OPENAI_API_KEY`（Claude Code on the web 向け・唯一の実用的な方法）**

環境ダイアログの **Environment variables** 欄に `.env` 形式で記述します。

```
OPENAI_API_KEY=sk-...
```

⚠️ **重要 — Codex は `OPENAI_API_KEY` を直接読みません。**
環境変数を置いただけでは `Missing bearer or basic authentication in header` で 401 になります。
キーは `codex login --with-api-key` によって `$CODEX_HOME/auth.json`（既定 `~/.codex/auth.json`）へ
書き込まれて初めて API に送信されます。この変換は `session-start.sh` と `codex-run.sh` が
自動で行うので手動操作は不要ですが、仕組みとして把握しておいてください。

⚠️ クラウド環境に専用のシークレットストアはありません。環境変数は**その環境を使える人が
平文で読めます**。共有環境（organization-shared environment）では組織のメンバー全員に見えます。

**B. 対話ログイン（手元のマシン向け）**

```bash
codex login          # ChatGPT アカウントでログイン
codex login status   # 確認
```

認証情報は `~/.codex/` に保存されます。リモートセッションはコンテナが毎回破棄されるため、
この方法はローカル専用です。

### 2. ネットワーク許可

Codex は `api.openai.com` へ HTTPS / WebSocket で通信します。
既定の **Trusted** 許可リストにこのホストは**含まれていません**。

環境ダイアログの **Network access** を **Custom** にし、**Allowed domains** に記述します。

```
api.openai.com
```

⚠️ **「Also include default list of common package managers」に必ずチェックを入れてください。**
外すと書いたドメインしか通らず、`registry.npmjs.org` が遮断されて
`session-start.sh` の `npm install -g @openai/codex` が失敗します。

確認方法:

```bash
codex doctor                                   # reachability の行を見る
curl -sS "$HTTPS_PROXY/__agentproxy/status"    # 直近の拒否ホストが出る
```

`connect_rejected` に `api.openai.com` が出る場合はまだ遮断されています。
ローカルの Claude Code で使う場合はこの制限自体がありません。

### 反映のタイミング

環境変数はセッション起動時に一度だけ読み込まれます。**実行中のセッションには反映されません** ——
設定を保存したら新しいセッションを開始してください。

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
| 5 | OpenAI アカウントに API クレジットが無い（課金切れ）。何も実行されていない → https://platform.openai.com/settings/organization/billing/ でクレジットを追加 |
| 64 | 引数エラー |

コード 4 と 5 は再試行しても無意味（ポリシー拒否 / 課金切れ）なので、ラッパー側で明示して打ち切ります。
Codex 本体に任せると WebSocket と HTTPS の両方で計10回リトライして数分無駄になるため、
事前に `api.openai.com` へ疎通確認を1回だけ行っています。

---

## 設計上の決めごと

- **既定は読み取り専用。** ファイルを書き換える必要があるときだけ `--write` を付けます。
- **`--dangerously-bypass-approvals-and-sandbox` は使いません。** Codex 自身のサンドボックスを効かせたままにします。
- **Codex は commit も push もしません。** 変更はワーキングツリーに残し、Claude か人間がレビューしてからコミットします。
- **Codex の要約は「主張」であって証拠ではありません。** `--write` の後は必ず `git diff` を読んで突き合わせます。
- **ローカル環境では自動インストールしません。** `session-start.sh` は `CLAUDE_CODE_REMOTE=true` のときだけ動きます。手元のマシンの環境は手元で管理する前提です。

---

## Codex と Claude の情報共有

「片方のエージェントが知っていることを、もう片方も知っている」状態を作るために、
共有される情報を **リポジトリの中のファイル** に集約しています。
どちらのエージェントのチャット履歴や内部メモリも、相手からは見えません。

| 層 | ファイル | 中身 | 誰が読むか |
|---|---|---|---|
| 規約 | `AGENTS.md` | リポジトリの説明・コーディング規約・検証方法 | Codex は自動で読む。Claude は `CLAUDE.md` の `@AGENTS.md` 経由で同じ内容を読む |
| 状態 | `docs/HANDOFF.md` | 何をやったか・何が残っているか・どのブランチにあるか | 両方。作業の最初に読み、最後に追記する（`AGENTS.md` で義務付け） |
| 手順 | `.agents/skills/<name>/SKILL.md` | 再利用する作業手順とスクリプト | Codex は `.agents/skills/` を、Claude は `.claude/skills/` を読む。後者は前者へのシンボリックリンク |

### 共有されないもの（と、共有したいときの方法）

- **Codex の memories**（`~/.codex/memories_*.sqlite`）や Claude の auto memory
  （`~/.claude/projects/.../memory/`）は、それぞれのマシン・アカウントに閉じています。
  次のセッションや相手のエージェントにも伝えたいことは `docs/HANDOFF.md` に書いてください。
- **チャットの会話内容**も同様です。Codex で決めたことを Claude に引き継ぐなら、
  その要点を `docs/HANDOFF.md` に貼るか、Claude に「HANDOFF.md に追記して」と頼めば残ります。
- 環境変数（`OPENAI_API_KEY` など）はリポジトリに書かない。各環境の設定で渡します。

### 新しいスキルを両方で使えるようにする

```bash
mkdir -p .agents/skills/<name>
$EDITOR .agents/skills/<name>/SKILL.md          # frontmatter に name / description
ln -s ../../.agents/skills/<name> .claude/skills/<name>
```

`.claude/skills/` 直下に置いた Claude 専用スキル（`codex` など）は Codex からは見えません。
Codex にも使わせたいものだけ `.agents/skills/` に置きます。

### ハマりどころ: エージェントから呼ぶと Codex が止まる

`codex exec` は stdin が端末でないと「Reading additional input from stdin...」と表示して
EOF まで待ちます。Claude Code の Bash ツールから呼ぶと stdin は常にパイプなので、
プロンプトを引数で渡していても永久に止まります。`codex-run.sh` は `</dev/null` を付けて
これを回避済みです。ラッパーを通さず直接叩くときも同じ対策が必要です。
