// ----------------------------------------------------------------
// クレジットパック定義（サーバー専用の真実の値）
//   金額・付与クレジット数はここでのみ決める。
//   クライアントからは packId だけ受け取り、値は一切信用しない。
//   price_id は Stripe ダッシュボードで作った Price の ID を入れる。
// ----------------------------------------------------------------
export type CreditPack = {
  id: string;
  name: string;
  credits: number;    // 付与するクレジット数
  priceId: string;    // Stripe Price ID (price_xxx)
};

export const CREDIT_PACKS: Record<string, CreditPack> = {
  starter: {
    id: "starter",
    name: "Starter",
    credits: 100,
    priceId: process.env.STRIPE_PRICE_STARTER!,
  },
  standard: {
    id: "standard",
    name: "Standard",
    credits: 550,   // 例: ボーナス込み（100→550で割安感を出す）
    priceId: process.env.STRIPE_PRICE_STANDARD!,
  },
  pro: {
    id: "pro",
    name: "Pro",
    credits: 1200,
    priceId: process.env.STRIPE_PRICE_PRO!,
  },
};

export function getPack(packId: string): CreditPack | null {
  return CREDIT_PACKS[packId] ?? null;
}
