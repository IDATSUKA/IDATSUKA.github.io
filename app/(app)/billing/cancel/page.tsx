import Link from "next/link";

// app.idatsuka.com/billing/cancel
export default function BillingCancelPage() {
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
            color: "#7C7A90",
            fontFamily: "'JetBrains Mono',ui-monospace,monospace",
          }}
          className="text-[11px] uppercase tracking-[0.3em]"
        >
          &gt; payment · cancelled
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          購入はキャンセルされました
        </h1>
        <p style={{ color: "#7C7A90" }} className="mt-3 text-sm leading-relaxed">
          料金は発生していません。いつでも購入を再開できます。
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/billing"
            className="rounded-md px-6 py-2.5 text-sm font-semibold"
            style={{ background: "#E8433F", color: "#fff" }}
          >
            料金プランへ戻る
          </Link>
          <Link
            href="/generate"
            className="rounded-md px-6 py-2.5 text-sm font-semibold"
            style={{ border: "1px solid #2A2A3C", color: "#ECEAF4" }}
          >
            スタジオへ
          </Link>
        </div>
      </div>
    </div>
  );
}
