"use client";

import { useActionState, useState } from "react";
import { createDepositAction, type ActionState } from "@/lib/actions";
import { fmt, parseDollarsToCents } from "@/lib/money";

const initial: ActionState = {};

export function DepositForm({
  defaultDate,
  maxDate,
  minDate,
  dayAlreadyHasDeposit,
}: {
  defaultDate: string;
  maxDate: string;
  minDate: string;
  dayAlreadyHasDeposit: boolean;
}) {
  const [state, formAction, pending] = useActionState(createDepositAction, initial);

  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState("");

  const totalCents = amount.trim() === "" ? null : parseDollarsToCents(amount);
  const confirmCents = confirm.trim() === "" ? null : parseDollarsToCents(confirm);
  const confirmMatches =
    totalCents !== null && confirmCents !== null && confirmCents === totalCents;
  const canSubmit = !pending && totalCents !== null && totalCents > 0 && confirmMatches;

  return (
    <form action={formAction} className="space-y-4">
      {/* ---------------- date ---------------- */}
      <section className="card">
        <div className="panel-head">
          <span className="panel-title">Deposit date</span>
        </div>
        <div className="p-4">
          <label className="label" htmlFor="businessDate">
            Business day
          </label>
          <input
            id="businessDate"
            name="businessDate"
            type="date"
            defaultValue={defaultDate}
            min={minDate}
            max={maxDate}
            required
            className="field money"
          />
          <p className="hint mt-2">
            The day the money came from. Future dates are not accepted.
          </p>
        </div>
      </section>

      {/* ------------- amount, entered twice ------------- */}
      <section className="card">
        <div className="panel-head">
          <span className="panel-title">Amount</span>
          <span className="text-[0.6875rem] font-semibold text-ink3">
            Entered twice
          </span>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="label" htmlFor="amount">
              Deposit amount (CAD)
            </label>
            <input
              id="amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`field money text-right text-3xl font-extrabold ${
                amount !== "" && totalCents === null ? "field-error" : ""
              }`}
            />
            {amount !== "" && totalCents === null && (
              <p className="mt-2 text-xs font-semibold text-miss">
                Use dollars and cents, for example 1450.75
              </p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="confirmTotal">
              Re-enter to confirm
            </label>
            <input
              id="confirmTotal"
              name="confirmTotal"
              inputMode="decimal"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="0.00"
              aria-describedby="confirm-help"
              className={`field money text-right text-xl font-extrabold ${
                confirm === "" ? "" : confirmMatches ? "border-ok!" : "field-error"
              }`}
            />
            <p
              id="confirm-help"
              className={`mt-2 text-xs font-semibold ${
                confirm === "" ? "text-ink3" : confirmMatches ? "text-ok" : "text-miss"
              }`}
            >
              {confirm === ""
                ? "Both entries must match before this deposit can be filed."
                : confirmMatches
                  ? `Confirmed — both entries read ${fmt(totalCents!)}.`
                  : "The two amounts do not match."}
            </p>
          </div>
        </div>
      </section>

      {/* ------------- reference ------------- */}
      <section className="card">
        <div className="panel-head">
          <span className="panel-title">Reference</span>
          <span className="text-[0.6875rem] font-semibold text-ink3">Optional</span>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <label className="label" htmlFor="bagNumber">
              Bag number
            </label>
            <input id="bagNumber" name="bagNumber" className="field money" />
          </div>
          <div>
            <label className="label" htmlFor="note">
              Note
            </label>
            <input
              id="note"
              name="note"
              maxLength={200}
              placeholder="Anything the Company Admin should know"
              className="field"
            />
          </div>
          {dayAlreadyHasDeposit && (
            <label className="notice notice-due flex items-start gap-3">
              <input
                type="checkbox"
                name="allowSecond"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--due)]"
              />
              <span>
                This date already has a deposit. Tick to file an additional drop.
              </span>
            </label>
          )}
        </div>
      </section>

      {state.error && (
        <p role="alert" className="notice notice-miss">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={!canSubmit} className="btn btn-primary w-full">
        {pending
          ? "Filing…"
          : totalCents !== null && confirmMatches
            ? `File deposit ${fmt(totalCents)}`
            : "File deposit"}
      </button>

      <p className="hint pb-4 text-center">
        Once filed, a deposit cannot be edited. On the day you file it you can
        void it with a reason, or delete it outright; after that it is the
        Company Admin&rsquo;s call. The Company Admin sees every record.
      </p>
    </form>
  );
}
