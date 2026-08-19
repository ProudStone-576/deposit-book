/**
 * Money rules for this app:
 *  - Every amount lives in the database as an integer number of CENTS.
 *  - We never do arithmetic on floats.
 *  - A deposit amount is only accepted after the manager types it twice.
 */

/**
 * Parse a dollar string ("1,234.50", "$1234.5", "1234") to integer cents.
 * Returns null if it is not a clean, unambiguous money value.
 */
export function parseDollarsToCents(raw: string): number | null {
  const t = String(raw ?? "").trim().replace(/^\$/, "").replace(/\s/g, "");
  if (t === "") return null;
  // Either plain digits, or properly grouped thousands. "12,3" is a typo, not money.
  const plain = /^\d+(\.\d{1,2})?$/;
  const grouped = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/;
  if (!plain.test(t) && !grouped.test(t)) return null;
  const s = t.replace(/,/g, "");
  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

/** 123456 -> "$1,234.56" */
export function fmt(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100).toLocaleString("en-CA");
  const rem = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}$${dollars}.${rem}`;
}

/** 123456 -> "1234.56" (for prefilling inputs) */
export function toDollarString(cents: number): string {
  return (Math.trunc(cents) / 100).toFixed(2);
}
