# CLAUDE.md — IDATSUKA 生成プラットフォーム 引き継ぎ

このファイルは Claude Code のセッションをまたぐ継続メモ。作業開始時にまず読むこと。

## プロジェクト概要

IDATSUKA ブランドの AI 画像生成プラットフォーム（他ユーザー向けの有料プロダクト）。
Higgsfield API で画像生成し、クレジット制で課金する。

- スタック: Next.js (App Router) + TypeScript + Tailwind CSS + Supabase + Vercel
- 生成: Higgsfield API（**非同期**。ジョブ投入→Webhookで完了通知）
- 決済: Stripe（クレジットパックの都度購入）
- ドメイン構成: `IDATSUKA.com`=既存ブランドサイト（維持） / `app.IDATSUKA.com`=このアプリ

## 現在の状態（フェーズ0 = 課金開始に必要な最小構成）

コードは一通り揃っている。「サインイン → クレジット購入 → 生成」の一周が実装済み。

- [x] 認証: Supabase Auth（Google + メールリンク）、middlewareでルートガード
- [x] クレジット基盤: reserve/confirm/refund/grant のアトミック&冪等RPC
- [x] 生成: /api/generate（予約→投入）、Higgsfield Webhook（confirm/refund）
- [x] 生成UI: Realtimeで完了を即反映
- [x] 決済: Stripe Checkout + 冪等Webhook（event.idキー）
- [x] 課金UI: パック選択→checkout→success/cancel
- [ ] 本番デプロイ & 各サービス設定（← いまここ）
- [ ] 現物合わせTODO（下記）

## アーキテクチャの要点（壊さないこと）

- **クレジットは生成の「前」に予約（reserve）する。** 失敗したら返金。残高がマイナスに
  ならないよう、RPC内で条件付きUPDATE（`balance >= cost`）を使っている。
- **すべての付与/確定/返金は冪等。** Higgsfield も Stripe もWebhookを重複送信しうる。
  冪等キー: 生成=request_id、購入=Stripe event_id。この設計を絶対に崩さない。
- **金額はサーバーが真実。** クライアントは packId しか送らない（lib/credit-packs.ts）。
- **APIキーはサーバー専用。** Higgsfield/Stripe/Supabase service-role キーを
  クライアントへ絶対に露出させない。

## 次にやること（優先順）

1. `npm install` → `npm run build` が通ることを確認。型エラーがあれば潰す。
2. **現物合わせ（要 実API）**:
   - `lib/higgsfield.ts`: 実際のエンドポイント名/パラメータ/認証ヘッダを公式ドキュメントで確認
   - `app/api/webhooks/higgsfield/route.ts`: Webhookペイロードの実フィールド名
     (request_id / status / 結果URLの場所) と署名検証を実物に合わせる
   - `CREDIT_COST_PER_IMAGE`: Higgsfieldの実原価を確認し「原価 < 販売単価」を担保
3. Supabase migration 適用（0001→0002→0003 の順）。Realtimeで generations を有効化。
4. Stripe: 商品/Price 3つ作成、Webhook登録、`stripe listen` でローカル決済テスト。
5. デプロイ: Vercelにpush、環境変数登録、app.idatsuka.com をドメイン追加。

## 重要: 人間（オーナー）がやる操作

以下は Claude Code ではなくオーナー自身が各サービスの画面で行う。Claude Codeは
「ここでキーを入れてください」と促すだけで、キーの入力・ログイン・デプロイはしない。

- 各サービスへのログイン、APIキー/シークレットの取得と入力
- 本番デプロイの実行、独自ドメインの追加、DNSレコードの登録
- Google OAuthクライアント作成、Stripe本番キーの登録

## 環境変数（.env.local）

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
HIGGSFIELD_CREDENTIALS=KEY_ID:KEY_SECRET
APP_URL=https://app.idatsuka.com
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_STANDARD=
STRIPE_PRICE_PRO=
```

## 作業ログ（Claude Codeはここに追記していく）

- (初期) フェーズ0のコード一式を生成。デプロイ前の状態。
