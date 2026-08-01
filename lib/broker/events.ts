import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function recordConnectionEvent(params: {
  connectionId: string;
  eventType: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const admin = getAdminSupabase();
  await admin.from("connection_events").insert({
    connection_id: params.connectionId,
    event_type: params.eventType,
    detail: params.detail ?? null,
  });
}
