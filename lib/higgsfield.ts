// ----------------------------------------------------------------
// Higgsfield 呼び出しラッパー（サーバー専用）
//   - APIキーはここ(サーバー)だけで使う。クライアントには絶対渡さない。
//   - 非同期ジョブとして投入し、完了はWebhookで受け取る設計。
//   - モデル名/エンドポイント/パラメータは実際のプランに合わせて調整すること。
// ----------------------------------------------------------------

// 1生成あたりのクレジット単価（原価にマージンを乗せた「販売価格」）。
// ここは必ず「Higgsfield原価 < この値」になるように設定する = 赤字防止。
export const CREDIT_COST_PER_IMAGE = 10;

type SubmitResult = { requestId: string };

export async function submitImageJob(params: {
  prompt: string;
  refId: string;      // 予約と紐づく内部ID（冪等キー兼用）
  webhookUrl: string; // 完了通知を受け取る自前エンドポイント
}): Promise<SubmitResult> {
  const credentials = process.env.HIGGSFIELD_CREDENTIALS!; // "KEY_ID:KEY_SECRET"

  const res = await fetch("https://platform.higgsfield.ai/v1/text2image/soul", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${credentials}`,
      // Webhookで完了を受け取る（ポーリング不要）。
      "X-Webhook-URL": params.webhookUrl,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      // 自前のrefIdをHiggsfield側の冪等キーとして渡せる場合は渡す。
      // 対応が無ければ、レスポンスの request_id を保存して突き合わせる。
      request_id: params.refId,
      width_and_height: "1536x2048",
      quality: "1080p",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HIGGSFIELD_SUBMIT_FAILED ${res.status} ${detail}`);
  }

  const data = (await res.json()) as { request_id?: string; id?: string };
  const requestId = data.request_id ?? data.id;
  if (!requestId) throw new Error("HIGGSFIELD_NO_REQUEST_ID");
  return { requestId };
}
