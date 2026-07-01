import GenerateStudio from "@/components/GenerateStudio";

export const dynamic = "force-dynamic";

// app.idatsuka.com/generate
// 認証ガードはミドルウェア or レイアウトで行う想定（未ログインは /login へ）。
export default function GeneratePage() {
  return <GenerateStudio />;
}
