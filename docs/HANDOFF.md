# HANDOFF.md — エージェント間の引き継ぎログ

Codex と Claude Code（と人間）が同じ状況認識で作業するための共有メモ。
**作業を始めるときは最初にこのファイルを読み、終わるときは末尾に追記する。**
チャットの返答に書いただけの情報は次のセッションには残らない。ここに書いたものだけが残る。

書き方（新しいものを下に追加）:

```
## YYYY-MM-DD — <Codex | Claude> — <一言>
- やったこと:
- 未完了 / 次にやること:
- ブランチ: <main 以外にあるなら名前>
```

APIキーやパスワードは絶対に書かない。

---

## 現在地（最新の状態を常にここに上書きする）

- **公開中 (`main`)**: ダークミニマルのデザインシステム v2（2026-09-04 再設計）、
  SVG ワードマークロゴ、Play / Business の2系統ランディング、ゲーム3本 + ピンボール、
  Store（決済リンク未設定のためデモモード）。
- **ナビ**: Profile / Play / Business / Store / Blog / Contact の6項目、全ページ共通。
- **未マージのブランチ**（`main` に入っていない作業。取り込むかどうかは人間が判断）:
  - `claude/revenue-1m-project-g8a3xv` — 架空の実績表示の削除、商品化した料金体系、
    見積もりシミュレーター (`estimate.html`)、案件ダッシュボード (`dashboard.html`)、
    無料ツール（請求書 `tools/invoice.html`・見積書 `tools/quote.html`・共通計算 `js/billing.js`）、
    `REVENUE_PLAN.md` / `SALES_KIT.md`、`robots.txt` / `sitemap.xml`。
    再設計 v2 より前の `main` から分岐しているため、取り込む際は `style.css` の衝突解消が必要。
  - `app` — 別プロダクト。Next.js + Supabase + Stripe のクレジット制 AI 画像生成アプリ
    （`app.idatsuka.com` 想定、Vercel デプロイ）。静的サイトとは完全に別物で、このブランチには
    サイトのファイルが無い。引き継ぎメモはそのブランチの `CLAUDE.md` と `HANDOFF.md`。
  - `claude/cloud-video-editing-control-nrt5wg` — `adobe-mcp/`（Premiere Pro を MCP で操作）。
  - `claude/comfyui-minimax-h3-setup-edrftc` — `comfyui-minimax-h3/`（ComfyUI 動画生成の環境構築）。
  - `claude/pinball-game-app-1le3ke` — ピンボールのアプリ化作業。
- **共有の仕組み**: `AGENTS.md`（規約、両エージェントが読む）/ このファイル（状態）/
  `.agents/skills/`（手順。`.claude/skills/` からシンボリックリンク）。詳細は `docs/CODEX.md`。

---

## 2026-09-04 — Claude — Codex 連携を main に載せ、情報共有の土台を作った
- やったこと:
  - `claude/codex-task-setup-3nmxdd` に取り残されていた Codex 連携一式
    （`.claude/` のフック・ラッパー・サブエージェント・スキル、`docs/CODEX.md`）を現在の `main` に取り込んだ。
  - ラッパー `.claude/scripts/codex-run.sh` の不具合を修正。エージェントから呼ぶと stdin が端末でないため
    Codex が「Reading additional input from stdin...」で永久に待ってしまい、委譲が一度も動いていなかった。
    stdin を閉じて渡すようにした。
  - `AGENTS.md` を再設計 v2 後の実態に更新（ナビ6項目、追加された CSS トークン、og:image は index のみ）。
    `CLAUDE.md` は `@AGENTS.md` で同じ内容を取り込む形にし、規約の二重管理をやめた。
  - 共有スキル `site-check` を追加（`.agents/skills/site-check/check.mjs`、依存なし）。
    head ブロック・ナビ一致・リンク切れの静的チェックと、`--browser` で 5 画面幅の
    コンソールエラー / 横スクロール検査。Codex・Claude どちらからも同じコマンドで使える。
  - `site-check --browser` が全ページで 390px 幅の横スクロール（+6px）を検出。原因はフッターの
    `.footer-links` が折り返さないことだったので `flex-wrap: wrap` と狭い画面での gap 調整で修正。
    修正後は 27 ページ × 5 幅すべて OK。
- 未完了 / 次にやること:
  - **Codex 委譲は最後の一歩で止まっている。** インストール・認証・ネットワークは通り、
    リクエストは OpenAI に届くが、`OPENAI_API_KEY` のアカウントに API クレジットが無く
    「You have no credits remaining」で拒否される。ラッパーは終了コード 5 で明示する。
    人間が https://platform.openai.com/settings/organization/billing/ でクレジットを追加し、
    新しいセッションを開けばそのまま動く（コード側の変更は不要）。
  - `og:image` / `twitter:card` は `index.html` にしかない（任意。付けるなら全ページ一括で）。
  - 未マージブランチ（上記「現在地」）の扱いを決める。特に revenue ブランチはツール類が実用段階。
- ブランチ: `claude/codex-feature-parity-1ygeff`
