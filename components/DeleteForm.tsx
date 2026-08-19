"use client";

import { useActionState, useState } from "react";
import { deleteDepositAction, type ActionState } from "@/lib/actions";
import { fmt } from "@/lib/money";

const initial: ActionState = {};

/**
 * Deleting is deliberately heavier than voiding: it is behind a disclosure,
 * needs a written reason, and the exact amount has to be re-keyed. The row does
 * not come back.
 */
export function DeleteForm({
  depositId,
  totalCents,
}: {
  depositId: number;
  totalCents: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteDepositAction, initial);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink3 hover:text-miss"
      >
        Delete this deposit permanently
      </button>
    );
  }

  return (
    <form action={formAction} className="card border-miss/50">
      <div className="panel-head">
        <span className="panel-title text-miss">Delete permanently</span>
      </div>
      <div className="space-y-3 p-4">
        <input type="hidden" name="depositId" value={depositId} />

        <p className="notice notice-miss">
          This removes {fmt(totalCents)} from the books entirely. The calendar
          and every total change as though it was never filed, and it cannot be
          undone from here. Voiding keeps the record visible instead.
        </p>

        <div>
          <label className="label" htmlFor="del-reason">
            Reason (required)
          </label>
          <input
            id="del-reason"
            name="reason"
            required
            minLength={5}
            placeholder="e.g. Filed against the wrong store"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="confirmAmount">
            Type {fmt(totalCents)} to confirm
          </label>
          <input
            id="confirmAmount"
            name="confirmAmount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            className={`field money text-right font-extrabold ${
              state.fieldErrors?.confirmAmount ? "field-error" : ""
            }`}
          />
        </div>

        {state.error && (
          <p role="alert" className="text-sm font-semibold text-miss">
            {state.error}
          </p>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn btn-danger flex-1">
            {pending ? "Deleting…" : "Delete permanently"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn btn-ghost"
          >
            Cancel
          </button>
        </div>

        <p className="hint">
          A full copy of this deposit is written to the audit log before it is
          removed, so the figure stays recoverable from the trail.
        </p>
      </div>
    </form>
  );
}
