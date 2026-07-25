interface Props {
  step: number;
  total: number;
}

export function Dots({ step, total }: Props) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? 20 : 6,
            height: 6,
            borderRadius: 9999,
            background: i <= step ? "var(--brand-blue)" : "var(--border-2)",
            transition: "all .3s var(--ease)",
          }}
        />
      ))}
    </div>
  );
}
