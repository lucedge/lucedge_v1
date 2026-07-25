"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { isPass } from "@/lib/auth/validators";
import { inputSx } from "@/lib/auth/inputSx";
import { Spinner, EyeShow, EyeHide } from "@/components/auth/icons";
import { FieldWrap } from "@/components/auth/FieldWrap";
import { setNewPasswordAction } from "@/app/(auth)/actions";

type ViewState = "loading" | "form" | "invalid" | "done";

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function ResetContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<ViewState>("loading");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showP, setShowP] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (params.get("error") === "link_invalid") {
        setState((prev) => (prev === "done" ? prev : "invalid"));
        return;
      }
      const { data: { user } } = await supabase().auth.getUser();
      setState((prev) => (prev === "done" ? prev : user ? "form" : "invalid"));
    };
    check();
    // Deliberately run once on mount only. Re-running this on every `params`
    // reference change was clobbering the post-submit "done" state back to
    // "form", since the check has no way to distinguish "not yet reset" from
    // "just reset, still signed in" other than the state we're trying to protect.
  }, []);

  const canSubmit = isPass(pass) && pass === confirm;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    const result = await setNewPasswordAction(pass);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setState("done");
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
      {state === "invalid" && (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>This link is no longer valid</h1>
          <p style={{ color: "var(--fg-3)", fontSize: 14, maxWidth: 380 }}>
            Reset links expire after 60 minutes and can only be used once.
          </p>
          <button onClick={() => router.push("/sign-up?mode=signin")} style={ctaStyle}>
            Back to sign in
          </button>
        </>
      )}

      {state === "form" && (
        <div style={{ width: "100%", maxWidth: 360, textAlign: "left" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Set a new password</h1>
          <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 22 }}>
            This will sign you out everywhere else.
          </p>

          <FieldWrap>
            <div style={{ position: "relative" }}>
              <input
                type={showP ? "text" : "password"}
                placeholder="New password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                style={inputSx(undefined, { paddingRight: 38 })}
              />
              <button
                type="button"
                onClick={() => setShowP((v) => !v)}
                style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--fg-3)", cursor: "pointer", display: "flex", padding: 3 }}
              >
                {showP ? <EyeShow /> : <EyeHide />}
              </button>
            </div>
          </FieldWrap>

          <div style={{ height: 9 }} />

          <FieldWrap>
            <input
              type={showP ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={inputSx()}
            />
          </FieldWrap>

          {pass && !isPass(pass) && (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--fg-4)" }}>{pass.length}/10 characters minimum</div>
          )}
          {confirm && pass !== confirm && (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--loss)" }}>Passwords don't match</div>
          )}
          {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--loss)" }}>{error}</div>}

          <button
            onClick={submit}
            disabled={!canSubmit || loading}
            style={{
              marginTop: 14,
              width: "100%",
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: canSubmit ? "var(--brand-blue)" : "var(--surface-2)",
              border: "none",
              borderRadius: "var(--radius-md)",
              color: canSubmit ? "#fff" : "var(--fg-4)",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: 14,
              cursor: canSubmit && !loading ? "pointer" : "default",
            }}
          >
            {loading ? <Spinner /> : "Set new password"}
          </button>
        </div>
      )}

      {state === "done" && (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Password updated</h1>
          <p style={{ color: "var(--fg-3)", fontSize: 14 }}>You've been signed out everywhere else.</p>
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

export default function ResetPage() {
  return (
    <Suspense>
      <ResetContent />
    </Suspense>
  );
}
