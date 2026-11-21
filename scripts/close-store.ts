/**
 * Put a store on a temporary closure, or take it off one, without touching the
 * books.
 *
 *   npm run store:close -- 68295 2026-10-31              # shut from today through Oct 31
 *   npm run store:close -- 68295 2026-10-31 2026-09-20   # shut from Sep 20 through Oct 31
 *   npm run store:close -- 68295 2026-11-14              # already closed: move the end date only
 *   npm run store:close -- 68295 --indefinite            # shut from today, no end date
 *   npm run store:close -- 68295 --indefinite 2026-09-20 # shut from Sep 20, no end date
 *   npm run store:close -- 68295 --open                  # back to the normal schedule now
 *
 * With no `from`, a store that already has a closure keeps its start date, so
 * changing the end date never rewrites the days already closed. Pass `from`
 * explicitly to start a fresh window instead.
 *
 * `--open` ends a closure that has already started as of yesterday rather than
 * erasing it, so the days it covered stay "closed" instead of turning into
 * misses. Only a closure that has not started yet is cleared outright.
 *
 * `--indefinite` leaves the end date empty: the store stays closed until someone
 * runs `--open` (or gives it an end date). Its only positional date is `from`.
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
import { addDays, isYmd, todayYmd } from "../lib/dates";

async function main() {
  const args = process.argv.slice(2);
  const reopen = args.includes("--open");
  const indefinite = args.includes("--indefinite");
  const positional = args.filter((a) => !a.startsWith("--"));
  const storeNumber = positional[0];
  // With --indefinite there is no end date, so the one date given is the start.
  const until: string | null = indefinite ? null : positional[1];
  const from: string | undefined = indefinite ? positional[1] : positional[2];

  if (!storeNumber || (reopen && indefinite) || (!reopen && !indefinite && !until)) {
    console.error("Usage: npm run store:close -- <storeNumber> <untilYmd> [fromYmd]");
    console.error("       npm run store:close -- <storeNumber> --indefinite [fromYmd]");
    console.error("       npm run store:close -- <storeNumber> --open");
    process.exit(1);
  }

  const store = await prisma.store.findUnique({ where: { storeNumber } });
  if (!store) {
    console.error(`No store with number "${storeNumber}".`);
    process.exit(1);
  }

  const today = todayYmd();

  if (reopen) {
    const yesterday = addDays(today, -1);
    if (!store.closedFrom && !store.closedUntil) {
      console.log(`${store.storeNumber} — ${store.name} has no closure. Nothing to do.`);
      await prisma.$disconnect();
      return;
    }
    if (store.closedUntil && store.closedUntil < today) {
      console.log(
        `${store.storeNumber} — ${store.name}'s closure already ended ${store.closedUntil}. Nothing to do.`,
      );
      await prisma.$disconnect();
      return;
    }
    // A closure that has started keeps its past days: end it yesterday. One
    // that has not started yet covers no history, so it can simply go.
    const started = !store.closedFrom || store.closedFrom <= yesterday;
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: started
        ? { closedUntil: yesterday }
        : { closedFrom: null, closedUntil: null },
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
          now: { closedFrom: updated.closedFrom, closedUntil: updated.closedUntil },
          via: "store:close",
        }),
      },
    });
    console.log(`${updated.storeNumber} — ${updated.name} is open again, from today.`);
    if (updated.closedUntil) {
      console.log(`  Closed days kept on the books: ${updated.closedFrom ?? "(start)"} through ${updated.closedUntil}.`);
    }
    await prisma.$disconnect();
    return;
  }

  // Keep an existing window's start unless told otherwise, so moving the end
  // date cannot un-close days that are already history.
  const start = from ?? store.closedFrom ?? today;
  if (!isYmd(start) || (until !== null && !isYmd(until))) {
    console.error(`Dates must be YYYY-MM-DD, got "${start}" and "${until}".`);
    process.exit(1);
  }
  if (until !== null && until < start) {
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
  if (updated.closedUntil) {
    console.log(`  No deposit required ${updated.closedFrom} through ${updated.closedUntil}.`);
    console.log(`  Deposits expected again from the day after ${updated.closedUntil}.`);
  } else {
    console.log(`  No deposit required from ${updated.closedFrom}, with no end date.`);
    console.log(`  Reopen with: npm run store:close -- ${updated.storeNumber} --open`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
