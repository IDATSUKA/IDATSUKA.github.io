import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { getPack } from "@/lib/credit-packs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // --- 認証 ------------------------------------------------------
  const token = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    ""
  );
  if (!token) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const {
    data: { user },
    error,
  } = await createUserClient(token).auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // --- どのパックか（値はサーバーで確定。クライアントの金額は無視）---
  const body = await req.json().catch(() => null);
  const pack = getPack(body?.packId?.toString() ?? "");
  if (!pack) {
    return NextResponse.json({ error: "INVALID_PACK" }, { status: 400 });
  }

  // --- Checkout セッション作成 -----------------------------------
  const session = await stripe.checkout.sessions.create({
    mode: "payment", // サブスクではなく都度購入（クレジットパック）
    line_items: [{ price: pack.priceId, quantity: 1 }],
    // 誰の購入かを紐づける。Webhookでこれを読んで付与先を決める。
    client_reference_id: user.id,
    // 付与に必要な情報をセッションに埋め込む（金額改ざんの影響を受けない）。
    metadata: {
      user_id: user.id,
      credits: String(pack.credits),
      pack_id: pack.id,
    },
    success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/billing/cancel`,
  });

  return NextResponse.json({ url: session.url });
}
