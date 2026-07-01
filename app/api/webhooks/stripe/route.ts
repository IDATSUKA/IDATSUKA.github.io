import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// ⚠️ 重要: Stripe署名検証には「生のボディ」が必要。
// Next.js が自動でJSONパースすると署名が壊れるので、req.text() で生取得する。
// （App Routerでは route.ts 内で req.text() すれば生body。追加設定は基本不要。）

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "NO_SIGNATURE" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // 本物のStripeからの通知だけを通す。ここが検証の要。
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (e) {
    return NextResponse.json(
      { error: "BAD_SIGNATURE", detail: String(e) },
      { status: 400 }
    );
  }

  // --- 支払い完了イベントだけ処理 --------------------------------
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // 未払いのまま完了イベントが来るケースを弾く（念のため）。
    if (session.payment_status !== "paid") {
      return NextResponse.json({ ok: true, skipped: "not_paid" });
    }

    const userId = session.metadata?.user_id ?? session.client_reference_id;
    const credits = Number(session.metadata?.credits ?? 0);

    if (!userId || !credits) {
      // 付与先/数量が読めない → ログして200（無限リトライは避ける）。
      console.error("stripe webhook: missing user_id/credits", session.id);
      return NextResponse.json({ ok: true, skipped: "missing_metadata" });
    }

    const admin = createServiceClient();

    // 冪等キーに event.id を使う。Stripeはリトライで同じeventを再送するが、
    // grant_credits 側の (kind, ref_id) 一意制約で二重付与されない。
    const { error } = await admin.rpc("grant_credits", {
      p_user_id: userId,
      p_amount: credits,
      p_ref_id: event.id,
    });

    if (error) {
      // 5xxを返すとStripeが自動リトライ → 一時障害でも取りこぼさない。
      // 冪等なので再送されても安全。
      return NextResponse.json(
        { error: "GRANT_FAILED", detail: error.message },
        { status: 500 }
      );
    }
  }

  // 受領確認。Stripeは数秒以内の 2xx を期待する。
  return NextResponse.json({ received: true });
}
