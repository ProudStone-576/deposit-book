/**
 * Next runs this once when the server boots. Config is checked here so a
 * misconfigured deployment fails immediately and visibly, rather than serving
 * with a forgeable signing key or an unknown timezone.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionConfig } = await import("./lib/env");
  assertProductionConfig();
}
