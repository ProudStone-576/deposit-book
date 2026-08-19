"use client";

import { useActionState, useState } from "react";
import { loginAction, type ActionState } from "@/lib/actions";

const initial: ActionState = {};

export function LoginForm() {
  const [mode, setMode] = useState<"store" | "owner">("store");
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      <div
        role="tablist"
        aria-label="Sign in as"
        className="grid grid-cols-2 rounded-[var(--r)] border border-linestrong p-0.5"
      >
        {(["store", "owner"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-[var(--r-sm)] py-2 text-[0.6875rem] font-bold uppercase tracking-[0.08em] transition ${
              mode === m
                ? "bg-accent text-accentink"
                : "text-ink3 hover:text-ink"
            }`}
          >
            {m === "store" ? "Store manager" : "Company Admin"}
          </button>
        ))}
      </div>

      {mode === "store" ? (
        <div>
          <label className="label" htmlFor="loginCode">
            Store number
          </label>
          <input
            id="loginCode"
            name="loginCode"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]*"
            maxLength={5}
            placeholder="00000"
            required
            autoFocus
            className="field money text-center text-3xl font-extrabold tracking-[0.12em]"
          />
          <p className="hint mt-2">
            Your store number is all you need. No password.
          </p>
        </div>
      ) : (
        <>
          <input type="hidden" name="loginCode" value="OWNER" />
          <div>
            <label className="label" htmlFor="pin">
              Admin PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={12}
              placeholder="••••"
              required
              className="field text-center text-3xl font-extrabold tracking-[0.35em]"
            />
            <p className="hint mt-2">
              The Company Admin account can see all thirteen stores, so it
              stays behind a PIN.
            </p>
          </div>
        </>
      )}

      {state.error && (
        <p role="alert" className="notice notice-miss">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
