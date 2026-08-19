/**
 * Product mark: a coin dropping through a ring — deposit, in one glyph.
 * Drawn inline so it inherits colour and stays crisp at any size.
 */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="16" cy="16" r="13" stroke="var(--brand)" strokeWidth="3.5" />
      <path
        d="M16 9.5v13M12.5 19.5l3.5 3.5 3.5-3.5"
        stroke="var(--accent)"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <BrandMark size={size} />
      <span className="text-[0.9375rem] font-extrabold tracking-[-0.02em] text-ink">
        Deposit<span className="text-ink3">Book</span>
      </span>
    </span>
  );
}
