import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { depositsForStoreDay } from "@/lib/queries";
import { isYmd, longDate, monthKey, todayYmd } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { AppShell, PageHead } from "@/components/AppShell";
import { DepositCard } from "@/components/DepositCard";

export default async function ManagerDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const session = await requireSession();
  const { date } = await params;
  if (!isYmd(date)) notFound();
  if (!session.storeId) notFound();

  const deposits = await depositsForStoreDay(session.storeId, date);
  const active = deposits.filter((d) => d.status === "ACTIVE");
  const total = active.reduce((s, d) => s + d.totalCents, 0);
  const isFuture = date > todayYmd();

  return (
    <AppShell session={session}>
      <Link href={`/dashboard?month=${monthKey(date)}`} className="backlink">
        <span aria-hidden>‹</span> Calendar
      </Link>

      <PageHead
        eyebrow={`Store ${session.storeNumber} · ${session.storeName}`}
        title={longDate(date)}
        actions={
          !isFuture ? (
            <Link href={`/deposit/new?date=${date}`} className="btn btn-primary">
              {active.length > 0 ? "Add deposit" : "File deposit"}
            </Link>
          ) : undefined
        }
      />

      {active.length > 0 ? (
        <div className="card px-4 py-3">
          <div className="eyebrow">Day total</div>
          <div className="money mt-1 text-2xl font-extrabold text-accent">
            {fmt(total)}
          </div>
        </div>
      ) : (
        <p className="notice notice-quiet">No deposit filed for this day.</p>
      )}

      <div className="space-y-2">
        {deposits.map((d) => (
          <DepositCard key={d.id} deposit={d} />
        ))}
      </div>
    </AppShell>
  );
}
