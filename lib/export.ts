import { prisma } from "./db";
import { fmt } from "./money";

/**
 * Off-provider copy of the book.
 *
 * Neon keeps continuous point-in-time restore, which covers a bad query, a
 * dropped table, or a mistake we make. It does not cover losing the Neon
 * account itself. A CSV the Company Admin can download and file away does.
 */

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function depositsCsv(): Promise<string> {
  const deposits = await prisma.deposit.findMany({
    include: { store: true, enteredBy: true, voidedBy: true },
    orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
  });

  const header = [
    "deposit_id",
    "business_date",
    "store_number",
    "store_name",
    "city",
    "amount_cents",
    "amount",
    "status",
    "bag_number",
    "note",
    "filed_by",
    "filed_at_utc",
    "voided_by",
    "voided_at_utc",
    "void_reason",
  ];

  const rows = deposits.map((d) =>
    [
      d.id,
      d.businessDate,
      d.store.storeNumber,
      d.store.name,
      d.store.city,
      // Both: the cents are the record, the formatted value is for humans.
      d.totalCents,
      fmt(d.totalCents),
      d.status,
      d.bagNumber ?? "",
      d.note ?? "",
      d.enteredBy.name,
      d.createdAt.toISOString(),
      d.voidedBy?.name ?? "",
      d.voidedAt?.toISOString() ?? "",
      d.voidReason ?? "",
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.join(","), ...rows].join("\n") + "\n";
}

export async function bookSummary() {
  // The count and the sum have to describe the same rows. Counting every
  // deposit while summing only the active ones read as money gone missing.
  const [deposits, voided, stores, active, newest] = await Promise.all([
    prisma.deposit.count({ where: { status: "ACTIVE" } }),
    prisma.deposit.count({ where: { status: "VOIDED" } }),
    prisma.store.count(),
    prisma.deposit.aggregate({
      where: { status: "ACTIVE" },
      _sum: { totalCents: true },
    }),
    prisma.deposit.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { businessDate: "desc" },
      select: { businessDate: true },
    }),
  ]);
  return {
    deposits,
    voided,
    stores,
    totalCents: active._sum.totalCents ?? 0,
    latestDate: newest?.businessDate ?? null,
  };
}
