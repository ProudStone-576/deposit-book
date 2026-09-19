/**
 * Put a store on a temporary closure, or take it off one, without touching the
 * books.
 *
 *   npm run store:close -- 68295 2026-10-31              # shut from today through Oct 31
 *   npm run store:close -- 68295 2026-10-31 2026-09-20   # shut from Sep 20 through Oct 31
 *   npm run store:close -- 68295 --open                  # back to the normal schedule now
 *
 * Inside the window no deposit is expected: those days read "no deposit
 * expected" on both calendars and are never counted as missed. The window is
 * inclusive at both ends, so the store is due again the day after `until` on
 * its own — nobody has to remember to re-open it.
 *
 * This is deliberately not `active: false`. A closed store stays on every list,
 * keeps its manager sign-in, and its days outside the window are left exactly
 * as they are. Money filed during the window still counts everywhere; the
 * window only ever suppresses the *miss*.
 */
import { prisma } from "../lib/db";
import { isYmd, todayYmd } from "../lib/dates";

async function main() {
  const args = process.argv.slice(2);
  const reopen = args.includes("--open");
  const [storeNumber, until, from] = args.filter((a) => !a.startsWith("--"));

  if (!storeNumber || (!reopen && !until)) {
    console.error("Usage: npm run store:close -- <storeNumber> <untilYmd> [fromYmd]");
    console.error("       npm run store:close -- <storeNumber> --open");
    process.exit(1);
  }

  const store = await prisma.store.findUnique({ where: { storeNumber } });
  if (!store) {
    console.error(`No store with number "${storeNumber}".`);
    process.exit(1);
  }

  if (reopen) {
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: { closedFrom: null, closedUntil: null },
    });
    await prisma.auditLog.create({
      data: {
        userId: null,
        userName: "script",
        action: "STORE_REOPENED",
        entity: "Store",
        entityId: store.id,
        detail: JSON.stringify({
          storeNumber,
          was: { closedFrom: store.closedFrom, closedUntil: store.closedUntil },
          via: "store:close",
        }),
      },
    });
    console.log(`${updated.storeNumber} — ${updated.name} is open again, from today.`);
    await prisma.$disconnect();
    return;
  }

  const start = from ?? todayYmd();
  if (!isYmd(start) || !isYmd(until)) {
    console.error(`Dates must be YYYY-MM-DD, got "${start}" and "${until}".`);
    process.exit(1);
  }
  if (until < start) {
    console.error(`The closure ends (${until}) before it starts (${start}).`);
    process.exit(1);
  }

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: { closedFrom: start, closedUntil: until },
  });

  await prisma.auditLog.create({
    data: {
      userId: null,
      userName: "script",
      action: "STORE_CLOSED",
      entity: "Store",
      entityId: store.id,
      detail: JSON.stringify({
        storeNumber,
        closedFrom: start,
        closedUntil: until,
        was: { closedFrom: store.closedFrom, closedUntil: store.closedUntil },
        via: "store:close",
      }),
    },
  });

  console.log(`${updated.storeNumber} — ${updated.name}, ${updated.city}`);
  console.log(`  No deposit required ${updated.closedFrom} through ${updated.closedUntil}.`);
  console.log(`  Deposits expected again from the day after ${updated.closedUntil}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
