/**
 * Next calls this once when the server starts.
 *
 * Config is checked here rather than in a layout, because module-scope checks
 * in the app tree also run during `next build` — and a build machine has no
 * business holding production secrets. The phase guard covers the case where
 * the build evaluates instrumentation too.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { assertProductionConfig } = await import("./lib/env");
  assertProductionConfig();
}
