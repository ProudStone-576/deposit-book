const YEAR = new Date().getFullYear();

/**
 * Product footer. Same register as the reference: hairline rule, small
 * centred row of pipe-separated links, attribution last.
 */
export function Footer() {
  return (
    <footer className="mt-10 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-6 text-center">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-ink3">
          <span>
            Made by{" "}
            <a
              href="https://aethoncore.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-ink2 underline-offset-2 hover:text-accent hover:underline"
            >
              Aethon Core
            </a>
          </span>
          <span aria-hidden className="text-line">
            |
          </span>
          <a
            href="https://aethoncore.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            aethoncore.com
          </a>
          <span aria-hidden className="text-line">
            |
          </span>
          <span>&copy; Aethon Core, {YEAR}</span>
          <span aria-hidden className="text-line">
            |
          </span>
          <span className="money">v0.1</span>
        </p>
        <p className="text-[0.6875rem] text-ink3">
          Deposit Book &mdash; store deposit records. Figures are retained and
          auditable.
        </p>
      </div>
    </footer>
  );
}
