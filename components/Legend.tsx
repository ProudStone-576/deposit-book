const ITEMS = [
  { cls: "day-filed", mark: "✓", tone: "text-ok", label: "Deposit filed" },
  { cls: "day-due day-flag", mark: "", tone: "text-due", label: "Due today" },
  { cls: "day-missed day-flag", mark: "", tone: "text-miss", label: "Not filed" },
  { cls: "day-closed", mark: "", tone: "text-ok", label: "Closed — none required" },
  { cls: "day-off", mark: "", tone: "text-ink3", label: "No deposit expected" },
];

export function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink2">
      {ITEMS.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span
            aria-hidden
            className={`day ${i.cls} ${i.tone} aspect-auto! h-6 w-6 text-[0.6875rem] font-black`}
          >
            {i.mark}
          </span>
          {i.label}
        </li>
      ))}
    </ul>
  );
}
