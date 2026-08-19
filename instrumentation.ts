/**
 * Next runs this once when the server boots.
 *
 * It starts the backup timer, so protecting the book does not depend on
 * someone remembering to run a command or on a cron job that nobody notices
 * has stopped.
 */
export async function register() {
  // Only in the Node runtime — the edge runtime has no filesystem.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertProductionConfig } = await import("./lib/env");
  assertProductionConfig();

  const { startBackupSchedule } = await import("./lib/schedule");
  startBackupSchedule();
}
