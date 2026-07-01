import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ----------------------------------------------------------------
// ミドルウェア: 全リクエストで
//   1) セッションCookieを更新（期限切れを防ぐ）
//   2) 保護ルート(/generate,/billing)を未ログインなら /login へ飛ばす
// ----------------------------------------------------------------

const PROTECTED = ["/generate", "/billing"];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
          );
        },
      },
    }
  );

  // getUser() を呼ぶとセッションが検証・更新される（getSessionより堅い）。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const needsAuth = PROTECTED.some((p) => path.startsWith(p));

  if (needsAuth && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path); // ログイン後に戻す先を控える
    return NextResponse.redirect(url);
  }

  // ログイン済みで /login に来たら生成画面へ
  if (path === "/login" && user) {
    const url = req.nextUrl.clone();
    url.pathname = "/generate";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // 静的ファイル等を除く全ルートで実行
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
