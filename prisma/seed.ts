/**
 * Production seed: the 15 stores, their managers, and the Company Admin.
 *
 * This creates NO deposits and NO history. The books start empty on the day
 * you run it, and the first real numbers are the ones managers enter.
 *
 * Store numbers are text on purpose — four of them carry a leading zero.
 *
 * The Company Admin PIN comes from ADMIN_PIN (OWNER_PIN is still honoured for
 * anything already configured). If neither is set a random one is generated and
 * printed once — write it down.
 */
import { PrismaClient } from "@prisma/client";
import { randomInt } from "node:crypto";
import { hashPin } from "../lib/pin";
import { todayYmd } from "../lib/dates";

const prisma = new PrismaClient();

const STORES = [
  { storeNumber: "02627", name: "Gas Bar", city: "Abbotsford" },
  { storeNumber: "68295", name: "Townline", city: "Abbotsford" },
  { storeNumber: "69830", name: "Whatcom", city: "Abbotsford" },
  { storeNumber: "69910", name: "Clearbrook", city: "Abbotsford" },
  { storeNumber: "69926", name: "Sumas", city: "Abbotsford" },
  { storeNumber: "69975", name: "King", city: "Abbotsford" },
  { storeNumber: "36997", name: "Sardis", city: "Chilliwack" },
  { storeNumber: "78057", name: "Evans", city: "Chilliwack" },
  { storeNumber: "02631", name: "Horne St", city: "Mission" },
  { storeNumber: "37815", name: "7th Ave", city: "Mission" },
  { storeNumber: "77947", name: "Aldergrove", city: "Aldergrove" },
  { storeNumber: "38866", name: "Langley", city: "Langley" },
  { storeNumber: "91214", name: "Hope", city: "Hope" },
  { storeNumber: "0013", name: "A&W King Rd", city: "Abbotsford" },
  { storeNumber: "0014", name: "A&W Aldergrove", city: "Aldergrove" },
];

// Every day of the week: 0 = Sunday .. 6 = Saturday.
const DEPOSIT_DAYS = "0,1,2,3,4,5,6";

async function main() {
  const configuredPin = process.env.ADMIN_PIN || process.env.OWNER_PIN;
  const adminPin = configuredPin ?? String(randomInt(100000, 1000000));
  const generated = !configuredPin;
  const startDate = todayYmd();

  // This seed wipes the books. Once real deposits exist, refuse to run unless
  // someone deliberately asks for it — a stray `npm run db:seed` must never be
  // able to delete a month of takings.
  const existing = await prisma.deposit.count();
  if (existing > 0 && process.env.FORCE_RESEED !== "1") {
    console.error("");
    console.error(`  Refusing to seed: ${existing} deposits are already recorded.`);
    console.error("  Seeding would delete them.");
    console.error("");
    console.error("  Back up prisma/dev.db first, then re-run with FORCE_RESEED=1");
    console.error("  if you really mean to erase the books.");
    console.error("");
    process.exit(1);
  }

  // Start clean: this seed is the beginning of the record, not an addition.
  await prisma.auditLog.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();

  for (const s of STORES) {
    const store = await prisma.store.create({
      data: {
        storeNumber: s.storeNumber,
        name: s.name,
        city: s.city,
        depositDays: DEPOSIT_DAYS,
        startDate,
      },
    });
    await prisma.user.create({
      data: {
        name: `${s.name} manager`,
        role: "MANAGER",
        loginCode: s.storeNumber,
        pinHash: null, // managers sign in with their store number alone
        storeId: store.id,
      },
    });
  }

  await prisma.user.create({
    data: {
      name: "Company Admin",
      role: "OWNER",
      loginCode: "OWNER",
      pinHash: hashPin(adminPin),
      storeId: null,
    },
  });

  const cities = [...new Set(STORES.map((s) => s.city))].sort();

  console.log("");
  console.log(`  ${STORES.length} stores created across ${cities.length} cities.`);
  console.log(`  Cities:      ${cities.join(", ")}`);
  console.log(`  Deposits due: every day of the week`);
  console.log(`  Records begin: ${startDate} (no earlier day is flagged as missed)`);
  console.log("");
  console.log("  Managers sign in with their store number. No PIN.");
  if (generated) {
    console.log("");
    console.log("  ┌──────────────────────────────────────────────┐");
    console.log(`  │  COMPANY ADMIN PIN: ${adminPin}                 │`);
    console.log("  │  Shown once. Store it somewhere safe.        │");
    console.log("  └──────────────────────────────────────────────┘");
    console.log("");
    console.log("  Set ADMIN_PIN in the environment to choose it yourself.");
  } else {
    console.log("  Company Admin signs in on the Company Admin tab with the configured PIN.");
  }
  console.log("");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
