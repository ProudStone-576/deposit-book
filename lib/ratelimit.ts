/**
 * In-memory rate limiter for sign-in attempts.
 *
 * This app is deployed as a single long-running Node process, so a Map is the
 * whole story — no Redis, nothing to operate. If it is ever run as more than
 * one process, this becomes per-process and needs a shared store.
 */

type Bucket = { hits: number[]; lockedUntil: number };

const buckets = new Map<string, Bucket>();

// Stop the map growing without bound on a long-lived process.
const MAX_KEYS = 5000;

export type RateVerdict =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export function checkRate(
  key: string,
  opts: { limit: number; windowMs: number; lockMs: number },
): RateVerdict {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [], lockedUntil: 0 };

  if (bucket.lockedUntil > now) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1000),
    };
  }

  bucket.hits = bucket.hits.filter((t) => now - t < opts.windowMs);
  if (bucket.hits.length >= opts.limit) {
    bucket.lockedUntil = now + opts.lockMs;
    bucket.hits = [];
    buckets.set(key, bucket);
    return { ok: false, retryAfterSeconds: Math.ceil(opts.lockMs / 1000) };
  }

  return { ok: true };
}

/** Call on a failed attempt. Successes should never count against the limit. */
export function recordFailure(key: string, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [], lockedUntil: 0 };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  bucket.hits.push(now);
  buckets.set(key, bucket);

  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      if (b.lockedUntil < now && b.hits.length === 0) buckets.delete(k);
      if (buckets.size <= MAX_KEYS) break;
    }
  }
}

/** Call on success, so a manager who mistypes twice is not punished later. */
export function clearRate(key: string): void {
  buckets.delete(key);
}

/** Test seam. */
export function resetAllRates(): void {
  buckets.clear();
}
