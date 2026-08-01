import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { encryptCredential, decryptCredential } from "@/lib/crypto/credentials";
import { refreshTokens } from "./ctrader/oauth";
import { fetchDeals } from "./ctrader/protoClient";
import { mapDealsToRawTrades } from "./ctrader/mapping";
import { recordConnectionEvent } from "./events";
import { track } from "@/lib/analytics";

const BACKFILL_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // one page of history per tick
// MVP default: backfill only the last 90 days. A trader-chosen lookback
// (e.g. "import my last 1/2/5 years") is a deliberately deferred feature —
// bump this later alongside adding that choice, not before it exists.
const MAX_LOOKBACK_MS = BACKFILL_WINDOW_MS;
const MAX_CONSECUTIVE_FAILURES = 3;
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

type ConnectionRow = {
  id: string;
  user_id: string;
  oauth_grant_id: string;
  broker_account_id: string;
  account_type: string;
  status: string;
  last_synced_at: string | null;
  backfill_completed_at: string | null;
  backfill_cursor: string | null;
};

type CredentialRow = {
  id: string;
  connection_id: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  token_expires_at: string | null;
};

/**
 * Refreshes the token if it's near expiry, and fans the new pair out to
 * every connection sharing the same oauth_grant_id (see the schema comment
 * on broker_connections.oauth_grant_id for why). Always reads the
 * credential row fresh from the database rather than a cached copy — when
 * sibling connections under the same grant are processed sequentially in
 * one cron tick, the second one's fresh read naturally sees the first
 * one's refresh already applied and skips re-refreshing, with no extra
 * in-memory coordination needed.
 */
export async function refreshConnectionTokenIfNeeded(connection: ConnectionRow): Promise<"ok" | "needs_reauth"> {
  const admin = getAdminSupabase();
  const { data: credential } = await admin
    .from("broker_credentials")
    .select("id, connection_id, encrypted_access_token, encrypted_refresh_token, token_expires_at")
    .eq("connection_id", connection.id)
    .single<CredentialRow>();

  if (!credential) return "needs_reauth";

  const needsRefresh =
    !credential.token_expires_at ||
    new Date(credential.token_expires_at).getTime() < Date.now() + TOKEN_REFRESH_MARGIN_MS;
  if (!needsRefresh) return "ok";

  try {
    const refreshToken = decryptCredential(credential.encrypted_refresh_token);
    const tokens = await refreshTokens(refreshToken);
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

    const { data: siblings } = await admin
      .from("broker_connections")
      .select("id")
      .eq("oauth_grant_id", connection.oauth_grant_id);

    for (const sibling of siblings ?? []) {
      await admin
        .from("broker_credentials")
        .update({
          encrypted_access_token: encryptCredential(tokens.accessToken),
          encrypted_refresh_token: encryptCredential(tokens.refreshToken),
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("connection_id", sibling.id);
    }
    return "ok";
  } catch {
    const { data: siblings } = await admin
      .from("broker_connections")
      .select("id")
      .eq("oauth_grant_id", connection.oauth_grant_id);
    for (const sibling of siblings ?? []) {
      await admin.from("broker_connections").update({ status: "needs_reauth" }).eq("id", sibling.id);
      await recordConnectionEvent({ connectionId: sibling.id, eventType: "reauth_required" });
      track(connection.user_id, { event: "broker_reauth_needed", properties: { connection_id: sibling.id } });
    }
    return "needs_reauth";
  }
}

async function countRecentFailures(connectionId: string): Promise<number> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("sync_jobs")
    .select("status")
    .eq("connection_id", connectionId)
    .order("started_at", { ascending: false })
    .limit(MAX_CONSECUTIVE_FAILURES);
  const recent = data ?? [];
  let count = 0;
  for (const job of recent) {
    if (job.status !== "failed") break;
    count++;
  }
  return count;
}

export async function runSyncTick(
  connectionId: string,
  type: "backfill" | "incremental" | "manual",
): Promise<{ status: "completed" | "partial" | "failed" | "needs_reauth"; tradesFetched: number; tradesNew: number }> {
  const admin = getAdminSupabase();

  const { data: connection } = await admin
    .from("broker_connections")
    .select(
      "id, user_id, oauth_grant_id, broker_account_id, account_type, status, last_synced_at, backfill_completed_at, backfill_cursor",
    )
    .eq("id", connectionId)
    .single<ConnectionRow>();

  if (!connection || connection.status === "disconnected") {
    return { status: "failed", tradesFetched: 0, tradesNew: 0 };
  }

  // Visible immediately (a page refresh mid-tick shows "Syncing…" instead
  // of stale "Connected"), and doubles as the guard against a trader
  // clicking "Sync now" again while one is already running. Every exit
  // path below must move this to a terminal status — never leave a
  // connection stuck showing "syncing" after this function returns.
  await admin.from("broker_connections").update({ status: "syncing" }).eq("id", connectionId);

  const { data: job } = await admin
    .from("sync_jobs")
    .insert({ connection_id: connectionId, type, status: "running" })
    .select("id")
    .single();
  const jobId = job?.id as string | undefined;

  const tokenStatus = await refreshConnectionTokenIfNeeded(connection);
  if (tokenStatus === "needs_reauth") {
    if (jobId) {
      await admin
        .from("sync_jobs")
        .update({ status: "failed", error_code: "SYN-001", finished_at: new Date().toISOString() })
        .eq("id", jobId);
    }
    return { status: "needs_reauth", tradesFetched: 0, tradesNew: 0 };
  }

  const { data: credential } = await admin
    .from("broker_credentials")
    .select("encrypted_access_token")
    .eq("connection_id", connectionId)
    .single();

  const isBackfilling = !connection.backfill_completed_at;
  let fromTimestamp: number;
  let toTimestamp: number;
  if (isBackfilling) {
    toTimestamp = connection.backfill_cursor ? new Date(connection.backfill_cursor).getTime() : Date.now();
    fromTimestamp = toTimestamp - BACKFILL_WINDOW_MS;
  } else {
    fromTimestamp = connection.last_synced_at ? new Date(connection.last_synced_at).getTime() : Date.now() - BACKFILL_WINDOW_MS;
    toTimestamp = Date.now();
  }

  let fetchResult: Awaited<ReturnType<typeof fetchDeals>>;
  try {
    fetchResult = await fetchDeals({
      ctidTraderAccountId: connection.broker_account_id,
      isLive: connection.account_type !== "demo",
      accessToken: decryptCredential(credential!.encrypted_access_token),
      fromTimestamp,
      toTimestamp,
    });
  } catch (err) {
    const failures = await countRecentFailures(connectionId);
    if (jobId) {
      await admin
        .from("sync_jobs")
        .update({ status: "failed", error_code: "SYS-001", finished_at: new Date().toISOString() })
        .eq("id", jobId);
    }
    if (failures + 1 >= MAX_CONSECUTIVE_FAILURES) {
      await admin.from("broker_connections").update({ status: "error" }).eq("id", connectionId);
      await recordConnectionEvent({
        connectionId,
        eventType: "sync_failed",
        detail: { message: err instanceof Error ? err.message : String(err) },
      });
      track(connection.user_id, { event: "broker_sync_failed", properties: { connection_id: connectionId, error_code: "SYS-001" } });
    } else {
      // Not yet at the failure threshold — back to "connected" rather
      // than leaving it stuck on "syncing" until the next tick retries.
      await admin.from("broker_connections").update({ status: "connected" }).eq("id", connectionId);
    }
    return { status: "failed", tradesFetched: 0, tradesNew: 0 };
  }

  const trades = mapDealsToRawTrades(fetchResult.deals, connectionId, fetchResult.symbolNames);

  let tradesNew = 0;
  if (trades.length > 0) {
    const { data: inserted } = await admin
      .from("raw_trades")
      .upsert(trades, { onConflict: "dedup_hash", ignoreDuplicates: true })
      .select("id");
    tradesNew = inserted?.length ?? 0;
  }

  const now = new Date();
  const updates: Record<string, unknown> = {
    status: "connected",
    last_synced_at: now.toISOString(),
    next_sync_at: new Date(now.getTime() + SYNC_INTERVAL_MS).toISOString(),
    updated_at: now.toISOString(),
  };

  if (isBackfilling) {
    if (fetchResult.hasMore && fetchResult.deals.length > 0) {
      // More data within this window than one page covers — narrow the
      // window and let the next tick continue from the oldest deal seen.
      // Checked before reachedMaxLookback below: a very active account
      // with more than one page of trades inside the lookback window must
      // finish draining that window before backfill can be considered
      // done, otherwise trades beyond the first page would be silently
      // skipped.
      const oldest = Math.min(...fetchResult.deals.map((d) => Number(d.executionTimestamp)));
      updates.backfill_cursor = new Date(oldest - 1).toISOString();
    } else if (Date.now() - fromTimestamp >= MAX_LOOKBACK_MS) {
      updates.backfill_completed_at = now.toISOString();
      track(connection.user_id, {
        event: "broker_backfill_completed",
        properties: { connection_id: connectionId, trades_new: tradesNew },
      });
      await recordConnectionEvent({ connectionId, eventType: "backfill_completed" });
    } else {
      updates.backfill_cursor = new Date(fromTimestamp).toISOString();
    }
  }

  await admin.from("broker_connections").update(updates).eq("id", connectionId);

  if (jobId) {
    await admin
      .from("sync_jobs")
      .update({
        status: "completed",
        finished_at: now.toISOString(),
        trades_fetched: fetchResult.deals.length,
        trades_new: tradesNew,
      })
      .eq("id", jobId);
  }

  track(connection.user_id, {
    event: "broker_sync_completed",
    properties: { connection_id: connectionId, trades_new: tradesNew },
  });

  return { status: "completed", tradesFetched: fetchResult.deals.length, tradesNew };
}
