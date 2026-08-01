import "server-only";
import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

function getClient(): PostHog | null {
	const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
	const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
	if (!key || !host) return null;
	if (!_client) {
		_client = new PostHog(key, { host, flushAt: 20, flushInterval: 10000 });
	}
	return _client;
}

export type AnalyticsEvent =
	| {
			event: "signup_attempted";
			properties: { auth_provider: "google" | "email" };
	  }
	| {
			event: "signup_succeeded";
			properties: { auth_provider: "google" | "email"; user_id: string };
	  }
	| {
			event: "signup_failed";
			properties: { auth_provider: "google" | "email"; reason: string };
	  }
	| { event: "intro_slide_viewed"; properties: { slide_index: number } }
	| {
			event: "intro_slide_skipped";
			properties: { slide_index_at_skip: number };
	  }
	| { event: "broker_connect_initiated"; properties: { broker: "ctrader" | "mt5" } }
	| {
			event: "broker_connect_succeeded";
			properties: { broker: "ctrader" | "mt5"; connection_count: number };
	  }
	| {
			event: "broker_connect_failed";
			properties: { broker: "ctrader" | "mt5"; reason: string };
	  }
	| {
			event: "broker_connection_confirmed";
			properties: { connection_id: string; broker: "ctrader" | "mt5" };
	  }
	| { event: "broker_backfill_started"; properties: { connection_id: string } }
	| {
			event: "broker_backfill_completed";
			properties: { connection_id: string; trades_new: number };
	  }
	| {
			event: "broker_sync_completed";
			properties: { connection_id: string; trades_new: number };
	  }
	| {
			event: "broker_sync_failed";
			properties: { connection_id: string; error_code: string };
	  }
	| { event: "broker_reauth_needed"; properties: { connection_id: string } }
	| { event: "broker_disconnected"; properties: { connection_id: string } };

export function track(distinctId: string, payload: AnalyticsEvent): void {
	try {
		getClient()?.capture({
			distinctId,
			event: payload.event,
			properties: payload.properties,
		});
	} catch {
		// Analytics failures must never crash the app
	}
}

export async function flushAnalytics(): Promise<void> {
	await getClient()?.shutdown();
}
