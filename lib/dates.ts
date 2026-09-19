/**
 * Business dates are plain "YYYY-MM-DD" strings. No Date objects hit the DB,
 * so nothing can shift a deposit into the wrong day because of a timezone.
 */

export type Ymd = string;

export function toYmd(d: Date): Ymd {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromYmd(s: Ymd): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isYmd(s: unknown): s is Ymd {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = fromYmd(s);
  return toYmd(d) === s;
}

/**
 * The timezone the business runs in. "Today" must mean today in the store's
 * town, not on whatever host the app happens to run on — a server in UTC would
 * roll the date over mid-evening and file the takings under tomorrow.
 */
export const BUSINESS_TZ = process.env.BUSINESS_TZ || "America/Vancouver";

/** A moment, expressed as the calendar date it falls on in the business tz. */
export function ymdInBusinessTz(d: Date): Ymd {
  // en-CA formats as YYYY-MM-DD, which is exactly our storage shape.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function todayYmd(): Ymd {
  return ymdInBusinessTz(new Date());
}

/**
 * A stored moment, rendered as the wall clock in the business timezone.
 *
 * These are the only date helpers that take a real instant. Everything else
 * here works on "YYYY-MM-DD" strings and must stay timezone-free: those build a
 * host-local Date and format it host-local, which agree with each other. Adding
 * a timeZone to them would drag every business date back a day.
 *
 * Without this the host clock decides, and a UTC server shows an evening
 * deposit at 2:30 a.m. under tomorrow's date.
 */
export function stampInBusinessTz(d: Date): string {
  return new Date(d).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUSINESS_TZ,
  });
}

/** Clock time alone, in the business timezone. */
export function timeInBusinessTz(d: Date): string {
  return new Date(d).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BUSINESS_TZ,
  });
}

export function addDays(s: Ymd, n: number): Ymd {
  const d = fromYmd(s);
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

export function monthKey(s: Ymd): string {
  return s.slice(0, 7); // "YYYY-MM"
}

export function monthRange(month: string): { start: Ymd; end: Ymd } {
  const [y, m] = month.split("-").map(Number);
  const start = toYmd(new Date(y, m - 1, 1));
  const end = toYmd(new Date(y, m, 0));
  return { start, end };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });
}

export function longDate(s: Ymd): string {
  return fromYmd(s).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function shortDate(s: Ymd): string {
  return fromYmd(s).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Calendar grid for a month: always whole weeks (Sun..Sat), padded with the
 * neighbouring days so the grid never jumps around between months.
 */
export function calendarGrid(month: string): { ymd: Ymd; inMonth: boolean }[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());

  const cells: { ymd: Ymd; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ ymd: toYmd(d), inMonth: d.getMonth() === m - 1 });
    if (i >= 34 && d.getMonth() !== m - 1 && d.getDate() >= 7) break;
  }
  // trim trailing all-out-of-month week
  while (cells.length > 35 && cells.slice(-7).every((c) => !c.inMonth)) {
    cells.splice(-7);
  }
  return cells;
}

export function weekdayOf(s: Ymd): number {
  return fromYmd(s).getDay();
}

/** Does this store expect a deposit on this date? */
export function isDepositDay(depositDaysCsv: string, ymd: Ymd): boolean {
  const days = depositDaysCsv
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n));
  return days.includes(weekdayOf(ymd));
}

/**
 * Is the store shut on this date for a temporary closure?
 *
 * The window is inclusive at both ends, so a store closed through "2026-10-31"
 * is expected to deposit again on 2026-11-01 with nobody having to touch it.
 * An open end (one side null) is an open-ended closure from/until that date;
 * both null is an open store.
 */
export function isClosedOn(
  store: { closedFrom: string | null; closedUntil: string | null },
  ymd: Ymd,
): boolean {
  if (!store.closedFrom && !store.closedUntil) return false;
  if (store.closedFrom && ymd < store.closedFrom) return false;
  if (store.closedUntil && ymd > store.closedUntil) return false;
  return true;
}

export type DayState = "filed" | "missed" | "due" | "off" | "closed" | "future";

/**
 * State of one cell on the Company Admin's month calendar.
 *
 * Kept here, next to dayState, because the two must stay in step: the store
 * calendar treats "this day has money on it" as decisive, and this one has to
 * agree or the same deposit shows on one calendar and not the other.
 */
export function ownerDayState(d: {
  expected: number;
  filed: number;
  unscheduled: number;
  isPast: boolean;
  isFuture: boolean;
}): { state: DayState; interactive: boolean; missing: number } {
  const missing = Math.max(0, d.expected - d.filed);
  const nothingHappened = d.expected === 0 && d.unscheduled === 0;
  const state: DayState = nothingHappened
    ? "off"
    : d.isFuture
      ? "future"
      : missing === 0
        ? "filed"
        : d.isPast
          ? "missed"
          : "due";
  return { state, interactive: !nothingHappened && !d.isFuture, missing };
}

export function dayState(opts: {
  ymd: Ymd;
  hasDeposit: boolean;
  isDepositDay: boolean;
  /** Inside a temporary closure window — see isClosedOn. */
  isClosed?: boolean;
  today?: Ymd;
}): DayState {
  const today = opts.today ?? todayYmd();
  if (opts.hasDeposit) return "filed";
  // Ahead of "future" on purpose: a closure is a settled fact for the days
  // still to come inside it, not something waiting to be decided.
  if (opts.isClosed) return "closed";
  if (opts.ymd > today) return "future";
  if (!opts.isDepositDay) return "off";
  if (opts.ymd === today) return "due";
  return "missed";
}
