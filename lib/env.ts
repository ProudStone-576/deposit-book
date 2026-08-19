import "server-only";
import path from "node:path";

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

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    problems.push("DATABASE_URL is not set.");
  } else if (isProd && /^file:(?![/\]|[A-Za-z]:)/.test(dbUrl)) {
    problems.push(
      `DATABASE_URL "${dbUrl}" is a relative path. In production the server's ` +
        "working directory is not the project root, so a relative path can " +
        "silently point at the wrong file. Use an absolute one.",
    );
  }

  // A relative backup directory resolves against the server's working
  // directory, which for a standalone build is inside .next/. Backups written
  // there are destroyed by the next build, without anyone noticing.
  const backupDir = process.env.BACKUP_DIR;
  if (isProd && backupDir && !path.isAbsolute(backupDir)) {
    problems.push(
      `BACKUP_DIR "${backupDir}" is relative. Use an absolute path so backups ` +
        "cannot land inside the build output and be deleted by a deploy.",
    );
  }
  const mirrorDir = process.env.BACKUP_MIRROR_DIR;
  if (isProd && mirrorDir && !path.isAbsolute(mirrorDir)) {
    problems.push(`BACKUP_MIRROR_DIR "${mirrorDir}" is relative. Use an absolute path.`);
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
