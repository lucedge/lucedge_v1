import Link from "next/link";
import { BackSvg } from "./icons";

export function BrandPanel() {
  return (
    <div style={{
      background: "var(--surface-0)",
      borderRight: "1px solid var(--border-1)",
      padding: "44px 32px",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <img src="/assets/mark.svg" style={{ width: 28, height: 28, objectFit: "contain" }} alt="" />
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.02em", color: "var(--fg-1)" }}>
          LuceEdge
        </span>
      </div>
      <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 28px", lineHeight: "19px" }}>
        Discipline log for serious traders.
      </p>

      {/* Live nudge mockup */}
      <div style={{ padding: "16px", background: "var(--surface-2)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-2)", marginBottom: 22 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--pat-watch)", marginBottom: 7 }}>
          Soft nudge · Off-Playbook Entry
        </div>
        <div style={{ fontSize: 13, color: "var(--fg-1)", lineHeight: "19px", marginBottom: 11 }}>
          Your last 19 FOMO entries averaged{" "}
          <span style={{ color: "var(--loss-fg)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>–1.4R</span>.
        </div>
        <div style={{ height: 4, background: "var(--surface-3)", borderRadius: 9999, overflow: "hidden", marginBottom: 5 }}>
          <style>{`@keyframes nudgeCD{0%{width:100%}100%{width:0%}}`}</style>
          <div style={{ height: "100%", background: "var(--pat-watch)", borderRadius: 9999, animation: "nudgeCD 6s linear infinite" }} />
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
          Save available in 23s
        </div>
      </div>

      {/* Feature list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {FEATURES.map(([label, sub]) => (
          <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--brand-blue-soft)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 2 }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--brand-blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m20 6-11 11-5-5" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-1)", lineHeight: "18px" }}>{label}</div>
              <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 1 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid var(--border-1)" }}>
        <div style={{ fontSize: 12, color: "var(--fg-3)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
          2,400+ active traders
        </div>
        <Link href="/" style={{ fontSize: 12, color: "var(--fg-4)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <BackSvg /> Back to site
        </Link>
      </div>
    </div>
  );
}

const FEATURES = [
  ["8 pattern detectors",        "Runs silently on every save"],
  ["30s soft / 15min hard gates", "Calibrated friction, not blocking"],
  ["Weekly AI summary",           "Pro — your patterns in plain English"],
] as const;
