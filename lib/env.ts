import "server-only";

/**
 * Configuration is checked once, loudly, at boot. A deposit system that starts
 * with a placeholder signing key or an unknown timezone is worse than one that
 * refuses to start — the failure would otherwise show up as wrong dates or
 * forgeable sessions weeks later.
 */

const PLACEHOLDERS = [
  "dev-only-change-me-to-a-long-random-string-in-production-0123456789",
  "changeme",
  "secret",
];

function fail(lines: string[]): never {
  throw new Error(
    ["", "Deposit Book cannot start:", ...lines.map((l) => `  - ${l}`), ""].join("\n"),
  );
}

export function assertProductionConfig(): void {
  const problems: string[] = [];
  const isProd = process.env.NODE_ENV === "production";

  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    problems.push(
      "SESSION_SECRET is missing or shorter than 32 characters. Generate one with:\n" +
        "      node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    );
  } else if (isProd && PLACEHOLDERS.includes(secret)) {
    problems.push(
      "SESSION_SECRET is still the development placeholder. Anyone with that " +
        "string can forge a signed-in session.",
    );
  }

  if (!process.env.DATABASE_URL) {
    problems.push("DATABASE_URL is not set.");
  }

  const tz = process.env.BUSINESS_TZ;
  if (tz) {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    } catch {
      problems.push(`BUSINESS_TZ "${tz}" is not a timezone this system knows.`);
    }
  } else if (isProd) {
    problems.push(
      "BUSINESS_TZ is not set. Without it the host clock decides what 'today' " +
        "means, and a UTC server files evening deposits under tomorrow.",
    );
  }

  if (problems.length) fail(problems);
}
