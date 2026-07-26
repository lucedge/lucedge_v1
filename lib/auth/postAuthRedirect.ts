import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The single post-auth routing decision, shared by every entry point that
 * can finish an authentication (password sign-in, Google OAuth callback,
 * and by extension any future provider) so they can never drift apart.
 */
export async function determinePostAuthRedirect(
  supabase: SupabaseClient,
  userId: string,
  emailConfirmedAt: string | null | undefined,
): Promise<string> {
  if (!emailConfirmedAt) {
    return "/auth/verify";
  }

  const { data: profile } = await supabase
    .from("users")
    .select("onboarded_at")
    .eq("id", userId)
    .single();

  if (!profile?.onboarded_at) {
    return "/onboarding";
  }

  const { data: pendingDeletion } = await supabase
    .from("data_requests")
    .select("id")
    .eq("type", "delete")
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (pendingDeletion) {
    return "/profile/delete";
  }

  return "/dashboard";
}
