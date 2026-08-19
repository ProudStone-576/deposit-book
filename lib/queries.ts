import "server-only";
import { prisma } from "./db";
import {
  addDays,
  calendarGrid,
  dayState,
  isDepositDay,
  monthRange,
  todayYmd,
  type DayState,
  type Ymd,
} from "./dates";

/**
 * Is a deposit expected from this store on this date?
 *
 * Two things have to be true: the store deposits on that weekday, and the date
 * is on or after the day the store joined the system. Without the second test a
 * freshly seeded store would show every past day as missed.
 */
function expectsDeposit(
  store: { depositDays: string; startDate: string | null },
  ymd: Ymd,
): boolean {
  if (store.startDate && ymd < store.startDate) return false;
  return isDepositDay(store.depositDays, ymd);
}

export type CalendarDay = {
  ymd: Ymd;
  inMonth: boolean;
  state: DayState;
  totalCents: number;
  depositCount: number;
};

/** One store's month: a tick on every day that has a deposit. */
export async function storeMonth(storeId: number, month: string) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  const cells = calendarGrid(month);
  const first = cells[0].ymd;
  const last = cells[cells.length - 1].ymd;

  const deposits = await prisma.deposit.findMany({
    where: {
      storeId,
      status: "ACTIVE",
      businessDate: { gte: first, lte: last },
    },
    orderBy: { businessDate: "asc" },
  });

  const byDay = new Map<Ymd, { total: number; count: number }>();
  for (const d of deposits) {
    const cur = byDay.get(d.businessDate) ?? { total: 0, count: 0 };
    cur.total += d.totalCents;
    cur.count += 1;
    byDay.set(d.businessDate, cur);
  }

  const today = todayYmd();
  const days: CalendarDay[] = cells.map((c) => {
    const hit = byDay.get(c.ymd);
    return {
      ymd: c.ymd,
      inMonth: c.inMonth,
      state: dayState({
        ymd: c.ymd,
        hasDeposit: !!hit,
        isDepositDay: expectsDeposit(store, c.ymd),
        today,
      }),
      totalCents: hit?.total ?? 0,
      depositCount: hit?.count ?? 0,
    };
  });

  const { start, end } = monthRange(month);
  const inMonth = days.filter((d) => d.inMonth && d.ymd >= start && d.ymd <= end);

  return {
    store,
    days,
    summary: {
      totalCents: inMonth.reduce((s, d) => s + d.totalCents, 0),
      filed: inMonth.filter((d) => d.state === "filed").length,
      missed: inMonth.filter((d) => d.state === "missed").length,
      due: inMonth.filter((d) => d.state === "due").length,
    },
  };
}

export type OwnerDay = {
  ymd: Ymd;
  inMonth: boolean;
  expected: number;
  filed: number;
  totalCents: number;
  isPast: boolean;
  isFuture: boolean;
};

/** Owner's month: how many of the 13 stores filed, per day. */
export async function ownerMonth(month: string) {
  const stores = await prisma.store.findMany({
    where: { active: true },
    orderBy: { storeNumber: "asc" },
  });
  const cells = calendarGrid(month);
  const first = cells[0].ymd;
  const last = cells[cells.length - 1].ymd;

  const deposits = await prisma.deposit.findMany({
    where: { status: "ACTIVE", businessDate: { gte: first, lte: last } },
    select: { businessDate: true, storeId: true, totalCents: true },
  });

  const filedByDay = new Map<Ymd, Set<number>>();
  const totalByDay = new Map<Ymd, number>();
  for (const d of deposits) {
    if (!filedByDay.has(d.businessDate)) filedByDay.set(d.businessDate, new Set());
    filedByDay.get(d.businessDate)!.add(d.storeId);
    totalByDay.set(d.businessDate, (totalByDay.get(d.businessDate) ?? 0) + d.totalCents);
  }

  const today = todayYmd();
  const days: OwnerDay[] = cells.map((c) => ({
    ymd: c.ymd,
    inMonth: c.inMonth,
    expected: stores.filter((s) => expectsDeposit(s, c.ymd)).length,
    filed: filedByDay.get(c.ymd)?.size ?? 0,
    totalCents: totalByDay.get(c.ymd) ?? 0,
    isPast: c.ymd < today,
    isFuture: c.ymd > today,
  }));

  const { start, end } = monthRange(month);
  const inMonth = days.filter((d) => d.inMonth && d.ymd >= start && d.ymd <= end);

  return {
    stores,
    days,
    summary: {
      totalCents: inMonth.reduce((s, d) => s + d.totalCents, 0),
      filed: inMonth.reduce((s, d) => s + d.filed, 0),
      expected: inMonth
        .filter((d) => !d.isFuture)
        .reduce((s, d) => s + d.expected, 0),
      missing: inMonth
        .filter((d) => d.isPast)
        .reduce((s, d) => s + Math.max(0, d.expected - d.filed), 0),
    },
  };
}

/** Owner drill-down: every store's status for one business date. */
export async function ownerDay(ymd: Ymd) {
  const stores = await prisma.store.findMany({
    where: { active: true },
    orderBy: [{ city: "asc" }, { storeNumber: "asc" }],
  });
  const deposits = await prisma.deposit.findMany({
    where: { businessDate: ymd },
    include: { enteredBy: true, voidedBy: true },
    orderBy: { createdAt: "asc" },
  });

  const today = todayYmd();
  const rows = stores.map((store) => {
    const mine = deposits.filter((d) => d.storeId === store.id);
    const active = mine.filter((d) => d.status === "ACTIVE");
    const expected = expectsDeposit(store, ymd);
    return {
      store,
      deposits: mine,
      totalCents: active.reduce((s, d) => s + d.totalCents, 0),
      state: dayState({
        ymd,
        hasDeposit: active.length > 0,
        isDepositDay: expected,
        today,
      }),
    };
  });

  return {
    rows,
    totalCents: rows.reduce((s, r) => s + r.totalCents, 0),
    filed: rows.filter((r) => r.state === "filed").length,
    expected: rows.filter((r) => r.state !== "off").length,
  };
}

export async function depositsForStoreDay(storeId: number, ymd: Ymd) {
  return prisma.deposit.findMany({
    where: { storeId, businessDate: ymd },
    include: { enteredBy: true, voidedBy: true, store: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function depositById(id: number) {
  return prisma.deposit.findUnique({
    where: { id },
    include: { enteredBy: true, voidedBy: true, store: true },
  });
}

/** City rollup for the owner's overview. */
export async function cityTotals(month: string) {
  const { start, end } = monthRange(month);
  const stores = await prisma.store.findMany({ orderBy: { storeNumber: "asc" } });
  const deposits = await prisma.deposit.findMany({
    where: { status: "ACTIVE", businessDate: { gte: start, lte: end } },
    select: { storeId: true, totalCents: true, businessDate: true },
  });

  const perStore = new Map<number, { total: number; days: Set<string> }>();
  for (const d of deposits) {
    const cur = perStore.get(d.storeId) ?? { total: 0, days: new Set<string>() };
    cur.total += d.totalCents;
    cur.days.add(d.businessDate);
    perStore.set(d.storeId, cur);
  }

  const today = todayYmd();
  const cities = new Map<
    string,
    { city: string; totalCents: number; stores: typeof rows }
  >();

  const rows = stores.map((store) => {
    const agg = perStore.get(store.id);
    let expected = 0;
    for (let d = start; d <= end && d <= today; d = addDays(d, 1)) {
      if (expectsDeposit(store, d)) expected++;
    }
    return {
      store,
      totalCents: agg?.total ?? 0,
      filedDays: agg?.days.size ?? 0,
      expectedDays: expected,
      missedDays: Math.max(0, expected - (agg?.days.size ?? 0)),
    };
  });

  for (const r of rows) {
    const c = cities.get(r.store.city) ?? {
      city: r.store.city,
      totalCents: 0,
      stores: [] as typeof rows,
    };
    c.totalCents += r.totalCents;
    c.stores.push(r);
    cities.set(r.store.city, c);
  }

  return [...cities.values()].sort((a, b) => b.totalCents - a.totalCents);
}
