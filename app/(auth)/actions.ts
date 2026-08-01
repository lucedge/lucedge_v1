"use server";

import { track } from "@/lib/analytics";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getSupabase } from "@/lib/supabase/server";
import { sendPasswordChangedEmail } from "@/lib/email/resend";
import {
  checkLockout,
  countRecentEvents,
  getClientIp,
  getOrigin,
  recordAuthEvent,
} from "@/lib/auth/lockout";
import { getUserAgent } from "@/lib/auth/userAgent";
import { determinePostAuthRedirect } from "@/lib/auth/postAuthRedirect";

const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_DAILY_LIMIT = 5;
const RESEND_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

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
    await admin.from("users").insert({ id: data.user.id });
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

  const userAgent = await getUserAgent();
  await recordAuthEvent({
    userId: data.user.id,
    email,
    ip,
    eventType: "sign_in_success",
    metadata: { userAgent },
  });

  const redirect = await determinePostAuthRedirect(supabase, data.user.id, data.user.email_confirmed_at);
  return { success: true, redirect };
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

export async function completeOnboardingAction(timezone: string, currency: string) {
  const supabase = await getSupabase();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "You need to be signed in to continue." };
  }

  const { error } = await supabase.from("users").upsert({
    id: userData.user.id,
    timezone,
    display_currency: currency,
    onboarded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return { error: "Couldn't save. Check your connection and try again." };
  }

  const ip = await getClientIp();
  await recordAuthEvent({
    userId: userData.user.id,
    email: userData.user.email,
    ip,
    eventType: "onboarding_completed",
  });

  return { success: true };
}

export async function updateProfileAction(params: {
  displayName: string;
  timezone: string;
  currency: string;
}) {
  const supabase = await getSupabase();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("users")
    .update({
      display_name: params.displayName,
      timezone: params.timezone,
      display_currency: params.currency,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userData.user.id);

  if (error) {
    return { error: "Couldn't save. Check your connection and try again." };
  }

  return { success: true };
}

export async function changePasswordAction(currentPassword: string, newPassword: string) {
  const supabase = await getSupabase();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.email) {
    return { error: "You need to be signed in to change your password." };
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { error: error.message };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    const admin = getAdminSupabase();
    await admin.auth.admin.signOut(sessionData.session.access_token, "others");
  }

  await sendPasswordChangedEmail(userData.user.email);

  const ip = await getClientIp();
  await recordAuthEvent({
    userId: userData.user.id,
    email: userData.user.email,
    ip,
    eventType: "password_changed",
  });

  return { success: true };
}

export async function signOutOtherSessionsAction() {
  const supabase = await getSupabase();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "You need to be signed in." };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    const admin = getAdminSupabase();
    await admin.auth.admin.signOut(sessionData.session.access_token, "others");
  }

  const ip = await getClientIp();
  await recordAuthEvent({
    userId: userData.user.id,
    email: userData.user.email,
    ip,
    eventType: "sessions_revoked_others",
  });

  return { success: true };
}

export async function updateConsentAction(purpose: string, granted: boolean) {
  const supabase = await getSupabase();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "You need to be signed in." };
  }

  const admin = getAdminSupabase();
  const { error } = await admin.from("consent_records").insert({
    user_id: userData.user.id,
    purpose,
    granted,
    source: "profile_settings",
  });

  if (error) {
    return { error: "Couldn't save. Check your connection and try again." };
  }

  return { success: true };
}

const DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

export async function requestAccountDeletionAction() {
  const supabase = await getSupabase();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "You need to be signed in." };
  }

  const admin = getAdminSupabase();
  const expiresAt = new Date(Date.now() + DELETION_GRACE_MS).toISOString();

  const { error } = await admin.from("data_requests").insert({
    user_id: userData.user.id,
    type: "delete",
    status: "pending",
    expires_at: expiresAt,
  });
  if (error) {
    return { error: "Couldn't schedule deletion. Please try again." };
  }

  // Kill every other session immediately ("access blocked"); the current
  // one stays alive so a same-tab "restore" right after works without
  // needing to sign in again.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    await admin.auth.admin.signOut(sessionData.session.access_token, "others");
  }

  const ip = await getClientIp();
  await recordAuthEvent({
    userId: userData.user.id,
    email: userData.user.email,
    ip,
    eventType: "deletion_requested",
    metadata: { expiresAt },
  });

  return { success: true, expiresAt };
}

export async function restoreAccountAction() {
  const supabase = await getSupabase();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "You need to be signed in." };
  }

  const admin = getAdminSupabase();
  const { data: pending } = await admin
    .from("data_requests")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("type", "delete")
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pending) {
    return { error: "No pending deletion found." };
  }

  const { error: restoreError } = await admin
    .from("data_requests")
    .update({ status: "cancelled" })
    .eq("id", pending.id);
  if (restoreError) {
    return { error: "Couldn't restore your account. Please try again." };
  }

  const ip = await getClientIp();
  await recordAuthEvent({
    userId: userData.user.id,
    email: userData.user.email,
    ip,
    eventType: "deletion_cancelled",
  });

  return { success: true };
}

/**
 * Performs the actual hard erasure for delete requests whose 30-day grace
 * period has passed. Not wired to any UI or scheduler yet — deleting
 * auth.users cascades through our FKs (users, consent_records,
 * audit_events, data_requests) automatically. Whatever eventually calls
 * this (pg_cron, a Supabase Edge Function, Vercel Cron) is a separate,
 * later infra decision.
 */
export async function performScheduledErasureAction() {
  const admin = getAdminSupabase();

  const { data: due } = await admin
    .from("data_requests")
    .select("id, user_id")
    .eq("type", "delete")
    .eq("status", "pending")
    .lte("expires_at", new Date().toISOString());

  for (const request of due ?? []) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(request.user_id);
    if (deleteError) continue;
    await admin
      .from("data_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", request.id);
  }

  return { processed: due?.length ?? 0 };
}
