import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addDays, isYmd, longDate, monthKey, todayYmd } from "@/lib/dates";
import { AppShell, PageHead } from "@/components/AppShell";
import { DepositForm } from "@/components/DepositForm";

const MAX_BACKDATE_DAYS = 45;

export default async function NewDepositPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireSession();
  // The owner reads the books; only a store manager files money into them.
  if (session.role !== "MANAGER" || !session.storeId) redirect("/owner");

  const sp = await searchParams;
  const today = todayYmd();
  const date = isYmd(sp.date ?? "") && sp.date! <= today ? sp.date! : today;

  const existing = await prisma.deposit.count({
    where: { storeId: session.storeId, businessDate: date, status: "ACTIVE" },
  });

  return (
    <AppShell session={session}>
      <Link href={`/dashboard?month=${monthKey(date)}`} className="backlink">
        <span aria-hidden>‹</span> Calendar
      </Link>

      <PageHead
        eyebrow={`Store ${session.storeNumber} · ${session.storeName}`}
        title="New deposit"
        meta={longDate(date)}
      />

      <DepositForm
        defaultDate={date}
        minDate={addDays(today, -MAX_BACKDATE_DAYS)}
        maxDate={today}
        dayAlreadyHasDeposit={existing > 0}
      />
    </AppShell>
  );
}
