import Link from "next/link";
import { notFound } from "next/navigation";
import { assertStoreAccess, requireSession } from "@/lib/auth";
import { depositById } from "@/lib/queries";
import {
  longDate,
  monthKey,
  stampInBusinessTz,
  todayYmd,
  ymdInBusinessTz,
} from "@/lib/dates";
import { fmt } from "@/lib/money";
import { AppShell, PageHead } from "@/components/AppShell";
import { VoidForm } from "@/components/VoidForm";
import { DeleteForm } from "@/components/DeleteForm";

export default async function DepositDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filed?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { filed } = await searchParams;

  const depositId = Number(id);
  if (!Number.isInteger(depositId)) notFound();

  const deposit = await depositById(depositId);
  if (!deposit) notFound();

  // Managers can only ever open a deposit belonging to their own store.
  await assertStoreAccess(session, deposit.storeId);

  const isOwner = session.role === "OWNER";
  const voided = deposit.status === "VOIDED";
  // A manager can only change a slip on the day they entered it. That one
  // window covers both corrections: void keeps the record, delete removes it.
  const managerSameDay =
    !isOwner && ymdInBusinessTz(deposit.createdAt) === todayYmd();
  const canCorrect = isOwner || managerSameDay;

  const backHref = isOwner
    ? `/owner/day/${deposit.businessDate}`
    : `/dashboard/${deposit.businessDate}`;

  return (
    <AppShell session={session}>
      <Link href={backHref} className="backlink">
        <span aria-hidden>‹</span> Back
      </Link>

      {filed === "1" && !voided && (
        <p className="notice notice-ok">
          Deposit filed. It now appears on the calendar.
        </p>
      )}

      <PageHead
        eyebrow={`Store ${deposit.store.storeNumber} · ${deposit.store.city}`}
        title={longDate(deposit.businessDate)}
        meta={deposit.store.name}
      />

      {voided && (
        <div className="notice notice-miss">
          <div className="eyebrow text-miss">Voided</div>
          <div className="mt-1 font-normal">
            {deposit.voidReason} &mdash; {deposit.voidedBy?.name ?? "unknown"},{" "}
            {deposit.voidedAt ? stampInBusinessTz(deposit.voidedAt) : ""}
          </div>
        </div>
      )}

      <section className="card px-4 py-4">
        <div className="eyebrow">Deposit amount</div>
        <div
          className={`money mt-1 text-4xl font-extrabold leading-none ${
            voided ? "text-ink3 line-through" : "text-accent"
          }`}
        >
          {fmt(deposit.totalCents)}
        </div>
      </section>

      <section className="card">
        <div className="panel-head">
          <span className="panel-title">Record</span>
          <span className="money text-[0.6875rem] font-semibold text-ink3">
            #{deposit.id}
          </span>
        </div>
        <dl className="divide-y divide-line text-sm">
          <Row label="Filed by" value={deposit.enteredBy.name} />
          <Row
            label="Filed at"
            value={stampInBusinessTz(deposit.createdAt)}
          />
          <Row label="Business date" value={deposit.businessDate} />
          {deposit.bagNumber && <Row label="Bag" value={deposit.bagNumber} />}
          {deposit.note && <Row label="Note" value={deposit.note} />}
          <Row label="Status" value={voided ? "Voided" : "Active"} />
        </dl>
      </section>

      {!voided && canCorrect && <VoidForm depositId={deposit.id} />}

      {canCorrect && (
        <div className="border-t border-line pt-4 text-center">
          <DeleteForm depositId={deposit.id} totalCents={deposit.totalCents} />
        </div>
      )}
      {!voided && !canCorrect && (
        <p className="notice notice-quiet">
          This deposit was filed on an earlier day, so it can no longer be changed
          here. Contact the Company Admin if a correction is needed.
        </p>
      )}

      <Link
        href={
          isOwner
            ? `/owner/store/${deposit.storeId}?month=${monthKey(deposit.businessDate)}`
            : `/dashboard?month=${monthKey(deposit.businessDate)}`
        }
        className="btn btn-ghost w-full"
      >
        View month
      </Link>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5">
      <dt className="text-ink3">{label}</dt>
      <dd className="money text-right font-semibold">{value}</dd>
    </div>
  );
}
