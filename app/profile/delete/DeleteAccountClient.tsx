"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestAccountDeletionAction, restoreAccountAction } from "@/app/(auth)/actions";
import { inputSx } from "@/lib/auth/inputSx";
import { Spinner } from "@/components/auth/icons";

const CONFIRM_TEXT = "DELETE";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "long" });
}

export function DeleteAccountClient({ scheduledFor }: { scheduledFor: string | null }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [scheduled, setScheduled] = useState(scheduledFor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = confirmText === CONFIRM_TEXT;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    const result = await requestAccountDeletionAction();
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setScheduled(result.expiresAt ?? new Date().toISOString());
  };

  const restore = async () => {
    setLoading(true);
    setError("");
    const result = await restoreAccountAction();
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
  };

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
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em" }}>Delete account</h1>
          <Link href="/profile" style={{ fontSize: 13, color: "var(--fg-3)" }}>
            ← Back
          </Link>
        </div>

        {scheduled ? (
          <div>
            <div
              style={{
                padding: "16px 18px",
                background: "var(--surface-1)",
                border: "1px solid var(--border-2)",
                borderRadius: "var(--radius-md)",
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)", marginBottom: 6 }}>
                Deletion scheduled for {formatDate(scheduled)}
              </div>
              <div style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: "19px" }}>
                Your account is locked until then. Nothing is permanently erased yet — you can restore it
                any time before that date by signing in and clicking below.
              </div>
            </div>

            {error && <div style={{ marginBottom: 12, fontSize: 12, color: "var(--loss)" }}>{error}</div>}

            <button
              onClick={restore}
              disabled={loading}
              style={{
                height: 44,
                width: "100%",
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
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading && <Spinner />}
              {loading ? "Restoring…" : "Restore my account"}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: "20px", marginBottom: 8 }}>
              This schedules your account for deletion in 30 days. You'll be signed out of every other
              device immediately, and can restore your account any time in that window by coming back here.
            </p>
            <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: "20px", marginBottom: 20 }}>
              After 30 days this cannot be undone.
            </p>

            <label style={{ fontSize: 12, color: "var(--fg-3)", display: "block", marginBottom: 6 }}>
              Type <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>{CONFIRM_TEXT}</span> to confirm
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_TEXT}
              style={inputSx()}
            />

            {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--loss)" }}>{error}</div>}

            <button
              onClick={submit}
              disabled={!canSubmit || loading}
              style={{
                marginTop: 16,
                height: 44,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: canSubmit ? "var(--loss)" : "var(--surface-2)",
                border: "none",
                borderRadius: "var(--radius-md)",
                color: canSubmit ? "#fff" : "var(--fg-4)",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: 14,
                cursor: canSubmit && !loading ? "pointer" : "default",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading && <Spinner />}
              {loading ? "Scheduling…" : "Delete my account"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
