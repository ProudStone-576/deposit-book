import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { ownerDay } from "@/lib/queries";
import { isYmd, longDate, monthKey } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { AppShell, PageHead } from "@/components/AppShell";
import { Stat } from "@/components/Stat";

const STATE_BADGE: Record<string, { text: string; cls: string }> = {
  filed: { text: "Filed", cls: "bg-okbg text-ok" },
  missed: { text: "Missing", cls: "bg-missbg text-miss" },
  due: { text: "Due today", cls: "bg-duebg text-due" },
  off: { text: "Closed", cls: "bg-surface3 text-ink3" },
  future: { text: "—", cls: "bg-surface3 text-ink3" },
};

export default async function OwnerDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const session = await requireOwner();
  const { date } = await params;
  if (!isYmd(date)) notFound();

  const { rows, totalCents, filed, expected } = await ownerDay(date);

  return (
    <AppShell session={session} width="wide">
      <Link href={`/owner?month=${monthKey(date)}`} className="backlink">
        <span aria-hidden>‹</span> Calendar
      </Link>

      <PageHead eyebrow="Company Admin" title={longDate(date)} />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Day total" value={fmt(totalCents)} tone="accent" />
        <Stat label="Filed" value={`${filed}/${expected}`} tone="ok" />
        <Stat
          label="Missing"
          value={String(Math.max(0, expected - filed))}
          tone="miss"
        />
      </div>

      <section className="card overflow-hidden">
        <div className="panel-head">
          <span className="panel-title">Every store, this date</span>
        </div>
        <div className="overflow-x-auto">
          <table className="dtable w-full min-w-[32rem]">
            <thead>
              <tr>
                <th>Store</th>
                <th>City</th>
                <th className="text-right!">Amount</th>
                <th className="text-right!">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const badge = STATE_BADGE[r.state];
                const active = r.deposits.filter((d) => d.status === "ACTIVE");
                return (
                  <tr key={r.store.id}>
                    <td>
                      <Link
                        href={`/owner/store/${r.store.id}?month=${monthKey(date)}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        <span className="money">{r.store.storeNumber}</span>{" "}
                        &middot; {r.store.name}
                      </Link>
                      {active.length > 1 && (
                        <span className="ml-2 text-xs text-ink3">
                          {active.length} drops
                        </span>
                      )}
                      {r.deposits.some((d) => d.status === "VOIDED") && (
                        <span className="ml-2 text-xs font-bold text-miss">
                          voided entry
                        </span>
                      )}
                    </td>
                    <td className="text-ink2">{r.store.city}</td>
                    <td className="money text-right! font-bold">
                      {r.state === "filed" ? fmt(r.totalCents) : "—"}
                    </td>
                    <td className="text-right!">
                      <span className={`chip ${badge.cls}`}>{badge.text}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2 pt-1">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">
          Deposit detail
        </h2>
        {rows.flatMap((r) =>
          r.deposits.map((d) => (
            <Link
              key={d.id}
              href={`/deposit/${d.id}`}
              className="card flex items-center gap-3 px-4 py-3 hover:border-accent"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">
                  <span className="money">{r.store.storeNumber}</span> &middot;{" "}
                  {r.store.name}
                </div>
                <div className="text-xs text-ink3">
                  {d.enteredBy.name} &middot;{" "}
                  {new Date(d.createdAt).toLocaleTimeString("en-CA", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {d.bagNumber ? ` · Bag ${d.bagNumber}` : ""}
                </div>
              </div>
              {d.status === "VOIDED" && (
                <span className="chip bg-missbg text-miss">Voided</span>
              )}
              <span
                className={`money font-extrabold ${
                  d.status === "VOIDED" ? "text-ink3 line-through" : ""
                }`}
              >
                {fmt(d.totalCents)}
              </span>
            </Link>
          )),
        )}
        {rows.every((r) => r.deposits.length === 0) && (
          <p className="notice notice-quiet">Nothing filed for this date yet.</p>
        )}
      </section>
    </AppShell>
  );
}
