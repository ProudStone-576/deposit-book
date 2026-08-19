/**
 * `output: "standalone"` emits a self-contained server but does not copy the
 * static assets next to it. Do that here so `node .next/standalone/server.js`
 * serves a complete site, both locally and in the container.
 */
import { cpSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.log("postbuild: no standalone output, nothing to copy.");
  process.exit(0);
}

cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});

if (existsSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public"), path.join(standalone, "public"), {
    recursive: true,
  });
}

console.log("postbuild: static assets copied into .next/standalone");
