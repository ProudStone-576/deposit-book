/**
 * Manual backup, on top of the timer the app runs itself.
 *
 *   npm run db:backup
 *
 * Safe to run while the app is serving.
 */
import { PrismaClient } from "@prisma/client";
import { runBackup, BACKUP_MIRROR_DIR } from "../lib/backup";

const prisma = new PrismaClient();

async function main() {
  const r = await runBackup(prisma);
  console.log(`Backed up ${r.deposits} deposits to ${r.file} (${(r.bytes / 1024).toFixed(0)} KB)`);
  if (r.mirrored) console.log(`Mirrored to ${r.mirrored}`);
  else if (!BACKUP_MIRROR_DIR)
    console.log("No mirror configured. Set BACKUP_MIRROR_DIR to keep a copy off this disk.");
  if (r.prunedCount) console.log(`Pruned ${r.prunedCount} old backup(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Backup FAILED:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
