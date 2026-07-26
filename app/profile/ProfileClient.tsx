"use client";

import { useState } from "react";
import Link from "next/link";
import {
  updateProfileAction,
  changePasswordAction,
  signOutOtherSessionsAction,
  updateConsentAction,
} from "@/app/(auth)/actions";
import { isPass } from "@/lib/auth/validators";
import { useTimezoneOptions, type TimezoneOption } from "@/lib/timezone";
import { inputSx } from "@/lib/auth/inputSx";
import { FieldWrap } from "@/components/auth/FieldWrap";
import { Spinner, EyeShow, EyeHide } from "@/components/auth/icons";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"];

interface SessionRow {
  device: string;
  ip: string;
  when: string;
}

interface Props {
  email: string;
  displayName: string;
  timezone: string;
  currency: string;
  sessions: SessionRow[];
  marketingOptIn: boolean;
}

export function ProfileClient({ email, displayName, timezone, currency, sessions, marketingOptIn }: Props) {
  const timezones = useTimezoneOptions(timezone);

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        padding: "48px 24px",
        background: "var(--surface-0)",
        color: "var(--fg-1)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em" }}>Profile & account</h1>
          <Link href="/dashboard" style={{ fontSize: 13, color: "var(--fg-3)" }}>
            ← Back
          </Link>
        </div>

        <ProfileSection
          email={email}
          initialDisplayName={displayName}
          initialTimezone={timezone}
          initialCurrency={currency}
          timezones={timezones}
        />

        <div style={{ height: 36 }} />

        <SecuritySection />

        <div style={{ height: 36 }} />

        <SessionsSection sessions={sessions} />

        <div style={{ height: 36 }} />

        <EmailPreferencesSection initialOptIn={marketingOptIn} />

        <div style={{ height: 36 }} />

        <section>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--loss)", marginBottom: 10 }}>Danger zone</h2>
          <Link
            href="/profile/delete"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 40,
              padding: "0 18px",
              background: "transparent",
              border: "1px solid var(--loss)",
              borderRadius: "var(--radius-md)",
              color: "var(--loss)",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Delete account
          </Link>
        </section>
      </div>
    </div>
  );
}

function ProfileSection({
  email,
  initialDisplayName,
  initialTimezone,
  initialCurrency,
  timezones,
}: {
  email: string;
  initialDisplayName: string;
  initialTimezone: string;
  initialCurrency: string;
  timezones: TimezoneOption[];
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [tz, setTz] = useState(initialTimezone);
  const [currency, setCurrency] = useState(initialCurrency);
  const [status, setStatus] = useState<"default" | "saving" | "saved">("default");
  const [error, setError] = useState("");

  const save = async () => {
    setStatus("saving");
    setError("");
    const result = await updateProfileAction({ displayName, timezone: tz, currency });
    if (result.error) {
      setStatus("default");
      setError(result.error);
      return;
    }
    setStatus("saved");
    setTimeout(() => setStatus("default"), 2000);
  };

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-2)", marginBottom: 14 }}>Profile</h2>

      <label style={{ fontSize: 12, color: "var(--fg-3)", display: "block", marginBottom: 6 }}>Email</label>
      <input value={email} disabled style={{ ...inputSx(), opacity: 0.6, marginBottom: 14 }} />

      <label style={{ fontSize: 12, color: "var(--fg-3)", display: "block", marginBottom: 6 }}>Display name</label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Your name"
        style={{ ...inputSx(), marginBottom: 14 }}
      />

      <label style={{ fontSize: 12, color: "var(--fg-3)", display: "block", marginBottom: 6 }}>Timezone</label>
      <select value={tz} onChange={(e) => setTz(e.target.value)} style={{ ...inputSx(), appearance: "auto", marginBottom: 14 }}>
        {!timezones.some((z) => z.value === tz) && <option value={tz}>{tz}</option>}
        {timezones.map((z) => (
          <option key={z.value} value={z.value}>{z.label}</option>
        ))}
      </select>

      <label style={{ fontSize: 12, color: "var(--fg-3)", display: "block", marginBottom: 6 }}>Display currency</label>
      <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...inputSx(), appearance: "auto" }}>
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--loss)" }}>{error}</div>}

      <button
        onClick={save}
        disabled={status === "saving"}
        style={{
          marginTop: 16,
          height: 40,
          padding: "0 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: "var(--brand-blue)",
          border: "none",
          borderRadius: "var(--radius-md)",
          color: "#fff",
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          fontSize: 14,
          cursor: status === "saving" ? "default" : "pointer",
          opacity: status === "saving" ? 0.7 : 1,
        }}
      >
        {status === "saving" && <Spinner />}
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save changes"}
      </button>
    </section>
  );
}

function PasswordField({
  placeholder,
  value,
  onChange,
  marginBottom,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  marginBottom?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <FieldWrap>
      <div style={{ position: "relative", marginBottom }}>
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputSx(undefined, { paddingRight: 38 })}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          style={{
            position: "absolute",
            right: 11,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "var(--fg-3)",
            cursor: "pointer",
            display: "flex",
            padding: 3,
          }}
        >
          {show ? <EyeShow /> : <EyeHide />}
        </button>
      </div>
    </FieldWrap>
  );
}

function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"default" | "saving" | "saved">("default");
  const [error, setError] = useState("");

  const canSubmit = currentPassword.length > 0 && isPass(newPassword) && newPassword === confirm;

  const save = async () => {
    if (!canSubmit) return;
    setStatus("saving");
    setError("");
    const result = await changePasswordAction(currentPassword, newPassword);
    if (result.error) {
      setStatus("default");
      setError(result.error);
      return;
    }
    setStatus("saved");
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  };

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-2)", marginBottom: 14 }}>Security</h2>

      {status === "saved" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            background: "var(--win-soft)",
            border: "1px solid var(--win)",
            borderRadius: "var(--radius-md)",
            marginBottom: 14,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--win)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m20 6-11 11-5-5" />
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>Password updated</div>
            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
              You've been signed out of every other session. A confirmation email is on its way.
            </div>
          </div>
        </div>
      ) : (
        <>
          <PasswordField placeholder="Current password" value={currentPassword} onChange={setCurrentPassword} marginBottom={9} />
          <PasswordField placeholder="New password" value={newPassword} onChange={setNewPassword} marginBottom={9} />
          <PasswordField placeholder="Confirm new password" value={confirm} onChange={setConfirm} />

          {newPassword && !isPass(newPassword) && (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--fg-4)" }}>{newPassword.length}/10 characters minimum</div>
          )}
          {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--loss)" }}>{error}</div>}
        </>
      )}

      <button
        onClick={status === "saved" ? () => setStatus("default") : save}
        disabled={status === "saving" || (status === "default" && !canSubmit)}
        style={{
          marginTop: status === "saved" ? 0 : 16,
          height: 40,
          padding: "0 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: status === "saved" ? "var(--surface-2)" : canSubmit ? "var(--brand-blue)" : "var(--surface-2)",
          border: "none",
          borderRadius: "var(--radius-md)",
          color: status === "saved" ? "var(--fg-1)" : canSubmit ? "#fff" : "var(--fg-4)",
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          fontSize: 14,
          cursor: status === "saving" ? "default" : "pointer",
          opacity: status === "saving" ? 0.7 : 1,
        }}
      >
        {status === "saving" && <Spinner />}
        {status === "saving" ? "Saving…" : status === "saved" ? "Change it again" : "Change password"}
      </button>
    </section>
  );
}

function SessionsSection({ sessions }: { sessions: SessionRow[] }) {
  const [status, setStatus] = useState<"default" | "saving" | "saved">("default");
  const [error, setError] = useState("");

  const revokeOthers = async () => {
    setStatus("saving");
    setError("");
    const result = await signOutOtherSessionsAction();
    if (result.error) {
      setStatus("default");
      setError(result.error);
      return;
    }
    setStatus("saved");
    setTimeout(() => setStatus("default"), 3000);
  };

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-2)", marginBottom: 6 }}>Sessions</h2>
      <p style={{ fontSize: 12, color: "var(--fg-4)", marginBottom: 14 }}>
        Devices that have recently signed in, showing when each was last used. We can't revoke one
        specific session individually — only sign out everywhere else at once.
      </p>

      {sessions.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--fg-3)", marginBottom: 14 }}>No sign-ins recorded yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {sessions.map((s, i) => (
            <div
              key={i}
              style={{
                padding: "10px 12px",
                background: "var(--surface-1)",
                border: "1px solid var(--border-1)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 500 }}>{s.device}</div>
              <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 2 }}>
                {s.ip} · Last used {s.when}
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "saved" && (
        <div style={{ marginBottom: 10, fontSize: 12, color: "var(--win)" }}>
          Done — every other session has been signed out.
        </div>
      )}
      {error && <div style={{ marginBottom: 10, fontSize: 12, color: "var(--loss)" }}>{error}</div>}

      <button
        onClick={revokeOthers}
        disabled={status === "saving"}
        style={{
          height: 40,
          padding: "0 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: "var(--surface-2)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius-md)",
          color: "var(--fg-1)",
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          fontSize: 14,
          cursor: status === "saving" ? "default" : "pointer",
          opacity: status === "saving" ? 0.7 : 1,
        }}
      >
        {status === "saving" && <Spinner />}
        {status === "saving" ? "Signing out…" : "Sign out of every other session"}
      </button>
    </section>
  );
}

function EmailPreferencesSection({ initialOptIn }: { initialOptIn: boolean }) {
  const [optIn, setOptIn] = useState(initialOptIn);
  const [status, setStatus] = useState<"default" | "saving" | "saved">("default");
  const [error, setError] = useState("");

  const toggle = async () => {
    const next = !optIn;
    setOptIn(next);
    setStatus("saving");
    setError("");
    const result = await updateConsentAction("marketing", next);
    if (result.error) {
      setOptIn(!next);
      setStatus("default");
      setError(result.error);
      return;
    }
    setStatus("saved");
    setTimeout(() => setStatus("default"), 2000);
  };

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-2)", marginBottom: 14 }}>Email preferences</h2>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          background: "var(--surface-1)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 500 }}>Product updates and tips</div>
          <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 2 }}>Occasional email, unrelated to account security</div>
        </div>
        <input
          type="checkbox"
          checked={optIn}
          onChange={toggle}
          disabled={status === "saving"}
          style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--brand-blue)" }}
        />
      </label>

      {status === "saved" && <div style={{ marginTop: 10, fontSize: 12, color: "var(--win)" }}>Saved.</div>}
      {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--loss)" }}>{error}</div>}
    </section>
  );
}
