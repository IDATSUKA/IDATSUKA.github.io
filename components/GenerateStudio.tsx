"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";

// ----------------------------------------------------------------
// IDATSUKA 生成スタジオ
//   - Supabase Realtime で generations を購読し、完了を即反映
//   - 墨(near-black)地に朱(vermilion)を唯一のアクセント
//   - 状態表示は「Rewrite Code」に寄せたコンパイラログ風モノスペース
// ----------------------------------------------------------------

type Generation = {
  id: string;
  ref_id: string;
  prompt: string;
  status: "queued" | "processing" | "completed" | "failed";
  result_url: string | null;
  created_at: string;
};

const CREDIT_COST = 10; // lib/higgsfield.ts の CREDIT_COST_PER_IMAGE と揃える

// 墨と朱のパレット（zero-config で効くよう直接指定）
const C = {
  bg: "#0A0A0F",
  surface: "#14141C",
  surface2: "#1C1C28",
  border: "#2A2A3C",
  ink: "#ECEAF4",
  muted: "#7C7A90",
  accent: "#E8433F",
  accentHover: "#FF5A54",
  ok: "#5BD6A0",
};

const FONT_DISPLAY =
  "'Space Grotesk','Zen Kaku Gothic New',system-ui,sans-serif";
const FONT_MONO = "'JetBrains Mono','SFMono-Regular',ui-monospace,monospace";

export default function GenerateStudio() {
  const supabase = getBrowserClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<Generation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // --- セッション取得 -------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setToken(data.session?.access_token ?? null);
    });
  }, [supabase]);

  // --- 残高＋既存の生成を読み込み -------------------------------
  const loadState = useCallback(async () => {
    if (!userId) return;
    const [{ data: credit }, { data: gens }] = await Promise.all([
      supabase.from("credits").select("balance").eq("user_id", userId).single(),
      supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setBalance(credit?.balance ?? 0);
    if (gens) setItems(gens as Generation[]);
  }, [supabase, userId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // --- Realtime購読: generations の変更を即反映 -----------------
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("generations-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generations",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Generation;
          setItems((prev) => {
            const i = prev.findIndex((g) => g.id === row.id);
            if (i === -1) return [row, ...prev];
            const next = [...prev];
            next[i] = row;
            return next;
          });
          // 完了/失敗で残高が確定するので取り直す
          if (row.status === "completed" || row.status === "failed") {
            loadState();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, loadState]);

  // --- 生成リクエスト -------------------------------------------
  const generate = useCallback(async () => {
    const text = prompt.trim();
    if (!text || submitting || !token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "INSUFFICIENT_CREDITS"
            ? "クレジットが足りません。チャージしてください。"
            : "生成の開始に失敗しました。少し待って再試行してください。"
        );
        return;
      }
      setBalance(data.balance);
      setPrompt("");
      promptRef.current?.focus();
      // 楽観的にqueued行を先頭へ（Realtimeが来れば置き換わる）
      setItems((prev) => [
        {
          id: `temp-${data.requestId}`,
          ref_id: data.requestId,
          prompt: text,
          status: "queued",
          result_url: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch {
      setError("ネットワークエラー。接続を確認してください。");
    } finally {
      setSubmitting(false);
    }
  }, [prompt, submitting, token]);

  const canGenerate =
    !!prompt.trim() && !submitting && (balance ?? 0) >= CREDIT_COST;

  return (
    <div
      style={{ background: C.bg, color: C.ink, fontFamily: FONT_DISPLAY }}
      className="min-h-screen w-full"
    >
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* ヘッダー: ブランド + 残高 */}
        <header className="mb-10 flex items-end justify-between border-b pb-6"
          style={{ borderColor: C.border }}>
          <div>
            <div
              style={{ color: C.accent, fontFamily: FONT_MONO }}
              className="text-[11px] tracking-[0.3em] uppercase"
            >
              IDATSUKA / rewrite
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Generation Studio
            </h1>
          </div>
          <div className="text-right">
            <div
              style={{ color: C.muted, fontFamily: FONT_MONO }}
              className="text-[10px] uppercase tracking-[0.2em]"
            >
              credits
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {balance === null ? "—" : balance.toLocaleString()}
            </div>
          </div>
        </header>

        {/* プロンプト入力 */}
        <section
          className="rounded-lg border p-4"
          style={{ background: C.surface, borderColor: C.border }}
        >
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate();
            }}
            placeholder="生成したい絵を記述… （例: Kuro、雨のネオン路地、俯瞰、シネマティック）"
            rows={3}
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:opacity-40"
            style={{ color: C.ink }}
          />
          <div className="mt-3 flex items-center justify-between">
            <span
              style={{ color: C.muted, fontFamily: FONT_MONO }}
              className="text-[11px]"
            >
              1生成 = {CREDIT_COST} credits
              <span className="mx-2 opacity-40">·</span>
              <kbd className="opacity-70">⌘/Ctrl</kbd>+
              <kbd className="opacity-70">Enter</kbd>
            </span>
            <button
              onClick={generate}
              disabled={!canGenerate}
              className="rounded-md px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: canGenerate ? C.accent : C.surface2,
                color: canGenerate ? "#fff" : C.muted,
              }}
              onMouseEnter={(e) => {
                if (canGenerate)
                  (e.currentTarget.style.background = C.accentHover);
              }}
              onMouseLeave={(e) => {
                if (canGenerate) (e.currentTarget.style.background = C.accent);
              }}
            >
              {submitting ? "投入中…" : "生成する"}
            </button>
          </div>
          {(balance ?? 0) < CREDIT_COST && balance !== null && (
            <p style={{ color: C.accent }} className="mt-2 text-[13px]">
              残高が不足しています。クレジットをチャージしてください。
            </p>
          )}
          {error && (
            <p style={{ color: C.accent }} className="mt-2 text-[13px]">
              {error}
            </p>
          )}
        </section>

        {/* 生成フレーム一覧 */}
        <section className="mt-10">
          {items.length === 0 ? (
            <div
              className="rounded-lg border border-dashed py-20 text-center"
              style={{ borderColor: C.border, color: C.muted }}
            >
              <p className="text-sm">まだ生成はありません。</p>
              <p
                style={{ fontFamily: FONT_MONO }}
                className="mt-1 text-[11px] opacity-60"
              >
                最初のプロンプトを入力してください。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {items.map((g) => (
                <Frame key={g.id} g={g} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// 生成フレーム（1枚）。状態を「コンパイラログ風」に見せるのが署名要素。
// ----------------------------------------------------------------
function Frame({ g }: { g: Generation }) {
  const pending = g.status === "queued" || g.status === "processing";

  const statusLine =
    g.status === "queued"
      ? "> queued · awaiting node"
      : g.status === "processing"
      ? "> rewriting frame…"
      : g.status === "completed"
      ? "> done · committed"
      : "> failed · reverted";

  const statusColor =
    g.status === "completed"
      ? C.ok
      : g.status === "failed"
      ? C.accent
      : C.muted;

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ background: C.surface, borderColor: C.border }}
    >
      <div
        className="relative flex aspect-[3/4] items-center justify-center"
        style={{ background: C.bg }}
      >
        {g.result_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={g.result_url}
            alt={g.prompt}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            {pending ? (
              <span
                className="h-6 w-6 animate-spin rounded-full border-2"
                style={{ borderColor: C.border, borderTopColor: C.accent }}
              />
            ) : (
              <span style={{ color: C.accent }} className="text-2xl">
                ✕
              </span>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <p
          style={{ fontFamily: FONT_MONO, color: statusColor }}
          className="text-[10px] tracking-wide"
        >
          {statusLine}
        </p>
        <p
          style={{ color: C.muted }}
          className="line-clamp-2 text-[12px] leading-snug"
        >
          {g.prompt}
        </p>
      </div>
    </div>
  );
}
