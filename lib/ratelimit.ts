import { prisma } from "./db";

/**
 * Sign-in throttling, recorded in the database.
 *
 * This used to be a Map in memory. That works for one long-running server and
 * is worthless on serverless, where each request may land in a fresh process
 * with an empty map — an attacker gets unlimited guesses simply by being spread
 * across instances. The counter has to live where every instance can see it.
 */

export type RateVerdict =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export async function checkRate(
  key: string,
  opts: { limit: number; windowMs: number; lockMs: number },
): Promise<RateVerdict> {
  const now = Date.now();
  const windowStart = new Date(now - opts.windowMs);

  const failures = await prisma.loginAttempt.findMany({
    where: { key, success: false, at: { gte: windowStart } },
    orderBy: { at: "desc" },
    select: { at: true },
  });

  if (failures.length < opts.limit) return { ok: true };

  // Locked from the moment of the attempt that crossed the line.
  const trigger = failures[opts.limit - 1].at.getTime();
  const until = trigger + opts.lockMs;
  if (until <= now) return { ok: true };

  return { ok: false, retryAfterSeconds: Math.ceil((until - now) / 1000) };
}

export async function recordFailure(key: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { key, success: false } });
}

/** A success clears the slate, so a manager who mistypes is not punished later. */
export async function clearRate(key: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key } });
}

/**
 * Housekeeping. Called opportunistically on sign-in rather than on a schedule,
 * so it needs no cron and cannot silently stop running.
 */
export async function pruneOldAttempts(olderThanMs = 24 * 60 * 60 * 1000): Promise<void> {
  await prisma.loginAttempt.deleteMany({
    where: { at: { lt: new Date(Date.now() - olderThanMs) } },
  });
}
