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
	  };

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
