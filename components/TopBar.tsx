import Link from "next/link";
import { logoutAction } from "@/lib/actions";
import type { Session } from "@/lib/auth";
import { Wordmark } from "./Brand";

export function TopBar({ session }: { session: Session }) {
  const isOwner = session.role === "OWNER";
  const home = isOwner ? "/owner" : "/dashboard";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2.5">
        <Link href={home} aria-label="Deposit Book home">
          <Wordmark />
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {/* Who you are signed in as, stated plainly — this decides what
              numbers the page is allowed to show. */}
          <div className="flex items-center gap-2 rounded-[var(--r)] border border-line bg-surface2 px-2.5 py-1.5">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                isOwner ? "bg-brand" : "bg-accent"
              }`}
            />
            <span className="leading-tight">
              <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink3">
                {isOwner ? "Company Admin" : `Store ${session.storeNumber}`}
              </span>
              <span className="block max-w-[9rem] truncate text-xs font-semibold text-ink2">
                {isOwner ? "All stores" : session.storeName}
              </span>
            </span>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink3 hover:text-accent"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
