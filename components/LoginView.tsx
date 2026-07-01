"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";

// ----------------------------------------------------------------
// ログイン画面
//   - Google OAuth（1クリック）
//   - メール マジックリンク（パスワード不要）
//   生成スタジオと同じ 墨地×朱 のトーンで統一。
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

export default function LoginView({ next }: { next: string }) {
  const supabase = getBrowserClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      : undefined;

  const signInGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setError("Googleログインを開始できませんでした。");
  };

  const sendMagicLink = async () => {
    const addr = email.trim();
    if (!addr || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) {
      setError("リンクを送信できませんでした。アドレスを確認してください。");
      return;
    }
    setSent(true);
  };

  return (
    <div
      style={{ background: C.bg, color: C.ink, fontFamily: FONT_DISPLAY }}
      className="flex min-h-screen items-center justify-center px-6"
    >
      <div className="w-full max-w-sm">
        <div
          style={{ color: C.accent, fontFamily: FONT_MONO }}
          className="text-[11px] uppercase tracking-[0.3em]"
        >
          IDATSUKA / rewrite
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">サインイン</h1>
        <p style={{ color: C.muted }} className="mt-2 text-sm">
          生成スタジオを使うにはサインインが必要です。
        </p>

        <div className="mt-8 space-y-4">
          <button
            onClick={signInGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-md border py-2.5 text-sm font-semibold transition-colors"
            style={{ background: C.surface, borderColor: C.border, color: C.ink }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.surface)}
          >
            <GoogleMark />
            Googleで続ける
          </button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1" style={{ background: C.border }} />
            <span
              style={{ color: C.muted, fontFamily: FONT_MONO }}
              className="text-[10px] uppercase tracking-widest"
            >
              or
            </span>
            <span className="h-px flex-1" style={{ background: C.border }} />
          </div>

          {sent ? (
            <div
              className="rounded-md border p-4 text-sm"
              style={{ background: C.surface, borderColor: C.border }}
            >
              <p style={{ color: C.ink }}>メールを確認してください。</p>
              <p style={{ color: C.muted }} className="mt-1 text-[13px]">
                {email} にサインイン用リンクを送りました。
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                placeholder="name@example.com"
                className="w-full rounded-md border bg-transparent px-3 py-2.5 text-sm outline-none placeholder:opacity-40"
                style={{ borderColor: C.border, color: C.ink }}
              />
              <button
                onClick={sendMagicLink}
                disabled={busy || !email.trim()}
                className="w-full rounded-md py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: C.accent, color: "#fff" }}
                onMouseEnter={(e) =>
                  email.trim() && (e.currentTarget.style.background = C.accentHover)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = C.accent)
                }
              >
                {busy ? "送信中…" : "リンクを送る"}
              </button>
            </div>
          )}

          {error && (
            <p style={{ color: C.accent }} className="text-[13px]">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}
