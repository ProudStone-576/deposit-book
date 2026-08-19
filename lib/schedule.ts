import "server-only";
import { prisma } from "./db";
import { listBackups, runBackup, BACKUP_DIR } from "./backup";

/**
 * The backup timer.
 *
 * Runs shortly after boot and then every BACKUP_INTERVAL_HOURS. Deliberately
 * in-process: a cron job on the host is one more thing that can be missing on
 * the day it is needed, and this way starting the app is the only step.
 */

const INTERVAL_HOURS = Number(process.env.BACKUP_INTERVAL_HOURS ?? 6);
const STARTUP_DELAY_MS = 30_000;

const globalForSchedule = globalThis as unknown as {
  backupTimer?: NodeJS.Timeout;
  lastBackupAt?: Date | null;
  lastBackupError?: string | null;
};

export function backupStatus(): {
  lastAt: Date | null;
  lastError: string | null;
  count: number;
  newestFile: string | null;
  intervalHours: number;
  overdue: boolean;
} {
  const files = listBackups();
  const lastAt = globalForSchedule.lastBackupAt ?? files[0]?.mtime ?? null;
  const hoursSince = lastAt ? (Date.now() - lastAt.getTime()) / 3_600_000 : Infinity;
  return {
    lastAt,
    lastError: globalForSchedule.lastBackupError ?? null,
    count: files.length,
    newestFile: files[0]?.file ?? null,
    intervalHours: INTERVAL_HOURS,
    overdue: hoursSince > INTERVAL_HOURS * 2,
  };
}

async function once(reason: string) {
  try {
    const r = await runBackup(prisma);
    globalForSchedule.lastBackupAt = new Date();
    globalForSchedule.lastBackupError = null;
    console.log(
      `[backup] ${reason}: ${r.deposits} deposits -> ${r.file}` +
        ` (${(r.bytes / 1024).toFixed(0)} KB)` +
        (r.mirrored ? `, mirrored to ${r.mirrored}` : "") +
        (r.prunedCount ? `, pruned ${r.prunedCount}` : ""),
    );
  } catch (e) {
    globalForSchedule.lastBackupError = (e as Error).message;
    // Loud, because a silent backup failure is how books get lost.
    console.error(`[backup] FAILED (${reason}):`, e);
  }
}

export function startBackupSchedule(): void {
  if (globalForSchedule.backupTimer) return; // survives hot reload in dev
  if (process.env.BACKUP_DISABLED === "1") {
    console.log("[backup] disabled by BACKUP_DISABLED=1");
    return;
  }

  console.log(
    `[backup] scheduled every ${INTERVAL_HOURS}h into ${BACKUP_DIR}` +
      (process.env.BACKUP_MIRROR_DIR
        ? `, mirrored to ${process.env.BACKUP_MIRROR_DIR}`
        : " (no mirror configured — set BACKUP_MIRROR_DIR)"),
  );

  // One shortly after boot, so a fresh deploy is covered immediately.
  const kickoff = setTimeout(() => void once("startup"), STARTUP_DELAY_MS);
  kickoff.unref?.();

  const timer = setInterval(
    () => void once("scheduled"),
    INTERVAL_HOURS * 60 * 60 * 1000,
  );
  timer.unref?.();
  globalForSchedule.backupTimer = timer;
}
