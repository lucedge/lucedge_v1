import "server-only";
import { headers } from "next/headers";

export async function getUserAgent(): Promise<string> {
  const h = await headers();
  return h.get("user-agent") ?? "unknown";
}

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Chrome\//, "Chrome"],
  [/Firefox\//, "Firefox"],
  [/Safari\//, "Safari"],
];

const PLATFORMS: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/Mac OS X/, "Mac"],
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Linux/, "Linux"],
];

export function describeUserAgent(ua: string): string {
  if (!ua || ua === "unknown") return "Unknown device";

  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
  const platform = PLATFORMS.find(([re]) => re.test(ua))?.[1];

  if (browser && platform) return `${browser} on ${platform}`;
  if (browser) return browser;
  if (platform) return `Unknown browser on ${platform}`;
  return "Unknown device";
}
