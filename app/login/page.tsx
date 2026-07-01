import LoginView from "@/components/LoginView";

export const dynamic = "force-dynamic";

// app.idatsuka.com/login
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <LoginView next={next ?? "/generate"} />;
}
