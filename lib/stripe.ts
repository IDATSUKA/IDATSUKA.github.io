import Stripe from "stripe";

// サーバー専用。STRIPE_SECRET_KEY は絶対にクライアントへ出さない。
// 遅延初期化: ビルド時に環境変数が無くてもモジュールロードで落ちない。
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-08-27.basil",
    });
  }
  return _stripe;
}
// 後方互換エクスポート（既存コードがそのまま動く）
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});
