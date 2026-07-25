interface Props {
  error?: string;
  children: React.ReactNode;
}

export function FieldWrap({ error, children }: Props) {
  return (
    <div>
      {children}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 12, color: "var(--loss)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
