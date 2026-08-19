/**
 * Restore the book from a backup.
 *
 *   npm run db:restore                    # list what is available
 *   npm run db:restore -- <file> --yes    # replace the live database
 *
 * Before overwriting anything it takes a safety copy of the current database,
 * so a restore of the wrong file is itself recoverable.
 */
import { PrismaClient } from "@prisma/client";
import { copyFileSync, existsSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { listBackups, BACKUP_DIR, fileUrl } from "../lib/backup";

function livePath(): string {
  const url = process.env.DATABASE_URL ?? "";
  const m = url.match(/^file:(.*)$/);
  if (!m) {
    throw new Error(`DATABASE_URL is not a SQLite file url: ${url || "(unset)"}`);
  }
  const p = m[1];
  // Prisma resolves relative urls against the prisma/ directory.
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), "prisma", p);
}

async function describe(file: string) {
  const db = new PrismaClient({ datasources: { db: { url: fileUrl(file) } } });
  try {
    const rows = await db.$queryRawUnsafe<{ integrity_check: string }[]>(
      "PRAGMA integrity_check",
    );
    const integrity = rows?.[0]?.integrity_check ?? "unknown";
    const deposits = await db.deposit.count();
    const stores = await db.store.count();
    const newest = await db.deposit.findFirst({
      orderBy: { businessDate: "desc" },
      select: { businessDate: true },
    });
    return { integrity, deposits, stores, newest: newest?.businessDate ?? "none" };
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const yes = args.includes("--yes");
  const chosen = args.find((a) => !a.startsWith("--"));

  if (!chosen) {
    const files = listBackups();
    if (!files.length) {
      console.log(`No backups found in ${BACKUP_DIR}.`);
      return;
    }
    console.log(`Backups in ${BACKUP_DIR}:\n`);
    for (const f of files.slice(0, 20)) {
      const d = await describe(f.file);
      console.log(
        `  ${path.basename(f.file)}  ${f.mtime.toLocaleString("en-CA")}  ` +
          `${d.deposits} deposits, latest ${d.newest}, integrity ${d.integrity}`,
      );
    }
    console.log(`\nTo restore:  npm run db:restore -- <file> --yes`);
    return;
  }

  const source = path.isAbsolute(chosen) ? chosen : path.join(BACKUP_DIR, chosen);
  if (!existsSync(source)) throw new Error(`No such backup: ${source}`);

  console.log("");
  console.log("  STOP THE APP BEFORE RESTORING. Overwriting a database that a");
  console.log("  running server has open will corrupt it.");

  const info = await describe(source);
  if (info.integrity !== "ok") {
    throw new Error(`Refusing to restore: integrity check says "${info.integrity}".`);
  }

  const live = livePath();
  console.log("");
  console.log(`  Restore from: ${source}`);
  console.log(`                ${info.deposits} deposits, ${info.stores} stores, latest ${info.newest}`);
  console.log(`  Onto:         ${live}`);
  if (existsSync(live)) {
    const cur = await describe(live);
    console.log(`                currently ${cur.deposits} deposits, latest ${cur.newest}`);
  }
  console.log("");

  if (!yes) {
    console.log("  This REPLACES the live database. Re-run with --yes to proceed.");
    process.exitCode = 1;
    return;
  }

  // In WAL mode the database is three files. Copying only the main one over
  // leaves the old -wal beside it, and SQLite then replays those stale writes
  // on top of the restored data — the restore appears to work and silently
  // gives you the wrong book. Move all three aside, then clear the sidecars.
  const sidecars = [`${live}-wal`, `${live}-shm`];
  const stamp = Date.now();

  if (existsSync(live)) {
    copyFileSync(live, `${live}.replaced-${stamp}`);
    for (const f of sidecars) {
      if (existsSync(f)) copyFileSync(f, `${f}.replaced-${stamp}`);
    }
    console.log(`  Current database copied aside as *.replaced-${stamp}`);
  }

  copyFileSync(source, live);
  for (const f of sidecars) {
    if (existsSync(f)) {
      unlinkSync(f);
      console.log(`  Removed stale ${path.basename(f)}`);
    }
  }
  console.log(`  Restored ${(statSync(live).size / 1024).toFixed(0)} KB.`);

  const after = await describe(live);
  console.log(`  Live database now holds ${after.deposits} deposits (integrity ${after.integrity}).`);
  console.log("  Start the app again.");
  console.log("");
}

main().catch((e) => {
  console.error("Restore FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
