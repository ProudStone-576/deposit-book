import Link from "next/link";
import type { OwnerDay } from "@/lib/queries";
import { ownerDayState, todayYmd } from "@/lib/dates";
import { fmt } from "@/lib/money";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Owner view of the month. A day is only "complete" when every store that was
 * supposed to deposit actually did — that is the number the owner cares about.
 */
export function OwnerCalendar({ days }: { days: OwnerDay[] }) {
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
          // A day with no store due is only "closed" if nothing was banked on
          // it. A deposit backdated to before a store joined lands on such a
          // day, and it used to vanish from this calendar while still counting
          // in the month total.
          const { state, interactive } = ownerDayState(d);

          const cls =
            state === "filed"
              ? "day-filed"
              : state === "missed"
                ? "day-missed day-flag"
                : state === "due"
                  ? "day-due day-flag"
                  : state === "off"
                    ? "day-off"
                    : "";

          const body = (
            <>
              <span className="day-num">{Number(d.ymd.slice(8))}</span>
              {interactive &&
                (state === "filed" ? (
                  <span
                    aria-hidden
                    className="text-[0.6875rem] font-black leading-none text-ok"
                  >
                    ✓
                  </span>
                ) : (
                  <span
                    className={`money text-[0.625rem] font-bold leading-none ${
                      state === "missed" ? "text-miss" : "text-due"
                    }`}
                  >
                    {d.filed}/{d.expected}
                  </span>
                ))}
            </>
          );

          const label =
            `${d.ymd}: ${d.filed} of ${d.expected} stores filed` +
            (d.unscheduled > 0
              ? `, plus ${d.unscheduled} not due that day`
              : "") +
            `, ${fmt(d.totalCents)}`;
          const base = `day ${cls} ${d.inMonth ? "" : "day-out"} ${
            d.ymd === today ? "day-today" : ""
          }`;

          return interactive ? (
            <Link
              key={d.ymd}
              href={`/owner/day/${d.ymd}`}
              aria-label={label}
              className={base}
            >
              {body}
            </Link>
          ) : (
            <div key={d.ymd} aria-label={label} className={`${base} text-ink3`}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
