import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "var(--surface-0)",
        color: "var(--fg-1)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.02em" }}>LuceEdge</h1>
      <p style={{ color: "var(--fg-3)", fontSize: 14 }}>Fresh start. Auth scaffold is live.</p>
      <div style={{ display: "flex", gap: 16 }}>
        <Link href="/sign-up" style={{ color: "var(--brand-blue)", fontSize: 14, fontWeight: 600 }}>
          Sign up →
        </Link>
        <Link href="/sign-up?mode=signin" style={{ color: "var(--fg-3)", fontSize: 14 }}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
