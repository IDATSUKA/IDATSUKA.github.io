# IDATSUKA クレジット基盤（フェーズ0）

非同期生成（Higgsfield）に対応した**予約 → 確定/返金**モデルのクレジットシステム。
「APIには課金されたのにユーザーには課金できてない」赤字事故を構造的に防ぐのが目的。

## 全体の流れ

```
生成リクエスト
  └─ reserve_credits  … 残高から先に引く（reserved）
       └─ Higgsfieldへジョブ投入（非同期）
            ├─ 投入失敗           → refund_credits（即返金）
            └─ Webhook で完了通知
                 ├─ completed → confirm_credits（確定）
                 └─ failed    → refund_credits（返金）
  └─ 取りこぼし保険: expire_stale_reservations を cron で定期実行
```

すべてのRPCは**アトミック**かつ**冪等**。Webhookが二重に届いても、Stripeが二重通知しても、
残高の付与・確定・返金は一度しか走らない。

## ファイル

| パス | 役割 |
|---|---|
| `supabase/migrations/0001_credit_system.sql` | テーブル2つ＋RPC5本。DBの心臓部 |
| `lib/supabase.ts` | service-role / user の2種クライアント |
| `lib/higgsfield.ts` | Higgsfield投入ラッパー（キーはサーバー専用）＋単価定義 |
| `app/api/generate/route.ts` | 生成の口。認証→予約→投入→失敗なら返金 |
| `app/api/webhooks/higgsfield/route.ts` | 完了/失敗の冪等ハンドラ |
| `lib/credit-packs.ts` | 購入パック定義（金額・クレジット数はサーバー側で固定） |
| `lib/stripe.ts` | Stripeクライアント（サーバー専用） |
| `app/api/checkout/route.ts` | Checkoutセッション作成。user_idと付与数をmetadataに埋め込む |
| `app/api/webhooks/stripe/route.ts` | 署名検証→冪等付与（event.idを冪等キーに） |
| `supabase/migrations/0002_generations.sql` | 生成の状態/結果テーブル＋Realtime有効化 |
| `lib/supabase-browser.ts` | ブラウザ用クライアント（セッション/Realtime） |
| `components/GenerateStudio.tsx` | 生成UI本体。入力・残高・フレームのライブ更新 |
| `app/(app)/generate/page.tsx` | /generate ページ |
| `middleware.ts` | セッション更新＋保護ルートのガード（未ログイン→/login） |
| `lib/supabase-server.ts` | SSR文脈でCookieからセッションを読むクライアント |
| `components/LoginView.tsx` | ログイン画面（Google＋メールのマジックリンク） |
| `app/login/page.tsx` | /login ページ |
| `app/auth/callback/route.ts` | OAuth/リンクの戻り先。codeをセッションに交換 |
| `supabase/migrations/0003_new_user_credits.sql` | 新規登録時にcredits行を自動作成＋お試し付与 |
| `components/BillingView.tsx` | 課金UI。パック選択→/api/checkout→Stripe遷移 |
| `app/(app)/billing/page.tsx` | /billing 料金ページ |
| `app/(app)/billing/success/page.tsx` | 決済完了画面（付与はWebhook側で確定） |
| `app/(app)/billing/cancel/page.tsx` | 決済キャンセル画面 |

## RPC 早見

- `reserve_credits(user, amount, ref_id)` → 残高を条件付きで引き予約作成。足りなければ `INSUFFICIENT_CREDITS`
- `confirm_credits(ref_id)` → reserved を confirmed へ（残高は触らない）
- `refund_credits(ref_id)` → reserved のときだけ残高を戻し refunded へ
- `grant_credits(user, amount, ref_id)` → 購入付与。ref_id に **Stripe event_id** を渡して二重付与防止
- `expire_stale_reservations(interval)` → 放置予約を一括返金。返金件数を返す

## 必要な環境変数

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # サーバー専用。絶対に公開しない
HIGGSFIELD_CREDENTIALS=KEY_ID:KEY_SECRET
APP_URL=https://app.idatsuka.com  # Webhook / success URL 組み立て用

# Stripe
STRIPE_SECRET_KEY=sk_...           # サーバー専用
STRIPE_WEBHOOK_SECRET=whsec_...    # `stripe listen` or ダッシュボードで取得
STRIPE_PRICE_STARTER=price_...     # ダッシュボードで作った各Priceの ID
STRIPE_PRICE_STANDARD=price_...
STRIPE_PRICE_PRO=price_...
```

## セットアップ

1. `supabase db push`（または Supabase SQL エディタに migration を貼る）でスキーマ適用
2. `npm i @supabase/supabase-js`
3. 上記の環境変数を Vercel のプロジェクト設定に登録
4. Higgsfield ダッシュボードで Webhook URL を `https://app.idatsuka.com/api/webhooks/higgsfield` に設定（署名secretがあれば取得して検証を有効化）
5. cron（Vercel Cron 等）で `expire_stale_reservations` を5〜10分おきに叩くジョブを1本

## 実装前に現物合わせが要る箇所（TODO）

- **Higgsfield のエンドポイント名・パラメータ・レスポンス形**：`lib/higgsfield.ts` は
  公開ドキュメントベースの推定。実際のプラン/SDKに合わせて要確認。
- **Webhookのペイロード形と署名方式**：`route.ts` のフィールド名（request_id/status）と
  署名検証を実物に合わせる。
- **単価 `CREDIT_COST_PER_IMAGE`**：Higgsfield の実原価を確認し「原価 < 販売単価」を必ず担保。
- **`request_id` を冪等キーにできるか**：Higgsfield側がリクエスト時のrequest_id指定を
  受け付けるなら予約refと一致させる。不可なら submit時に返る request_id を控えて突き合わせ
  （generate/route.ts は後者にも対応済み）。

## Stripe セットアップ

1. `npm i stripe`
2. ダッシュボードで **商品＋Price を3つ**作成（Starter / Standard / Pro、通貨=JPY、one-time）
   → それぞれの `price_...` を環境変数に登録
3. Webhook エンドポイントを登録: `https://app.idatsuka.com/api/webhooks/stripe`
   - 購読イベントは `checkout.session.completed` のみでOK
   - 表示される **Signing secret (`whsec_...`)** を `STRIPE_WEBHOOK_SECRET` に登録
4. ローカルテスト:
   ```
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   # 別ターミナルで購入フローを実行 → 付与されるか確認
   stripe trigger checkout.session.completed   # 単発テストも可
   ```

## 決済フローの安全設計（外すと事故る3点）

1. **付与は必ずWebhookで**：`success_url` へのリダイレクト完了は改ざん可能なので付与判定に使わない。
   成功画面はあくまで「ありがとう」表示だけ。
2. **署名検証**：`constructEvent` で本物のStripeからの通知だけ通す。
3. **raw body**：`req.text()` で生ボディを取得して検証。JSONパースすると署名が壊れる。

金額とクレジット数は `lib/credit-packs.ts` にサーバー固定。クライアントは packId しか送れないので、
価格改ざんは原理的に不可能。

## 生成UI（実装済み）

`components/GenerateStudio.tsx` が本体。動作：

1. Supabaseセッションからトークン取得 → `/api/generate` に Bearer で投げる
2. `generations` テーブルを **Realtime購読**（`user_id` でフィルタ）
3. Webhookが completed を書き込むと、画面のフレームが即 result_url に差し替わる
4. 残高は `credits` を RLS越しにselect（本人分のみ）

必要な追加パッケージ:
```
npm i @supabase/ssr @supabase/supabase-js
```

Realtimeの前提（重要）:
- migration 0002 の `alter publication supabase_realtime add table generations;` が効いていること
- Supabaseダッシュボード → Database → Replication で `generations` がRealtime対象になっていること
- RLSの select ポリシーがRealtimeにも適用される（本人の行だけ流れてくる）

フォント: `Space Grotesk`(display) / `JetBrains Mono`(status) を想定。
未読み込みでも system フォントにフォールバックするが、`app/layout.tsx` の
`next/font` で読み込むと意図した見た目になる。

デザイン意図: 墨(near-black)地に朱(#E8433F)を唯一のアクセント。状態表示は
「Rewrite Code」に寄せたコンパイラログ風(mono)。汎用AIツールに見せない差別化。

## 認証（実装済み）

構成: Supabase Auth（Google OAuth ＋ メールのマジックリンク）。パスワードは持たない。

動作:
- `middleware.ts` が全リクエストでセッションを更新し、`/generate` `/billing` を
  未ログインなら `/login?next=...` へリダイレクト。ログイン済みで `/login` に来たら
  `/generate` へ。
- `/login` → Google もしくはメールリンク → `/auth/callback` が code をセッションに
  交換してCookie保存 → `next` へ戻す。
- 新規ユーザーは migration 0003 のトリガーで `credits` 行が自動作成され、
  お試し30クレジット（3生成ぶん）が付く。

Supabaseダッシュボード側の設定（画面操作）:
1. Authentication → Providers → **Google を有効化**
   - Google Cloud で OAuth クライアントを作成し、client_id / secret を登録
   - 承認済みリダイレクトURIに Supabase の callback URL を登録
2. Authentication → URL Configuration
   - Site URL: `https://app.idatsuka.com`
   - Redirect URLs に `https://app.idatsuka.com/auth/callback` を追加
   - ローカル用に `http://localhost:3000/auth/callback` も追加
3. Email（マジックリンク）はデフォルト有効。送信元ドメインは後でカスタムSMTPに。

これで「未ログインは入れない → サインイン → 生成/購入」の導線が繋がる。

## 課金UI（実装済み）

`components/BillingView.tsx` が本体。パック3種を表示し、選択すると
`/api/checkout` を叩いてStripe CheckoutのURLへ遷移。決済後は
`/billing/success`（付与はWebhookで確定・表示のみ）か `/billing/cancel` に戻る。
表示価格は見せ札で、実際の課金額は `lib/credit-packs.ts` がサーバー側の真実。

## フェーズ0 の状態

「サインイン → クレジット購入 → 生成」の一周がコードとして揃った。

- 認証（ログイン＋ガード）… ✅
- 生成UI ＋ Realtime反映 … ✅
- クレジット消費・返金（アトミック/冪等）… ✅
- 決済（Stripe）＋ 冪等付与 … ✅
- 課金UI … ✅

残るのは主に**各サービスの管理画面設定と本番デプロイ**（Supabase/Stripe/Vercel）。
コード側の残タスクは下記。

## この後の接続先（別タスク）

- 生成結果の永続保存: 現状 result_url は Higgsfield のURL。期限があるため
  （ドキュメント上は結果が一定時間で失効）、completed時に自前のSupabase Storageへ
  コピーして差し替えると安全。
- ログアウト導線、残高が尽きたときに /billing へ誘導するUX
- Higgsfieldの実エンドポイント名/パラメータ/Webメペイロード形の現物合わせ（各TODO参照）
