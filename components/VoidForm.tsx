"use client";

import { useActionState, useState } from "react";
import { voidDepositAction, type ActionState } from "@/lib/actions";

const initial: ActionState = {};

export function VoidForm({ depositId }: { depositId: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(voidDepositAction, initial);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-danger w-full">
        Void this deposit
      </button>
    );
  }

  return (
    <form action={formAction} className="card">
      <div className="panel-head">
        <span className="panel-title text-miss">Void deposit</span>
      </div>
      <div className="space-y-3 p-4">
        <input type="hidden" name="depositId" value={depositId} />
        <p className="hint">
          Voiding keeps the original record. It stays visible to the Company
          Admin with your name and reason attached.
        </p>
        <div>
          <label className="label" htmlFor="reason">
            Reason (required)
          </label>
          <input
            id="reason"
            name="reason"
            required
            minLength={5}
            placeholder="e.g. Amount entered from the wrong slip"
            className="field"
          />
        </div>
        {state.error && (
          <p role="alert" className="text-sm font-semibold text-miss">
            {state.error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn btn-danger flex-1">
            {pending ? "Voiding…" : "Confirm void"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn btn-ghost"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
