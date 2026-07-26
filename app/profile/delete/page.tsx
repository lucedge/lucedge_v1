import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DeleteAccountClient } from "./DeleteAccountClient";

export default async function DeleteAccountPage() {
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

  const { data: pending } = await supabase
    .from("data_requests")
    .select("expires_at")
    .eq("type", "delete")
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return <DeleteAccountClient scheduledFor={pending?.expires_at ?? null} />;
}
