"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { completeOnboardingAction } from "@/app/(auth)/actions";
import { useDetectedTimezone, useTimezoneOptions } from "@/lib/timezone";
import { inputSx } from "@/lib/auth/inputSx";
import { Spinner } from "@/components/auth/icons";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"];

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const detected = useDetectedTimezone();
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const timezones = useTimezoneOptions(timezone);

  useEffect(() => {
    if (detected.ready) setTimezone(detected.timezone);
  }, [detected.ready, detected.timezone]);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase().auth.getUser();
      if (!user) {
        router.replace("/sign-up?mode=signin");
        return;
      }
      if (!user.email_confirmed_at) {
        router.replace("/auth/verify");
        return;
      }
      setChecking(false);
    };
    check();
  }, [router]);

  const submit = async () => {
    setSaving(true);
    setError("");
    const result = await completeOnboardingAction(timezone, currency);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
  };

  if (checking) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        background: "var(--surface-0)",
        color: "var(--fg-1)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", marginBottom: 8 }}>
          Set your timezone
        </h1>
        <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: "20px", marginBottom: 8 }}>
          We use this to group your trades into the right sessions. We detected yours below — change it if it's wrong.
        </p>
        {detected.ready && !detected.detected && (
          <p style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: "18px", marginBottom: 18 }}>
            We couldn't auto-detect your timezone, so we defaulted to UTC. Please choose yours below.
          </p>
        )}
        {(!detected.ready || detected.detected) && <div style={{ marginBottom: 18 }} />}

        <label style={{ fontSize: 12, color: "var(--fg-3)", display: "block", marginBottom: 6 }}>Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={{ ...inputSx(), appearance: "auto" }}
        >
          {!timezones.some((z) => z.value === timezone) && <option value={timezone}>{timezone}</option>}
          {timezones.map((z) => (
            <option key={z.value} value={z.value}>{z.label}</option>
          ))}
        </select>

        <div style={{ height: 14 }} />

        <label style={{ fontSize: 12, color: "var(--fg-3)", display: "block", marginBottom: 6 }}>Display currency</label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          style={{ ...inputSx(), appearance: "auto" }}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--loss)" }}>{error}</div>}

        <button
          onClick={submit}
          disabled={saving}
          style={{
            marginTop: 20,
            width: "100%",
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--brand-blue)",
            border: "none",
            borderRadius: "var(--radius-md)",
            color: "#fff",
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: 14,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <Spinner /> : "Continue"}
        </button>
      </div>
    </div>
  );
}
