import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { runSyncTick } from "@/lib/broker/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get("x-cron-secret") ?? "";
  const expected = process.env.BROKER_CRON_SHARED_SECRET ?? "";
  if (!expected || provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getAdminSupabase();
  const nowIso = new Date().toISOString();
  const { data: dueConnections } = await admin
    .from("broker_connections")
    .select("id, backfill_completed_at")
    .in("status", ["connected", "syncing", "error"])
    .or(`next_sync_at.is.null,next_sync_at.lte.${nowIso}`);

  const results: { connectionId: string; status: string }[] = [];
  for (const connection of dueConnections ?? []) {
    // The `type` label here only affects the sync_jobs.type column for
    // record-keeping — runSyncTick independently re-reads
    // backfill_completed_at itself to decide the actual fetch window, so
    // this can't drift from the real behavior.
    const type = connection.backfill_completed_at ? "incremental" : "backfill";
    const result = await runSyncTick(connection.id, type);
    results.push({ connectionId: connection.id, status: result.status });
  }

  return NextResponse.json({ processed: results.length, results });
}
