import { backupStatus } from "@/lib/schedule";

/**
 * A backup system nobody can see is a backup system nobody trusts. This puts
 * the last successful copy in front of the Company Admin on every visit.
 */
export function BackupStatus() {
  const s = backupStatus();

  const stale = s.overdue;
  const bad = !!s.lastError || !s.lastAt;

  const tone = bad || stale ? "notice-miss" : "notice-quiet";

  return (
    <p className={`notice ${tone} flex flex-wrap items-center gap-x-2`}>
      <span className="eyebrow">Backup</span>
      {s.lastError ? (
        <span>Last attempt failed: {s.lastError}</span>
      ) : s.lastAt ? (
        <span>
          Last copy {s.lastAt.toLocaleString("en-CA", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          {" · "}
          {s.count} kept
          {stale && " · overdue"}
        </span>
      ) : (
        <span>No backup taken yet. One runs shortly after startup.</span>
      )}
    </p>
  );
}
