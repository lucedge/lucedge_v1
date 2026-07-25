"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { track } from "@/lib/analytics";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  checkLockout,
  countRecentEvents,
  getClientIp,
  getOrigin,
  recordAuthEvent,
} from "@/lib/auth/lockout";

const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_DAILY_LIMIT = 5;
const RESEND_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
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
}

export async function emailSignUpAction(email: string, password: string) {
  const supabase = await getSupabase();
  const ip = await getClientIp();
  const origin = await getOrigin();

  track("anonymous", { event: "signup_attempted", properties: { auth_provider: "email" } });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/auth/verify` },
  });

  if (error) {
    track("anonymous", { event: "signup_failed", properties: { auth_provider: "email", reason: error.message } });
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "An account with this email exists. Sign in instead?" };
    }
    return { error: "Sign-up failed. Please try again." };
  }

  if (data.user) {
    track(data.user.id, { event: "signup_succeeded", properties: { auth_provider: "email", user_id: data.user.id } });

    const admin = getAdminSupabase();
    await admin.from("consent_records").insert({
      user_id: data.user.id,
      purpose: "terms",
      granted: true,
      source: "signup_checkbox",
    });
    await recordAuthEvent({ userId: data.user.id, email, ip, eventType: "sign_up" });
  }

  // Return session tokens so the client can call setSession() and establish
  // the auth cookie before any follow-up Server Actions run.
  return {
    success: true,
    session: data.session
      ? { access_token: data.session.access_token, refresh_token: data.session.refresh_token }
      : null,
  };
}

export async function signOutAction() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  return { success: true };
}

export async function emailSignInAction(email: string, password: string) {
  const supabase = await getSupabase();
  const ip = await getClientIp();

  const lockout = await checkLockout(email, ip);
  if (lockout.locked) {
    return { locked: true, retryAfterSeconds: lockout.retryAfterSeconds };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await recordAuthEvent({ email, ip, eventType: "sign_in_failed" });
    return { error: "Email or password is incorrect." };
  }

  await recordAuthEvent({ userId: data.user.id, email, ip, eventType: "sign_in_success" });

  if (!data.user.email_confirmed_at) {
    return { success: true, redirect: "/auth/verify" };
  }

  return { success: true, redirect: "/dashboard" };
}

export async function resendVerificationAction(email: string) {
  const cooldown = await countRecentEvents({
    email,
    eventType: "verification_resent",
    sinceMs: RESEND_COOLDOWN_MS,
  });
  if (cooldown.count > 0) {
    return { error: "Please wait a moment before requesting another email.", waitSeconds: 60 };
  }

  const daily = await countRecentEvents({
    email,
    eventType: "verification_resent",
    sinceMs: RESEND_DAILY_WINDOW_MS,
  });
  if (daily.count >= RESEND_DAILY_LIMIT) {
    return { error: "Too many resend attempts today. Try again tomorrow.", waitSeconds: undefined };
  }

  const supabase = await getSupabase();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/auth/verify` },
  });
  if (error) {
    return { error: "Couldn't resend the email. Please try again.", waitSeconds: undefined };
  }

  const ip = await getClientIp();
  await recordAuthEvent({ email, ip, eventType: "verification_resent" });

  return { success: true };
}

export async function requestPasswordResetAction(email: string) {
  const supabase = await getSupabase();
  const ip = await getClientIp();
  const origin = await getOrigin();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset`,
  });

  await recordAuthEvent({ email, ip, eventType: "password_reset_requested" });

  // Identical response whether or not the account exists (M1 spec 4.1 —
  // sign-in and reset must never become an account-enumeration oracle).
  return { success: true };
}

export async function setNewPasswordAction(newPassword: string) {
  const supabase = await getSupabase();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "This link is no longer valid." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    // Not an enumeration-sensitive path — the user is already authenticated
    // via the recovery link, so surfacing the real reason (e.g. "same as
    // your current password") is helpful, not a security leak.
    return { error: error.message };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    const admin = getAdminSupabase();
    // signOut's first arg is the access token JWT, not a user id.
    await admin.auth.admin.signOut(sessionData.session.access_token, "others");
  }

  const ip = await getClientIp();
  await recordAuthEvent({
    userId: userData.user.id,
    email: userData.user.email,
    ip,
    eventType: "password_reset_completed",
  });

  return { success: true };
}
