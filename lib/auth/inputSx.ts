import type { CSSProperties } from "react";

export function inputSx(error?: string, extra: CSSProperties = {}): CSSProperties {
  return {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 13px",
    background: "var(--surface-0)",
    border: `1.5px solid ${error ? "var(--loss)" : "var(--border-2)"}`,
    borderRadius: "var(--radius-md)",
    color: "var(--fg-1)",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    outline: "none",
    transition: "border-color var(--t-fast)",
    ...extra,
  };
}
