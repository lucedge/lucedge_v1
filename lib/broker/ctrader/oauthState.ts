import "server-only";
import { cookies } from "next/headers";
import { encryptCredential, decryptCredential } from "@/lib/crypto/credentials";
import type { CTraderAccountSummary } from "./types";

const STATE_COOKIE = "ctrader_oauth_state";
const PENDING_ACCOUNTS_COOKIE = "ctrader_pending_accounts";
const MAX_AGE_SECONDS = 10 * 60;

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: MAX_AGE_SECONDS,
  path: "/",
};

export async function setPendingConnectState(state: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, COOKIE_OPTS);
}

export async function readAndClearPendingConnectState(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(STATE_COOKIE)?.value ?? null;
  cookieStore.delete(STATE_COOKIE);
  return value;
}

type PendingAccountsPayload = {
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  expiresAt: string;
  accounts: CTraderAccountSummary[];
};

export async function setPendingAccountsCookie(payload: {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  accounts: CTraderAccountSummary[];
}): Promise<void> {
  const cookieStore = await cookies();
  const packed: PendingAccountsPayload = {
    encryptedAccessToken: encryptCredential(payload.accessToken),
    encryptedRefreshToken: encryptCredential(payload.refreshToken),
    expiresAt: payload.expiresAt,
    accounts: payload.accounts,
  };
  cookieStore.set(PENDING_ACCOUNTS_COOKIE, JSON.stringify(packed), COOKIE_OPTS);
}

// Read-only peek for the account-picker page render — must NOT clear the
// cookie, since a trader refreshing or briefly navigating away from that
// page shouldn't lose their fetched account list. Clearing only happens
// once the trader actually submits (readAndClearPendingAccounts, called
// from confirmCtraderConnectionAction).
export async function peekPendingAccounts(): Promise<{ accounts: CTraderAccountSummary[] } | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PENDING_ACCOUNTS_COOKIE)?.value;
  if (!raw) return null;
  const parsed = JSON.parse(raw) as PendingAccountsPayload;
  return { accounts: parsed.accounts };
}

export async function readAndClearPendingAccounts(): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  accounts: CTraderAccountSummary[];
} | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PENDING_ACCOUNTS_COOKIE)?.value;
  cookieStore.delete(PENDING_ACCOUNTS_COOKIE);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as PendingAccountsPayload;
  return {
    accessToken: decryptCredential(parsed.encryptedAccessToken),
    refreshToken: decryptCredential(parsed.encryptedRefreshToken),
    expiresAt: parsed.expiresAt,
    accounts: parsed.accounts,
  };
}
