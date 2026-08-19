import Link from "next/link";
import { bookSummary } from "@/lib/export";
import { fmt } from "@/lib/money";

/**
 * What protects the book, stated where the Company Admin will see it. Neon
 * keeps continuous point-in-time restore; the export is the copy that survives
 * losing the Neon account itself.
 */
export async function DataProtection() {
  const s = await bookSummary();

  return (
    <section className="card">
      <div className="panel-head">
        <span className="panel-title">Records</span>
        <Link
          href="/owner/export"
          prefetch={false}
          className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-accent hover:underline"
        >
          Download CSV
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-xs text-ink2">
        <span>
          <b className="money text-ink">{s.deposits}</b> deposits on file
          {s.voided > 0 && (
            <span className="text-ink3"> &middot; {s.voided} voided</span>
          )}
        </span>
        <span>
          <b className="money text-ink">{fmt(s.totalCents)}</b> recorded
        </span>
        <span>
          Latest <b className="money text-ink">{s.latestDate ?? "none yet"}</b>
        </span>
        <span className="text-ink3">
          Continuous point-in-time restore is kept by the database provider.
          Download a CSV monthly to hold a copy of your own.
        </span>
      </div>
    </section>
  );
}
