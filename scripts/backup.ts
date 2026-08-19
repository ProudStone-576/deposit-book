/**
 * Point-in-time backup of the SQLite database.
 *
 *   npm run db:backup
 *
 * Uses SQLite's own VACUUM INTO, which produces a consistent copy while the app
 * keeps serving — safe to run from a scheduled task against the live file.
 *
 * Keeps the newest KEEP files and deletes older ones.
 *   BACKUP_DIR   where to write (default ./backups)
 *   BACKUP_KEEP  how many to retain (default 30)
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");
const KEEP = Number(process.env.BACKUP_KEEP ?? 30);

const prisma = new PrismaClient();

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });

  const target = path.join(BACKUP_DIR, `deposits-${stamp()}.db`);

  // VACUUM INTO refuses to overwrite, so a name collision fails loudly.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

  const deposits = await prisma.deposit.count();
  const size = statSync(target).size;
  console.log(
    `Backed up ${deposits} deposits to ${target} (${(size / 1024).toFixed(0)} KB)`,
  );

  const old = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("deposits-") && f.endsWith(".db"))
    .sort()
    .reverse()
    .slice(KEEP);

  for (const f of old) {
    unlinkSync(path.join(BACKUP_DIR, f));
    console.log(`Removed old backup ${f}`);
  }

  if (!old.length) console.log(`Retention: keeping the newest ${KEEP}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Backup FAILED:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
