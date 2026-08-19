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

export type DayState = "filed" | "missed" | "due" | "off" | "future";

export function dayState(opts: {
  ymd: Ymd;
  hasDeposit: boolean;
  isDepositDay: boolean;
  today?: Ymd;
}): DayState {
  const today = opts.today ?? todayYmd();
  if (opts.hasDeposit) return "filed";
  if (opts.ymd > today) return "future";
  if (!opts.isDepositDay) return "off";
  if (opts.ymd === today) return "due";
  return "missed";
}
