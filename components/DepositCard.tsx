import Link from "next/link";
import { fmt } from "@/lib/money";
import { stampInBusinessTz } from "@/lib/dates";

type CardDeposit = {
  id: number;
  totalCents: number;
  status: string;
  bagNumber: string | null;
  createdAt: Date;
  voidReason?: string | null;
  enteredBy?: { name: string } | null;
};

export function DepositCard({ deposit }: { deposit: CardDeposit }) {
  const voided = deposit.status === "VOIDED";

  return (
    <Link
      href={`/deposit/${deposit.id}`}
      className="card flex items-center gap-3 px-4 py-3 hover:border-accent"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`money text-lg font-extrabold ${
              voided ? "text-ink3 line-through" : "text-ink"
            }`}
          >
            {fmt(deposit.totalCents)}
          </span>
          {voided && (
            <span className="chip bg-missbg text-miss">Voided</span>
          )}
          {deposit.bagNumber && (
            <span className="money text-xs text-ink3">
              Bag {deposit.bagNumber}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-ink3">
          {deposit.enteredBy?.name ? `${deposit.enteredBy.name} · ` : ""}
          {stampInBusinessTz(deposit.createdAt)}
        </div>
      </div>
      <span aria-hidden className="text-lg text-ink3">
        ›
      </span>
    </Link>
  );
}
