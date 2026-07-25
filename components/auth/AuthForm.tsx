"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { AuthMode } from "@/types/auth";
import { isEmail, isPass } from "@/lib/auth/validators";
import { inputSx } from "@/lib/auth/inputSx";
import { Spinner, GoogleLogo, EyeShow, EyeHide, BackSvg } from "./icons";
import { FieldWrap } from "./FieldWrap";
import { emailSignUpAction, emailSignInAction, requestPasswordResetAction } from "@/app/(auth)/actions";

interface Props {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
  onAuth: (redirect?: string) => void;
}

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AuthForm({ mode, setMode, onAuth }: Props) {
  const [email,      setEmail]      = useState("");
  const [pass,       setPass]       = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [showP,      setShowP]      = useState(false);
  const [showC,      setShowC]      = useState(false);
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [touched,    setTouched]    = useState<Record<string, boolean>>({});
  const [loading,    setLoading]    = useState(false);
  const [serverErr,  setServerErr]  = useState("");
  const [lockedUntil, setLockedUntil] = useState(0); // seconds remaining

  useEffect(() => {
    if (lockedUntil <= 0) return;
    const t = setTimeout(() => setLockedUntil((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lockedUntil]);

  const canSubmit = () => {
    if (mode === "forgot") return isEmail(email);
    if (lockedUntil > 0) return false;
    if (!isEmail(email) || !isPass(pass)) return false;
    if (mode === "signup" && pass !== confirm) return false;
    return true;
  };

  const submit = async () => {
    // Client-side validation first
    const e: Record<string, string> = {};
    if (!isEmail(email)) e.email = "Enter a valid email address";
    if (mode !== "forgot") {
      if (!isPass(pass)) e.pass = "Must be at least 10 characters";
      if (mode === "signup" && confirm && pass !== confirm) e.confirm = "Passwords don't match";
    }
    if (Object.keys(e).length) {
      setErrors(e);
      setTouched({ email: true, pass: true, confirm: true });
      return;
    }

    setLoading(true);
    setServerErr("");

    if (mode === "forgot") {
      await requestPasswordResetAction(email);
      setLoading(false);
      setMode("sent");
      return;
    }

    if (mode === "signup") {
      const result = await emailSignUpAction(email, pass);
      if (result.error) { setLoading(false); setServerErr(result.error); return; }
      // Establish the session in the browser so any follow-up Server
      // Actions can read the auth cookie via supabase.auth.getUser().
      if (result.session) {
        await supabase().auth.setSession(result.session);
      }
      setLoading(false);
      onAuth("/auth/verify");
      return;
    }

    if (mode === "signin") {
      const result = await emailSignInAction(email, pass);
      setLoading(false);
      if ("locked" in result && result.locked) {
        setLockedUntil(result.retryAfterSeconds);
        return;
      }
      if ("error" in result && result.error) { setServerErr(result.error); return; }
      onAuth("redirect" in result ? result.redirect : undefined);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setServerErr("Couldn't connect to Google. Try email or use a hotspot.");
      setLoading(false);
    }
    // On success the browser redirects — no need to setLoading(false)
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setErrors({});
    setTouched({});
    setPass("");
    setConfirm("");
    setServerErr("");
    setLockedUntil(0);
  };

  if (mode === "sent")   return <EmailSentScreen email={email} onBack={() => switchMode("signin")} />;
  if (mode === "forgot") return <ForgotScreen email={email} setEmail={setEmail} loading={loading} onSubmit={submit} onBack={() => switchMode("signin")} />;

  return (
    <div className="auth-form-body" style={{ minHeight: 480, display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--fg-1)", letterSpacing: "-.02em", marginBottom: 22 }}>
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "var(--surface-0)", borderRadius: "var(--radius-md)", padding: 3, marginBottom: 18, border: "1px solid var(--border-1)" }}>
        {(["signup", "signin"] as const).map((m) => (
          <button key={m} onClick={() => switchMode(m)} style={{
            flex: 1, height: 34, border: "none", cursor: "pointer",
            borderRadius: "calc(var(--radius-md) - 2px)",
            background: mode === m ? "var(--surface-2)" : "transparent",
            color: mode === m ? "var(--fg-1)" : "var(--fg-3)",
            fontFamily: "var(--font-sans)", fontWeight: mode === m ? 600 : 400, fontSize: 13,
            transition: "all var(--t-fast)",
          }}>
            {m === "signup" ? "Sign up" : "Sign in"}
          </button>
        ))}
      </div>

      {/* Google */}
      <button onClick={handleGoogle} disabled={loading} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
        height: 44, width: "100%", background: "#fff", border: "none",
        borderRadius: "var(--radius-md)", cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "#1a1a1a",
        boxShadow: "0 2px 6px rgba(0,0,0,.18)", marginBottom: 16, opacity: loading ? 0.6 : 1,
      }}>
        <GoogleLogo /> Continue with Google
      </button>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: "var(--border-1)" }} />
        <span style={{ fontSize: 12, color: "var(--fg-4)", letterSpacing: ".05em" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "var(--border-1)" }} />
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <FieldWrap error={touched.email ? errors.email : undefined}>
          <input type="email" placeholder="Email address" value={email}
            onChange={e => { setEmail(e.target.value); setErrors(v => ({ ...v, email: "" })); setServerErr(""); }}
            onBlur={() => setTouched(t => ({ ...t, email: true }))}
            style={inputSx(touched.email ? errors.email : undefined)}
          />
        </FieldWrap>

        <FieldWrap error={touched.pass ? errors.pass : undefined}>
          <div style={{ position: "relative" }}>
            <input type={showP ? "text" : "password"} placeholder="Password" value={pass}
              onChange={e => { setPass(e.target.value); setErrors(v => ({ ...v, pass: "", confirm: "" })); setServerErr(""); }}
              onBlur={() => setTouched(t => ({ ...t, pass: true }))}
              style={inputSx(touched.pass ? errors.pass : undefined, { paddingRight: 38 })}
            />
            <button type="button" onClick={() => setShowP(v => !v)} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--fg-3)", cursor: "pointer", display: "flex", padding: 3 }}>
              {showP ? <EyeShow /> : <EyeHide />}
            </button>
          </div>
        </FieldWrap>

        {mode === "signup" && (
          <FieldWrap error={touched.confirm ? errors.confirm : undefined}>
            <div style={{ position: "relative" }}>
              <input type={showC ? "text" : "password"} placeholder="Confirm password" value={confirm}
                onChange={e => { setConfirm(e.target.value); setErrors(v => ({ ...v, confirm: "" })); }}
                onBlur={() => setTouched(t => ({ ...t, confirm: true }))}
                style={inputSx(touched.confirm ? errors.confirm : undefined, { paddingRight: 38 })}
              />
              <button type="button" onClick={() => setShowC(v => !v)} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--fg-3)", cursor: "pointer", display: "flex", padding: 3 }}>
                {showC ? <EyeShow /> : <EyeHide />}
              </button>
            </div>
          </FieldWrap>
        )}

        {mode === "signin" && (
          <div style={{ textAlign: "right", marginTop: -3 }}>
            <button onClick={() => switchMode("forgot")} style={{ background: "none", border: "none", color: "var(--brand-blue)", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)", padding: 0 }}>
              Forgot password?
            </button>
          </div>
        )}
      </div>

      {mode === "signup" && pass && !isPass(pass) && (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--fg-4)" }}>{pass.length}/10 characters minimum</div>
      )}

      {lockedUntil > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--loss)", textAlign: "center" }}>
          Too many attempts. Try again in {formatCountdown(lockedUntil)}, or{" "}
          <button onClick={() => switchMode("forgot")} style={{ background: "none", border: "none", color: "var(--brand-blue)", cursor: "pointer", padding: 0, font: "inherit" }}>
            reset your password
          </button>.
        </div>
      )}

      {serverErr && lockedUntil === 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--loss)", textAlign: "center" }}>{serverErr}</div>
      )}

      <button onClick={submit} disabled={loading || lockedUntil > 0} style={{
        marginTop: 14, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
        background: canSubmit() ? "var(--brand-blue)" : "var(--surface-2)",
        border: "none", borderRadius: "var(--radius-md)",
        color: canSubmit() ? "#fff" : "var(--fg-4)",
        fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14,
        cursor: canSubmit() && !loading ? "pointer" : "default", transition: "all var(--t-fast)",
      }}>
        {loading ? <Spinner /> : mode === "signup" ? "Create account" : "Sign in"}
      </button>

      {mode === "signup" && (
        <div style={{ marginTop: 14, fontSize: 11, color: "var(--fg-4)", textAlign: "center", lineHeight: "17px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          By continuing you agree to our{" "}
          <span style={{ color: "var(--fg-3)" }}>Terms</span>{" "}&amp;{" "}
          <span style={{ color: "var(--fg-3)" }}>Privacy Policy</span>
        </div>
      )}
    </div>
  );
}

function ForgotScreen({ email, setEmail, loading, onSubmit, onBack }: {
  email: string; setEmail: (v: string) => void;
  loading: boolean; onSubmit: () => void; onBack: () => void;
}) {
  return (
    <div className="auth-form-body" style={{ minHeight: 480, display: "flex", flexDirection: "column" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--fg-3)", fontFamily: "var(--font-sans)", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 28, alignSelf: "flex-start" }}>
        <BackSvg /> Back
      </button>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--fg-1)", letterSpacing: "-.02em", marginBottom: 8 }}>Reset your password</div>
      <div style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: "20px", marginBottom: 26 }}>Enter your email and we&apos;ll send you a reset link.</div>
      <input type="email" placeholder="Email address" value={email}
        onChange={e => setEmail(e.target.value)}
        style={inputSx()}
      />
      <button onClick={onSubmit} style={{
        marginTop: 14, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
        background: isEmail(email) ? "var(--brand-blue)" : "var(--surface-2)",
        border: "none", borderRadius: "var(--radius-md)",
        color: isEmail(email) ? "#fff" : "var(--fg-4)",
        fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14,
        cursor: isEmail(email) ? "pointer" : "default", transition: "all var(--t-fast)",
      }}>
        {loading ? <Spinner /> : "Send reset link"}
      </button>
    </div>
  );
}

function EmailSentScreen({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="auth-form-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 480 }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--win-soft)", display: "grid", placeItems: "center", marginBottom: 18 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--win)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m20 6-11 11-5-5" />
        </svg>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--fg-1)", letterSpacing: "-.02em", marginBottom: 9 }}>Check your inbox</div>
      <div style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: "21px", marginBottom: 28 }}>
        If an account exists for<br /><span style={{ color: "var(--fg-2)", fontWeight: 500 }}>{email}</span>, a reset link is on its way.
      </div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--brand-blue)", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
        ← Back to sign in
      </button>
    </div>
  );
}
