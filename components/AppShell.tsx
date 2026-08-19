import type { Session } from "@/lib/auth";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";

/** Header, page body, footer — so every signed-in screen sits the same way. */
export function AppShell({
  session,
  width = "narrow",
  children,
}: {
  session: Session;
  width?: "narrow" | "wide";
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar session={session} />
      <main
        className={`mx-auto w-full flex-1 space-y-4 px-4 py-5 ${
          width === "wide" ? "max-w-5xl" : "max-w-3xl"
        }`}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}

/** Page title block: eyebrow above, heading, then context line. */
export function PageHead({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow?: string;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="text-[1.375rem] font-extrabold leading-tight tracking-[-0.02em]">
          {title}
        </h1>
        {meta && <div className="mt-1 text-sm text-ink2">{meta}</div>}
      </div>
      {actions}
    </div>
  );
}
