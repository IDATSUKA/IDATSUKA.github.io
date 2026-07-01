import Link from "next/link";

// app.idatsuka.com/billing/success
// 注意: クレジット付与は Stripe Webhook 側で確定する。ここは表示のみ。
export default function BillingSuccessPage() {
  return (
    <div
      style={{
        background: "#0A0A0F",
        color: "#ECEAF4",
        fontFamily: "'Space Grotesk','Zen Kaku Gothic New',system-ui,sans-serif",
      }}
      className="flex min-h-screen items-center justify-center px-6"
    >
      <div className="w-full max-w-md text-center">
        <div
          style={{
            color: "#5BD6A0",
            fontFamily: "'JetBrains Mono',ui-monospace,monospace",
          }}
          className="text-[11px] uppercase tracking-[0.3em]"
        >
          &gt; payment · received
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          購入ありがとうございます
        </h1>
        <p style={{ color: "#7C7A90" }} className="mt-3 text-sm leading-relaxed">
          決済が完了しました。クレジットは数秒以内に残高へ反映されます。
          反映されない場合は少し待ってから残高を確認してください。
        </p>
        <Link
          href="/generate"
          className="mt-8 inline-block rounded-md px-6 py-2.5 text-sm font-semibold"
          style={{ background: "#E8433F", color: "#fff" }}
        >
          生成スタジオへ戻る
        </Link>
      </div>
    </div>
  );
}
