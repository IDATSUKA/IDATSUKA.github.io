import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// Higgsfield 完了/失敗コールバック
//   - completed → confirm_credits（予約を確定）
//   - failed    → refund_credits（残高を戻す）
//   - 同じ通知が複数回来ても、RPC側のstatusガードで1回しか効かない（冪等）。
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  // 署名検証: HiggsfieldがWebhook secretを提供する場合はここで検証する。
  // （ヘッダ名/署名方式は実際のダッシュボード設定に合わせて実装）
  // const signature = req.headers.get("x-higgsfield-signature");
  // if (!verify(rawBody, signature, process.env.HIGGSFIELD_WEBHOOK_SECRET)) {
  //   return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 401 });
  // }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "BAD_PAYLOAD" }, { status: 400 });
  }

  // フィールド名は実際のペイロードに合わせて調整。
  const requestId: string | undefined =
    payload.request_id ?? payload.id ?? payload.requestId;
  const status: string | undefined = payload.status; // completed / failed など

  if (!requestId || !status) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createServiceClient();
  const terminal = status.toLowerCase();

  // 完了時の画像URL（フィールド名は実ペイロードに合わせて調整）。
  const resultUrl: string | undefined =
    payload.results?.[0]?.raw?.url ??
    payload.output?.url ??
    payload.output ??
    payload.result_url;

  try {
    if (terminal === "completed") {
      await admin.rpc("confirm_credits", { p_ref_id: requestId });
      // 生成結果をUI用テーブルへ保存 → Realtimeで即表示される。
      await admin
        .from("generations")
        .update({
          status: "completed",
          result_url: resultUrl ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("ref_id", requestId);
    } else if (terminal === "failed") {
      await admin.rpc("refund_credits", { p_ref_id: requestId });
      await admin
        .from("generations")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("ref_id", requestId);
    }
    // queued/processing 等の中間通知は無視（何もしない）。

    // Higgsfieldは数秒以内の 200 を期待する。重い処理はここでしない。
    return NextResponse.json({ ok: true });
  } catch (e) {
    // 5xxを返すとHiggsfieldがリトライしてくれる → 取りこぼし防止。
    // 冪等なので再送されても二重処理にならない。
    return NextResponse.json(
      { error: "PROCESSING_FAILED", detail: String(e) },
      { status: 500 }
    );
  }
}
