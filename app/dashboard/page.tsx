import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { storeMonth } from "@/lib/queries";
import { isClosedOn, longDate, monthKey, todayYmd } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { AppShell, PageHead } from "@/components/AppShell";
import { MonthNav } from "@/components/MonthNav";
import { StoreCalendar } from "@/components/StoreCalendar";
import { Legend } from "@/components/Legend";
import { Stat } from "@/components/Stat";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  if (session.role === "OWNER") redirect("/owner");
  if (!session.storeId) redirect("/login");

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "")
    ? sp.month!
    : monthKey(todayYmd());

  // A manager can only ever ask for their own store: the id comes from the
  // signed session cookie, never from the URL.
  const { store, days, summary } = await storeMonth(session.storeId, month);
  const today = todayYmd();
  const todayCell = days.find((d) => d.ymd === today);

  return (
    <AppShell session={session}>
      <PageHead
        eyebrow={`Store ${store.storeNumber} · ${store.city}`}
        title={store.name}
        meta={<>Signed in as {session.name}</>}
        actions={
          <Link href={`/deposit/new?date=${today}`} className="btn btn-primary">
            {todayCell?.state === "filed" ? "Add deposit" : "Enter deposit"}
          </Link>
        }
      />

      {isClosedOn(store, today) && (
        <p className="notice notice-quiet">
          This store is closed. No deposit is required
          {store.closedUntil ? ` through ${longDate(store.closedUntil)}` : ""}.
        </p>
      )}

      {todayCell?.state === "due" && (
        <p className="notice notice-due">
          Today&rsquo;s deposit has not been filed yet.
        </p>
      )}
      {summary.missed > 0 && (
        <p className="notice notice-miss">
          {summary.missed} day{summary.missed === 1 ? "" : "s"} this month with no
          deposit. Select a flagged day to file it.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Month total" value={fmt(summary.totalCents)} tone="accent" />
        <Stat label="Filed" value={String(summary.filed)} tone="ok" />
        <Stat label="Not filed" value={String(summary.missed)} tone="miss" />
      </div>

      <section className="card">
        <MonthNav month={month} basePath="/dashboard" />
        <div className="space-y-4 p-3.5">
          <StoreCalendar days={days} hrefFor={(ymd) => `/dashboard/${ymd}`} />
          <div className="border-t border-line pt-3">
            <Legend />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
