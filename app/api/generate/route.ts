import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createUserClient, createServiceClient } from "@/lib/supabase";
import {
  submitImageJob,
  CREDIT_COST_PER_IMAGE,
} from "@/lib/higgsfield";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // --- 1) 認証 ---------------------------------------------------
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userClient = createUserClient(token);
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // --- 2) 入力 ---------------------------------------------------
  const body = await req.json().catch(() => null);
  const prompt = body?.prompt?.toString().trim();
  if (!prompt) {
    return NextResponse.json({ error: "PROMPT_REQUIRED" }, { status: 400 });
  }

  // 予約とジョブを結ぶ内部ID。冪等キーとして最後まで使い回す。
  const refId = randomUUID();

  // service-roleでRPCを叩く（RLSを貫通してアトミック処理）。
  const admin = createServiceClient();

  // --- 3) クレジット予約（生成の「前」に必ず引く）---------------
  const { data: newBalance, error: reserveErr } = await admin.rpc(
    "reserve_credits",
    {
      p_user_id: user.id,
      p_amount: CREDIT_COST_PER_IMAGE,
      p_ref_id: refId,
    }
  );

  if (reserveErr) {
    // RPC内で INSUFFICIENT_CREDITS を raise した場合ここに来る
    const insufficient = reserveErr.message?.includes("INSUFFICIENT_CREDITS");
    return NextResponse.json(
      { error: insufficient ? "INSUFFICIENT_CREDITS" : "RESERVE_FAILED" },
      { status: insufficient ? 402 : 500 }
    );
  }

  // 予約成功 → UIに出すための generations 行(queued)を作る。
  await admin.from("generations").insert({
    user_id: user.id,
    ref_id: refId,
    prompt,
    status: "queued",
  });

  // --- 4) ジョブ投入。失敗したら予約を即返金（残高を溶かさない）---
  const webhookUrl = `${process.env.APP_URL}/api/webhooks/higgsfield`;
  try {
    const { requestId } = await submitImageJob({ prompt, refId, webhookUrl });

    // Higgsfield側の request_id を予約行と生成行に控えておく
    // （Webhookが request_id で飛んでくる場合の突き合わせ用）。
    await admin
      .from("credit_transactions")
      .update({ ref_id: requestId })
      .eq("kind", "reserve")
      .eq("ref_id", refId);
    await admin
      .from("generations")
      .update({ ref_id: requestId, status: "processing" })
      .eq("ref_id", refId);

    return NextResponse.json({
      status: "queued",
      requestId,
      balance: newBalance,
    });
  } catch (e) {
    // 投入自体に失敗 → 予約を返金し、生成行も failed に
    await admin.rpc("refund_credits", { p_ref_id: refId });
    await admin
      .from("generations")
      .update({ status: "failed" })
      .eq("ref_id", refId);
    return NextResponse.json(
      { error: "SUBMIT_FAILED", detail: String(e) },
      { status: 502 }
    );
  }
}
