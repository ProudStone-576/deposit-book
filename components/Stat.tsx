export function Stat({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "plain" | "ok" | "miss" | "due" | "accent";
}) {
  const color =
    tone === "ok"
      ? "text-ok"
      : tone === "miss"
        ? "text-miss"
        : tone === "due"
          ? "text-due"
          : tone === "accent"
            ? "text-accent"
            : "text-ink";

  return (
    <div className="card px-3.5 py-3">
      <div className="eyebrow">{label}</div>
      <div className={`money mt-1 text-xl font-extrabold leading-none ${color}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[0.6875rem] text-ink3">{sub}</div>}
    </div>
  );
}
