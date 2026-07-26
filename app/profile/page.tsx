import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { describeUserAgent } from "@/lib/auth/userAgent";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
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

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, timezone, display_currency, onboarded_at")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarded_at) {
    redirect("/onboarding");
  }

  const { data: pendingDeletion } = await supabase
    .from("data_requests")
    .select("id")
    .eq("type", "delete")
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (pendingDeletion) {
    redirect("/profile/delete");
  }

  // Fetch a larger pool than we'll display, since deduping by device+IP
  // below can collapse many rows (e.g. repeated sign-ins from one laptop)
  // down to far fewer unique entries.
  const { data: signIns } = await supabase
    .from("audit_events")
    .select("ip, metadata, created_at")
    .eq("event_type", "sign_in_success")
    .order("created_at", { ascending: false })
    .limit(50);

  const seen = new Set<string>();
  const sessions: { device: string; ip: string; when: string }[] = [];
  for (const row of signIns ?? []) {
    const userAgent = (row.metadata as { userAgent?: string } | null)?.userAgent ?? "";
    const ip = row.ip ?? "Unknown";
    const key = `${ip}::${userAgent}`;
    if (seen.has(key)) continue; // already have this device+IP's most recent sign-in
    seen.add(key);
    sessions.push({
      device: describeUserAgent(userAgent),
      ip,
      when: new Date(row.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    });
    if (sessions.length >= 10) break;
  }

  const { data: marketingConsent } = await supabase
    .from("consent_records")
    .select("granted")
    .eq("user_id", user.id)
    .eq("purpose", "marketing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <ProfileClient
      email={user.email ?? ""}
      displayName={profile.display_name ?? ""}
      timezone={profile.timezone ?? "UTC"}
      currency={profile.display_currency ?? "USD"}
      sessions={sessions}
      marketingOptIn={marketingConsent?.granted ?? false}
    />
  );
}
