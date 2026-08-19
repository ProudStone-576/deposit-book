import { PrismaClient } from "@prisma/client";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";

/**
 * Backups of the deposit book.
 *
 * The rules this follows, in order of how much they matter:
 *
 *  1. A backup nobody runs is not a backup, so this runs itself on a timer.
 *  2. A backup on the same disk as the original is not a backup, so every copy
 *     is mirrored to BACKUP_MIRROR_DIR when one is configured.
 *  3. A backup nobody has opened is not a backup, so each copy is checked with
 *     PRAGMA integrity_check and deleted if it comes back bad.
 *
 * VACUUM INTO produces a consistent snapshot while the app keeps serving, so
 * none of this needs downtime.
 */

// Always absolute. A relative value here would resolve against whatever
// directory the process happens to start in.
export const BACKUP_DIR = path.resolve(
  process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups"),
);
export const BACKUP_MIRROR_DIR = process.env.BACKUP_MIRROR_DIR
  ? path.resolve(process.env.BACKUP_MIRROR_DIR)
  : "";
export const BACKUP_KEEP = Number(process.env.BACKUP_KEEP ?? 30);

export type BackupResult = {
  file: string;
  bytes: number;
  deposits: number;
  mirrored: string | null;
  prunedCount: number;
};

/**
 * Prisma wants a forward-slash url even on Windows, where path.join hands back
 * backslashes. Without this the integrity check cannot open its own copy.
 */
export function fileUrl(p: string): string {
  return `file:${path.resolve(p).split(path.sep).join("/")}`;
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

export function listBackups(dir = BACKUP_DIR): { file: string; mtime: Date; bytes: number }[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.startsWith("deposits-") && f.endsWith(".db"))
      .map((f) => {
        const full = path.join(dir, f);
        const st = statSync(full);
        return { file: full, mtime: st.mtime, bytes: st.size };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  } catch {
    return [];
  }
}

/**
 * Open the copy we just made and ask SQLite whether it is sound. A corrupt
 * backup that sits in the folder looking healthy is worse than no backup,
 * because it is trusted.
 */
async function verifyCopy(file: string): Promise<string> {
  const probe = new PrismaClient({
    datasources: { db: { url: fileUrl(file) } },
  });
  try {
    const rows = await probe.$queryRawUnsafe<{ integrity_check: string }[]>(
      "PRAGMA integrity_check",
    );
    const verdict = rows?.[0]?.integrity_check ?? "unknown";
    if (verdict !== "ok") return verdict;
    // A structurally sound file that cannot answer the only question that
    // matters is still a failure.
    await probe.$queryRawUnsafe("SELECT COUNT(*) FROM Deposit");
    return "ok";
  } catch (e) {
    return `unreadable: ${(e as Error).message}`;
  } finally {
    await probe.$disconnect();
  }
}

export async function runBackup(prisma: PrismaClient): Promise<BackupResult> {
  mkdirSync(BACKUP_DIR, { recursive: true });

  const target = path.join(BACKUP_DIR, `deposits-${stamp()}.db`);

  // VACUUM INTO refuses to overwrite, so a name collision fails loudly.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

  const verdict = await verifyCopy(target);
  if (verdict !== "ok") {
    try {
      unlinkSync(target);
    } catch {
      /* leave it for inspection if it will not delete */
    }
    throw new Error(`Backup failed its integrity check (${verdict}); copy discarded.`);
  }

  const deposits = await prisma.deposit.count();
  const bytes = statSync(target).size;

  // Second copy, ideally on another disk or a mounted share.
  let mirrored: string | null = null;
  if (BACKUP_MIRROR_DIR) {
    try {
      mkdirSync(BACKUP_MIRROR_DIR, { recursive: true });
      const dest = path.join(BACKUP_MIRROR_DIR, path.basename(target));
      copyFileSync(target, dest);
      mirrored = dest;
    } catch (e) {
      // A failed mirror must not lose us the local copy we already verified.
      console.error(`[backup] mirror to ${BACKUP_MIRROR_DIR} failed:`, e);
    }
  }

  // Prune both locations to the same depth.
  let prunedCount = 0;
  for (const dir of [BACKUP_DIR, ...(BACKUP_MIRROR_DIR ? [BACKUP_MIRROR_DIR] : [])]) {
    for (const old of listBackups(dir).slice(BACKUP_KEEP)) {
      try {
        unlinkSync(old.file);
        prunedCount++;
      } catch {
        /* ignore */
      }
    }
  }

  return { file: target, bytes, deposits, mirrored, prunedCount };
}
