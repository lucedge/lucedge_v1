"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { resendVerificationAction } from "@/app/(auth)/actions";

type ViewState = "loading" | "sent" | "expired" | "verified" | "no-session";

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function VerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<ViewState>("loading");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const check = async () => {
      if (params.get("error") === "link_invalid") {
        setState("expired");
        return;
      }

      const { data: { user } } = await supabase().auth.getUser();
      if (!user) {
        setState("no-session");
        return;
      }

      setEmail(user.email ?? "");
      setState(user.email_confirmed_at ? "verified" : "sent");
    };

    check();
  }, [params]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    setResending(true);
    setMessage("");
    const result = await resendVerificationAction(email);
    setResending(false);

    if ("error" in result && result.error) {
      setMessage(result.error);
      if (result.waitSeconds) setCooldown(result.waitSeconds);
      return;
    }
    setMessage("Verification email sent.");
    setCooldown(60);
  };

  if (state === "loading") return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "0 24px",
        textAlign: "center",
        background: "var(--surface-0)",
        color: "var(--fg-1)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {state === "no-session" && (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Sign in to continue</h1>
          <p style={{ color: "var(--fg-3)", fontSize: 14, maxWidth: 380 }}>
            You need to be signed in to verify an email address.
          </p>
          <button onClick={() => router.push("/sign-up?mode=signin")} style={ctaStyle}>
            Go to sign in
          </button>
        </>
      )}

      {state === "expired" && (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>This link is no longer valid</h1>
          <p style={{ color: "var(--fg-3)", fontSize: 14, maxWidth: 380 }}>
            The verification link expired or was already used. Send a new one below.
          </p>
        </>
      )}

      {(state === "sent" || state === "expired") && email && (
        <>
          {state === "sent" && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700 }}>Check your inbox</h1>
              <p style={{ color: "var(--fg-3)", fontSize: 14, maxWidth: 380 }}>
                We sent a verification link to <span style={{ color: "var(--fg-2)", fontWeight: 500 }}>{email}</span>.
                Click it to activate your account.
              </p>
            </>
          )}
          <button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            style={{ ...ctaStyle, opacity: resending || cooldown > 0 ? 0.6 : 1 }}
          >
            {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
          </button>
          {message && <p style={{ color: "var(--fg-3)", fontSize: 13 }}>{message}</p>}
        </>
      )}

      {state === "verified" && (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Email verified</h1>
          <p style={{ color: "var(--fg-3)", fontSize: 14 }}>You're all set.</p>
          <button onClick={() => router.push("/dashboard")} style={ctaStyle}>
            Continue to app
          </button>
        </>
      )}
    </div>
  );
}

const ctaStyle: React.CSSProperties = {
  height: 44,
  padding: "0 20px",
  background: "var(--brand-blue)",
  border: "none",
  borderRadius: "var(--radius-md)",
  color: "#fff",
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
