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
 * Three things have to be true: the store is still open, it deposits on that
 * weekday, and the date is on or after the day it joined the system. Without
 * the last test a freshly seeded store would show every past day as missed.
 *
 * "Not expected" is only ever about the *miss* counts. Money a store really
 * filed is counted everywhere regardless — see ownerDay and cityTotals.
 */
function expectsDeposit(
  store: { depositDays: string; startDate: string | null; active: boolean },
  ymd: Ymd,
): boolean {
  if (!store.active) return false;
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
  /** Stores that were due that day AND filed. Never more than `expected`. */
  filed: number;
  /**
   * Stores that filed without being due — an off-schedule drop, or a deposit
   * backdated to before the store joined. Counted apart from `filed` so it can
   * never paper over a store that was due and missed.
   */
  unscheduled: number;
  totalCents: number;
  isPast: boolean;
  isFuture: boolean;
};

/** Owner's month: how many of the 15 stores filed, per day. */
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
  const days: OwnerDay[] = cells.map((c) => {
    const didFile = filedByDay.get(c.ymd) ?? new Set<number>();
    const due = stores.filter((s) => expectsDeposit(s, c.ymd));
    // Only a store that was due can close the gap. Counting every filing
    // against `expected` let an off-schedule drop hide a store that missed.
    const filed = due.filter((s) => didFile.has(s.id)).length;
    return {
      ymd: c.ymd,
      inMonth: c.inMonth,
      expected: due.length,
      filed,
      unscheduled: didFile.size - filed,
      totalCents: totalByDay.get(c.ymd) ?? 0,
      isPast: c.ymd < today,
      isFuture: c.ymd > today,
    };
  });

  const { start, end } = monthRange(month);
  const inMonth = days.filter((d) => d.inMonth && d.ymd >= start && d.ymd <= end);

  return {
    stores,
    days,
    summary: {
      totalCents: inMonth.reduce((s, d) => s + d.totalCents, 0),
      filed: inMonth.reduce((s, d) => s + d.filed, 0),
      unscheduled: inMonth.reduce((s, d) => s + d.unscheduled, 0),
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
    orderBy: [{ city: "asc" }, { storeNumber: "asc" }],
  });
  const deposits = await prisma.deposit.findMany({
    where: { businessDate: ymd },
    include: { enteredBy: true, voidedBy: true },
    orderBy: { createdAt: "asc" },
  });

  // Open stores are always listed. A closed one appears only on a date it
  // actually filed, so money it banked while open never drops out of the day
  // total — the month calendar counts that money either way, and the two views
  // have to agree.
  const filedHere = new Set(deposits.map((d) => d.storeId));
  const shown = stores.filter((s) => s.active || filedHere.has(s.id));

  const today = todayYmd();
  const rows = shown.map((store) => {
    const mine = deposits.filter((d) => d.storeId === store.id);
    const active = mine.filter((d) => d.status === "ACTIVE");
    const due = expectsDeposit(store, ymd);
    return {
      store,
      due,
      deposits: mine,
      totalCents: active.reduce((s, d) => s + d.totalCents, 0),
      state: dayState({
        ymd,
        hasDeposit: active.length > 0,
        isDepositDay: due,
        today,
      }),
    };
  });

  return {
    rows,
    totalCents: rows.reduce((s, r) => s + r.totalCents, 0),
    // Same populations the month calendar uses: only a store that was due
    // counts towards filed/expected. A future date expects nothing yet.
    filed: rows.filter((r) => r.due && r.state === "filed").length,
    expected: ymd > today ? 0 : rows.filter((r) => r.due).length,
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
      // expectsDeposit already returns false for a closed store, so `expected`
      // is 0 there and a closed store is never reported as missing.
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
