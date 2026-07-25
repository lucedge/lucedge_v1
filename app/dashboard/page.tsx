import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { signOutAction } from "@/app/(auth)/actions";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-up?mode=signin");
  }
  if (!user.email_confirmed_at) {
    redirect("/auth/verify");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "var(--surface-0)",
        color: "var(--fg-1)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em" }}>You&apos;re signed in</h1>
      <p style={{ color: "var(--fg-3)", fontSize: 14 }}>{user.email}</p>
      <form action={signOutThenRedirect}>
        <button
          type="submit"
          style={{
            height: 40,
            padding: "0 16px",
            background: "var(--brand-blue)",
            border: "none",
            borderRadius: "var(--radius-md)",
            color: "#fff",
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

async function signOutThenRedirect() {
  "use server";
  await signOutAction();
  redirect("/sign-up?mode=signin");
}
