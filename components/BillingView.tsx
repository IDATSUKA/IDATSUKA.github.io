"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";

// ----------------------------------------------------------------
// 課金UI（クレジットパック購入）
//   - パックを選ぶ → /api/checkout → 返ってきたStripeのURLへ遷移
//   - 表示価格は「見せ札」。実際の課金額はサーバーのcredit-packsが真実。
//   - packId 以外はサーバーに送らない（金額を信用させない）。
// ----------------------------------------------------------------

const C = {
  bg: "#0A0A0F",
  surface: "#14141C",
  surface2: "#1C1C28",
  border: "#2A2A3C",
  ink: "#ECEAF4",
  muted: "#7C7A90",
  accent: "#E8433F",
  accentHover: "#FF5A54",
};
const FONT_DISPLAY =
  "'Space Grotesk','Zen Kaku Gothic New',system-ui,sans-serif";
const FONT_MONO = "'JetBrains Mono','SFMono-Regular',ui-monospace,monospace";

// 表示用のみ（サーバーの credit-packs.ts と id を揃える）。
const PACKS = [
  {
    id: "starter",
    name: "Starter",
    credits: 100,
    price: "¥1,000",
    per: "約10生成",
    featured: false,
  },
  {
    id: "standard",
    name: "Standard",
    credits: 550,
    price: "¥5,000",
    per: "約55生成",
    featured: true,
    note: "+10% ボーナス",
  },
  {
    id: "pro",
    name: "Pro",
    credits: 1200,
    price: "¥10,000",
    per: "約120生成",
    featured: false,
    note: "+20% ボーナス",
  },
];

export default function BillingView() {
  const supabase = getBrowserClient();
  const [token, setToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token ?? null;
      setToken(t);
      const uid = data.session?.user.id;
      if (uid) {
        const { data: credit } = await supabase
          .from("credits")
          .select("balance")
          .eq("user_id", uid)
          .single();
        setBalance(credit?.balance ?? 0);
      }
    })();
  }, [supabase]);

  const buy = async (packId: string) => {
    if (!token || loadingId) return;
    setLoadingId(packId);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError("決済ページを開けませんでした。少し待って再試行してください。");
        setLoadingId(null);
        return;
      }
      // Stripe Checkout へ遷移
      window.location.href = data.url;
    } catch {
      setError("ネットワークエラー。接続を確認してください。");
      setLoadingId(null);
    }
  };

  return (
    <div
      style={{ background: C.bg, color: C.ink, fontFamily: FONT_DISPLAY }}
      className="min-h-screen w-full"
    >
      <div className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-10 flex items-end justify-between border-b pb-6"
          style={{ borderColor: C.border }}>
          <div>
            <div
              style={{ color: C.accent, fontFamily: FONT_MONO }}
              className="text-[11px] uppercase tracking-[0.3em]"
            >
              IDATSUKA / rewrite
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              クレジットを購入
            </h1>
          </div>
          <div className="text-right">
            <div
              style={{ color: C.muted, fontFamily: FONT_MONO }}
              className="text-[10px] uppercase tracking-[0.2em]"
            >
              現在の残高
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {balance === null ? "—" : balance.toLocaleString()}
            </div>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {PACKS.map((p) => (
            <div
              key={p.id}
              className="relative flex flex-col rounded-xl p-6"
              style={{
                background: C.surface,
                border: p.featured
                  ? `2px solid ${C.accent}`
                  : `1px solid ${C.border}`,
              }}
            >
              {p.featured && (
                <span
                  className="absolute -top-3 left-6 rounded px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: C.accent, color: "#fff" }}
                >
                  おすすめ
                </span>
              )}
              <div className="text-sm font-semibold" style={{ color: C.muted }}>
                {p.name}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold tabular-nums">
                  {p.credits.toLocaleString()}
                </span>
                <span className="text-sm" style={{ color: C.muted }}>
                  credits
                </span>
              </div>
              <div className="mt-1 text-[13px]" style={{ color: C.muted }}>
                {p.per}
                {p.note && (
                  <span style={{ color: C.accent }} className="ml-2">
                    {p.note}
                  </span>
                )}
              </div>

              <div className="mt-6 text-2xl font-semibold">{p.price}</div>

              <button
                onClick={() => buy(p.id)}
                disabled={loadingId !== null}
                className="mt-4 rounded-md py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: p.featured ? C.accent : C.surface2,
                  color: p.featured ? "#fff" : C.ink,
                  border: p.featured ? "none" : `1px solid ${C.border}`,
                }}
                onMouseEnter={(e) => {
                  if (loadingId === null)
                    e.currentTarget.style.background = p.featured
                      ? C.accentHover
                      : C.border;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = p.featured
                    ? C.accent
                    : C.surface2;
                }}
              >
                {loadingId === p.id ? "決済ページへ…" : "購入する"}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p style={{ color: C.accent }} className="mt-6 text-[13px]">
            {error}
          </p>
        )}

        <p
          style={{ color: C.muted, fontFamily: FONT_MONO }}
          className="mt-8 text-[11px]"
        >
          決済は Stripe を通じて安全に処理されます。カード情報がサーバーに保存されることはありません。
        </p>
      </div>
    </div>
  );
}
