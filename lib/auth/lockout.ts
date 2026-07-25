import "server-only";
import { headers } from "next/headers";
import { getAdminSupabase } from "@/lib/supabase/admin";

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_THRESHOLD = 5;

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

export async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function recordAuthEvent(params: {
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = getAdminSupabase();
  await admin.from("audit_events").insert({
    user_id: params.userId ?? null,
    email: params.email ?? null,
    ip: params.ip ?? null,
    event_type: params.eventType,
    metadata: params.metadata ?? null,
  });
}

export async function checkLockout(
  email: string,
  ip: string,
): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  const admin = getAdminSupabase();
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS).toISOString();

  const { data, error } = await admin
    .from("audit_events")
    .select("created_at")
    .eq("event_type", "sign_in_failed")
    .or(`email.eq.${email},ip.eq.${ip}`)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error || !data || data.length < LOCKOUT_THRESHOLD) {
    return { locked: false, retryAfterSeconds: 0 };
  }

  const mostRecentFailedAt = new Date(data[0].created_at).getTime();
  const retryAfterMs = mostRecentFailedAt + LOCKOUT_WINDOW_MS - Date.now();

  if (retryAfterMs <= 0) {
    return { locked: false, retryAfterSeconds: 0 };
  }

  return { locked: true, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
}

export async function countRecentEvents(params: {
  email: string;
  eventType: string;
  sinceMs: number;
}): Promise<{ count: number; mostRecentAt: number | null }> {
  const admin = getAdminSupabase();
  const since = new Date(Date.now() - params.sinceMs).toISOString();

  const { data, error } = await admin
    .from("audit_events")
    .select("created_at")
    .eq("event_type", params.eventType)
    .eq("email", params.email)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error || !data) return { count: 0, mostRecentAt: null };

  return {
    count: data.length,
    mostRecentAt: data.length > 0 ? new Date(data[0].created_at).getTime() : null,
  };
}
