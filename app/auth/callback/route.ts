import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getClientIp, recordAuthEvent } from "@/lib/auth/lockout";
import { getUserAgent } from "@/lib/auth/userAgent";
import { determinePostAuthRedirect } from "@/lib/auth/postAuthRedirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL(`${explicitNext ?? "/dashboard"}?error=link_invalid`, origin));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL(`${explicitNext ?? "/dashboard"}?error=link_invalid`, origin));
  }

  // The email-verification and password-reset flows both pass an explicit
  // `next` — honor it as-is, unchanged. A plain OAuth sign-in (Google, no
  // `next`) needs the same routing decision + first-time side effects the
  // password path already gets from emailSignUpAction/emailSignInAction.
  if (explicitNext) {
    return NextResponse.redirect(new URL(explicitNext, origin));
  }

  const admin = getAdminSupabase();
  const { data: existingProfile } = await admin
    .from("users")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  const ip = await getClientIp();
  const userAgent = await getUserAgent();

  if (!existingProfile) {
    await admin.from("users").insert({ id: data.user.id });
    await admin.from("consent_records").insert({
      user_id: data.user.id,
      purpose: "terms",
      granted: true,
      source: "google_oauth",
    });
    await recordAuthEvent({
      userId: data.user.id,
      email: data.user.email,
      ip,
      eventType: "sign_up",
      metadata: { provider: "google" },
    });
  } else {
    await recordAuthEvent({
      userId: data.user.id,
      email: data.user.email,
      ip,
      eventType: "sign_in_success",
      metadata: { provider: "google", userAgent },
    });
  }

  const redirectTo = await determinePostAuthRedirect(supabase, data.user.id, data.user.email_confirmed_at);
  return NextResponse.redirect(new URL(redirectTo, origin));
}
