import Link from "next/link";
import type { CalendarDay } from "@/lib/queries";
import { fmt } from "@/lib/money";
import { todayYmd } from "@/lib/dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CLS: Record<CalendarDay["state"], string> = {
  filed: "day-filed",
  missed: "day-missed day-flag",
  due: "day-due day-flag",
  off: "day-off",
  future: "",
};

export function StoreCalendar({
  days,
  hrefFor,
}: {
  days: CalendarDay[];
  hrefFor: (ymd: string) => string;
}) {
  const today = todayYmd();

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-head">
            <span className="hidden sm:inline">{w}</span>
            <span className="sm:hidden">{w[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const interactive =
            d.state === "filed" || d.state === "missed" || d.state === "due";

          const label =
            d.state === "filed"
              ? `${d.ymd}: deposit filed, ${fmt(d.totalCents)}`
              : d.state === "missed"
                ? `${d.ymd}: no deposit filed`
                : d.state === "due"
                  ? `${d.ymd}: deposit due today`
                  : `${d.ymd}: no deposit expected`;

          const body = (
            <>
              <span className="day-num">{Number(d.ymd.slice(8))}</span>
              {d.state === "filed" && (
                <>
                  <span aria-hidden className="text-[0.6875rem] font-black leading-none text-ok">
                    ✓
                  </span>
                  <span className="money hidden text-[0.5625rem] font-semibold leading-none text-ok sm:block">
                    {fmt(d.totalCents)}
                  </span>
                </>
              )}
              {d.state === "due" && (
                <span className="text-[0.5625rem] font-bold uppercase leading-none tracking-wide text-due">
                  Due
                </span>
              )}
              {d.state === "missed" && (
                <span className="text-[0.5625rem] font-bold uppercase leading-none tracking-wide text-miss">
                  None
                </span>
              )}
            </>
          );

          const cls = `day ${CLS[d.state]} ${d.inMonth ? "" : "day-out"} ${
            d.ymd === today ? "day-today" : ""
          }`;

          return interactive ? (
            <Link key={d.ymd} href={hrefFor(d.ymd)} aria-label={label} className={cls}>
              {body}
            </Link>
          ) : (
            <div key={d.ymd} aria-label={label} className={`${cls} text-ink3`}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
