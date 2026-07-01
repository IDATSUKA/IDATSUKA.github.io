import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ----------------------------------------------------------------
// サーバー文脈（Server Component / Route Handler）用クライアント。
//   Cookieからセッションを読む。RLSが効く＝本人のデータのみ。
//   （service-roleとは別物。あちらはRLS貫通の管理用）
// ----------------------------------------------------------------
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Componentから呼ばれた場合は書き込み不可 → 無視でOK
            // （セッション更新はmiddleware側で行われる）
          }
        },
      },
    }
  );
}
