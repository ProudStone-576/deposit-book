/**
 * Write the whole book to a CSV file, for an off-provider copy.
 *
 *   npm run db:export                 # ./exports/deposit-book-YYYY-MM-DD.csv
 *   npm run db:export -- /path/out.csv
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { depositsCsv, bookSummary } from "../lib/export";
import { prisma } from "../lib/db";
import { todayYmd } from "../lib/dates";
import { fmt } from "../lib/money";

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const out = arg
    ? path.resolve(arg)
    : path.resolve(process.cwd(), "exports", `deposit-book-${todayYmd()}.csv`);

  mkdirSync(path.dirname(out), { recursive: true });
  const csv = await depositsCsv();
  writeFileSync(out, csv, "utf8");

  const s = await bookSummary();
  console.log(`Exported ${s.deposits} deposits (${fmt(s.totalCents)} active) to ${out}`);
  console.log("Keep this somewhere that is not Neon and not this machine.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Export FAILED:", e);
  await prisma.$disconnect();
  process.exit(1);
});
