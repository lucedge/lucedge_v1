"use client";

import { useEffect, useState } from "react";

// A few common legacy IANA aliases that browsers/OSes still report, mapped
// to their modern canonical name. Both refer to the exact same offset/DST
// rules — this is a display normalization only.
const LEGACY_ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Dacca": "Asia/Dhaka",
  "Europe/Kiev": "Europe/Kyiv",
};

export function normalizeTimezone(tz: string): string {
  return LEGACY_ALIASES[tz] ?? tz;
}

/**
 * Best-effort browser timezone detection. Never throws — if the Intl API
 * is unavailable or misbehaves, falls back to UTC and reports that the
 * detection didn't succeed so the caller can tell the user.
 */
export function detectTimezone(): { timezone: string; detected: boolean } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return { timezone: "UTC", detected: false };
    return { timezone: normalizeTimezone(tz), detected: true };
  } catch {
    return { timezone: "UTC", detected: false };
  }
}

/**
 * Best-effort full IANA timezone list for the picker. Never throws and
 * never returns an empty array — falls back to just the detected zone (or
 * UTC) on older browsers without Intl.supportedValuesOf.
 */
export function listTimezones(fallback: string): string[] {
  try {
    const withSupportedValuesOf = Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[];
    };
    if (typeof withSupportedValuesOf.supportedValuesOf === "function") {
      const zones = withSupportedValuesOf.supportedValuesOf("timeZone");
      if (Array.isArray(zones) && zones.length > 0) return zones;
    }
  } catch {
    // fall through to the safe default below
  }
  return [fallback];
}

/**
 * Node's bundled ICU data can differ in version from a browser's, so
 * Intl.supportedValuesOf("timeZone") and even resolvedOptions().timeZone
 * can return different content/order server-side vs. client-side — calling
 * either directly during a Client Component's initial (SSR'd) render
 * causes a hydration mismatch. These hooks defer both to a post-mount
 * effect, so the server-rendered output and the first client render are
 * always identical, and the real values populate right after.
 */
export function useDetectedTimezone(): { timezone: string; detected: boolean; ready: boolean } {
  const [state, setState] = useState({ timezone: "UTC", detected: false, ready: false });

  useEffect(() => {
    setState({ ...detectTimezone(), ready: true });
  }, []);

  return state;
}

export interface TimezoneOption {
  value: string;
  label: string;
}

function formatTimezoneLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value;
    // Intl labels this "GMT+5:30" by convention; UTC is the correct
    // standard term for this kind of offset display.
    return offset ? `${tz} (${offset.replace("GMT", "UTC")})` : tz;
  } catch {
    return tz;
  }
}

export function useTimezoneOptions(fallback: string): TimezoneOption[] {
  const [zones, setZones] = useState<TimezoneOption[]>([{ value: fallback, label: fallback }]);

  useEffect(() => {
    setZones(listTimezones(fallback).map((tz) => ({ value: tz, label: formatTimezoneLabel(tz) })));
    // Intentionally mount-only — `fallback` only matters as the safety net
    // when detection fails entirely, not something later changes should
    // re-trigger a recompute for.
  }, []);

  return zones;
}
