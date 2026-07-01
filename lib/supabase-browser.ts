"use client";

import { createBrowserClient } from "@supabase/ssr";

// ブラウザ用クライアント（anonキー）。セッションを保持し、Realtime購読に使う。
// RLSが効くので、このクライアントからは本人のデータしか読めない。
let client: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
