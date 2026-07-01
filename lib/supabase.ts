import { createClient } from "@supabase/supabase-js";

// ----------------------------------------------------------------
// service-role クライアント（サーバー専用・RLSを貫通）
//   Webhook や cron など「ユーザーのセッションが無い文脈」で使う。
//   このキーは絶対にクライアントへ出さない。サーバールート内のみ。
// ----------------------------------------------------------------
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ----------------------------------------------------------------
// ユーザー文脈のクライアント
//   リクエストの Authorization ヘッダ（SupabaseのJWT）を引き継ぐ。
//   RLSが効くので「本人の残高しか読めない」状態になる。
// ----------------------------------------------------------------
export function createUserClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
