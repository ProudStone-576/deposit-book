import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { cityTotals, ownerMonth } from "@/lib/queries";
import { monthKey, monthLabel, todayYmd } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { AppShell, PageHead } from "@/components/AppShell";
import { MonthNav } from "@/components/MonthNav";
import { OwnerCalendar } from "@/components/OwnerCalendar";
import { Legend } from "@/components/Legend";
import { Stat } from "@/components/Stat";
import { BackupStatus } from "@/components/BackupStatus";

export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireOwner();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "")
    ? sp.month!
    : monthKey(todayYmd());

  const [{ days, summary, stores }, cities] = await Promise.all([
    ownerMonth(month),
    cityTotals(month),
  ]);

  return (
    <AppShell session={session} width="wide">
      <PageHead
        eyebrow="Company Admin"
        title="All stores"
        meta={
          <>
            {stores.length} stores across {cities.length} cities &middot;{" "}
            {monthLabel(month)}
          </>
        }
      />

      <BackupStatus />

      {summary.missing > 0 && (
        <a href="#by-city" className="notice notice-miss block">
          {summary.missing} store-day{summary.missing === 1 ? "" : "s"} this month
          with no deposit filed.
        </a>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Month total" value={fmt(summary.totalCents)} tone="accent" />
        <Stat label="Deposits filed" value={String(summary.filed)} tone="ok" />
        <Stat label="Expected to date" value={String(summary.expected)} />
        <Stat label="Missing" value={String(summary.missing)} tone="miss" />
      </div>

      <section className="card">
        <MonthNav month={month} basePath="/owner" />
        <div className="space-y-4 p-3.5">
          <OwnerCalendar days={days} />
          <div className="space-y-3 border-t border-line pt-3">
            <Legend />
            <p className="hint">
              A green tick means every store that was due to deposit did.
              Otherwise the day shows{" "}
              <span className="money font-bold">filed / expected</span> &mdash;
              select it to see which store is short.
            </p>
          </div>
        </div>
      </section>

      <section id="by-city" className="space-y-3 pt-1">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">By city</h2>
        {cities.map((c) => (
          <div key={c.city} className="card overflow-hidden">
            <div className="panel-head">
              <span className="text-sm font-extrabold">{c.city}</span>
              <span className="money text-sm font-extrabold text-accent">
                {fmt(c.totalCents)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="dtable w-full min-w-[34rem]">
                <thead>
                  <tr>
                    <th>Store</th>
                    <th className="text-right!">Month total</th>
                    <th className="text-right!">Filed</th>
                    <th className="text-right!">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {c.stores.map((r) => (
                    <tr key={r.store.id}>
                      <td>
                        <Link
                          href={`/owner/store/${r.store.id}?month=${month}`}
                          className="font-semibold text-accent hover:underline"
                        >
                          <span className="money">{r.store.storeNumber}</span>{" "}
                          &middot; {r.store.name}
                        </Link>
                      </td>
                      <td className="money text-right! font-bold">
                        {fmt(r.totalCents)}
                      </td>
                      <td className="money text-right! text-ink2">
                        {r.filedDays}/{r.expectedDays}
                      </td>
                      <td
                        className={`money text-right! font-bold ${
                          r.missedDays > 0 ? "text-miss" : "text-ink3"
                        }`}
                      >
                        {r.missedDays > 0 ? r.missedDays : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
