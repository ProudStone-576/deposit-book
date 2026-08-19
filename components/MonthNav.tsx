import Link from "next/link";
import { monthLabel, shiftMonth } from "@/lib/dates";

export function MonthNav({ month, basePath }: { month: string; basePath: string }) {
  return (
    <div className="panel-head">
      <Link
        href={`${basePath}?month=${shiftMonth(month, -1)}`}
        aria-label="Previous month"
        className="flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] border border-linestrong bg-surface text-ink2 hover:border-accent hover:text-accent"
      >
        <span aria-hidden>‹</span>
      </Link>
      <div className="text-sm font-extrabold tracking-[-0.01em]">
        {monthLabel(month)}
      </div>
      <Link
        href={`${basePath}?month=${shiftMonth(month, 1)}`}
        aria-label="Next month"
        className="flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] border border-linestrong bg-surface text-ink2 hover:border-accent hover:text-accent"
      >
        <span aria-hidden>›</span>
      </Link>
    </div>
  );
}
