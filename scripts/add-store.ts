/**
 * Add a store (and its manager sign-in) to a live database, without touching
 * the books.
 *
 *   npm run store:add -- 0013 "A&W King Rd" Abbotsford
 *   npm run store:add -- 0014 "A&W Aldergrove" Aldergrove
 *
 * The seed can create stores too, but it erases every deposit on the way. This
 * is the safe way to open a new store once the system is in use.
 *
 * Re-running with the same store number updates the name and city instead of
 * failing, so a typo is fixable. It never moves the startDate: the store's
 * first day on the system stays the day it was actually added, so the days
 * before it are never flagged as missed.
 */
import { prisma } from "../lib/db";
import { todayYmd } from "../lib/dates";

const DEPOSIT_DAYS = "0,1,2,3,4,5,6";

async function main() {
  const [storeNumber, name, city] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

  if (!storeNumber || !name || !city) {
    console.error('Usage: npm run store:add -- <storeNumber> "<name>" "<city>"');
    process.exit(1);
  }
  // Text, not a number: leading zeros are part of the store number.
  if (!/^\d{1,5}$/.test(storeNumber)) {
    console.error(`Store number must be 1-5 digits, got "${storeNumber}".`);
    process.exit(1);
  }

  const existing = await prisma.store.findUnique({ where: { storeNumber } });

  const store = await prisma.store.upsert({
    where: { storeNumber },
    update: { name, city },
    create: { storeNumber, name, city, depositDays: DEPOSIT_DAYS, startDate: todayYmd() },
  });

  // The manager signs in with the store number alone, so the login code is the
  // store number and there is no PIN.
  const manager = await prisma.user.upsert({
    where: { loginCode: storeNumber },
    update: { name: `${name} manager`, storeId: store.id, active: true },
    create: {
      name: `${name} manager`,
      role: "MANAGER",
      loginCode: storeNumber,
      pinHash: null,
      storeId: store.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: null,
      userName: "script",
      action: existing ? "STORE_UPDATED" : "STORE_CREATED",
      entity: "Store",
      entityId: store.id,
      detail: JSON.stringify({ storeNumber, name, city, via: "store:add" }),
    },
  });

  const total = await prisma.store.count();
  console.log(
    `${existing ? "Updated" : "Added"} ${store.storeNumber} — ${store.name}, ${store.city}.`,
  );
  console.log(`  Records begin: ${store.startDate}`);
  console.log(`  Manager signs in with ${manager.loginCode}. No PIN.`);
  console.log(`  ${total} stores now on the system.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
