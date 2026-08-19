/**
 * End-to-end sanity check against a running dev server (npm run dev).
 *   npx tsx --env-file=.env scripts/verify.ts
 *
 * Covers the two things this system cannot get wrong:
 *   1. the arithmetic
 *   2. one store never seeing another store's numbers
 */
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";
import { parseDollarsToCents, fmt } from "../lib/money";
import { checkRate, recordFailure, clearRate } from "../lib/ratelimit";
import {
  dayState,
  ownerDayState,
  calendarGrid,
  isDepositDay,
  addDays,
  todayYmd,
  ymdInBusinessTz,
  stampInBusinessTz,
  longDate,
  BUSINESS_TZ,
} from "../lib/dates";

const BASE = process.env.BASE ?? "http://localhost:3000";
const prisma = new PrismaClient();

/** Store names go through HTML escaping before they reach the page. */
function esc(t: string) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let pass = 0;
let fail = 0;
const fixtureIds: number[] = [];

function check(name: string, ok: boolean, extra = "") {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

async function token(user: {
  id: number;
  name: string;
  role: string;
  storeId: number | null;
  storeNumber: string | null;
  storeName: string | null;
}) {
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
  return new SignJWT({
    userId: user.id,
    name: user.name,
    role: user.role,
    storeId: user.storeId,
    storeNumber: user.storeNumber,
    storeName: user.storeName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

async function get(path: string, jwt?: string) {
  const res = await fetch(BASE + path, {
    redirect: "manual",
    headers: jwt ? { cookie: `ds_session=${jwt}` } : {},
  });
  const body = res.status < 300 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location") ?? "", body };
}

async function main() {
  console.log("\n-- money --");
  check("parse 1,234.50", parseDollarsToCents("1,234.50") === 123450);
  check("parse $99", parseDollarsToCents("$99") === 9900);
  check("parse 0.05", parseDollarsToCents("0.05") === 5);
  check("reject 1.234", parseDollarsToCents("1.234") === null);
  check("reject 12,3", parseDollarsToCents("12,3") === null);
  check("reject empty", parseDollarsToCents("") === null);
  check("reject letters", parseDollarsToCents("12a") === null);
  check("format 6550", fmt(6550) === "$65.50");
  check("format 100000000", fmt(100000000) === "$1,000,000.00");
  check(
    "parse then format round-trips",
    fmt(parseDollarsToCents("1450.75")!) === "$1,450.75",
  );
  check("cents survive, no float drift", parseDollarsToCents("0.10")! * 10 === 100);

  console.log("\n-- calendar --");
  const grid = calendarGrid("2026-08");
  check("grid starts on a Sunday", new Date(grid[0].ymd).getUTCDay() === 0);
  check("grid is whole weeks", grid.length % 7 === 0);
  check("august has 31 in-month days", grid.filter((c) => c.inMonth).length === 31);
  check(
    "sunday counts when the store deposits every day",
    isDepositDay("0,1,2,3,4,5,6", "2026-08-16") === true,
  );
  check(
    "saturday counts when the store deposits every day",
    isDepositDay("0,1,2,3,4,5,6", "2026-08-15") === true,
  );
  check(
    "a weekday-only store still excludes sunday",
    isDepositDay("1,2,3,4,5,6", "2026-08-16") === false,
  );
  check(
    "past + no deposit = missed",
    dayState({
      ymd: "2026-08-10",
      hasDeposit: false,
      isDepositDay: true,
      today: "2026-08-18",
    }) === "missed",
  );
  check(
    "past + deposit = filed",
    dayState({
      ymd: "2026-08-10",
      hasDeposit: true,
      isDepositDay: true,
      today: "2026-08-18",
    }) === "filed",
  );
  check(
    "closed day never missed",
    dayState({
      ymd: "2026-08-16",
      hasDeposit: false,
      isDepositDay: false,
      today: "2026-08-18",
    }) === "off",
  );
  check("addDays crosses month end", addDays("2026-08-31", 1) === "2026-09-01");

  // A moment must render as the wall clock in the business town, not on the
  // host. These pass on a developer machine already set to Vancouver, so the
  // real check is `TZ=UTC npx tsx --env-file=.env scripts/verify.ts`.
  const evening = new Date("2026-08-19T02:30:00.000Z"); // 7:30pm Aug 18 in Vancouver
  check(
    "a filed-at stamp shows the business-timezone day",
    stampInBusinessTz(evening).includes("Aug 18, 2026"),
    stampInBusinessTz(evening),
  );
  check(
    "a filed-at stamp shows the business-timezone time",
    stampInBusinessTz(evening).includes("7:30"),
    stampInBusinessTz(evening),
  );
  // The opposite trap: business dates are plain strings and must never be
  // pushed through a timezone, or every one of them slides back a day.
  check(
    "a business date is not shifted by the host clock",
    longDate("2026-08-19").includes("August 19"),
    longDate("2026-08-19"),
  );

  // The admin calendar has to agree with the store calendar about whether a
  // day has money on it.
  check(
    "a deposit filed on an unexpected day still shows on the admin calendar",
    ownerDayState({ expected: 0, filed: 0, unscheduled: 1, isPast: true, isFuture: false })
      .state === "filed",
  );
  check(
    "an off-schedule filing cannot mask a store that missed",
    ownerDayState({ expected: 1, filed: 0, unscheduled: 1, isPast: true, isFuture: false })
      .state === "missed",
  );
  check(
    "a day with nothing due and nothing filed stays closed",
    ownerDayState({ expected: 0, filed: 0, unscheduled: 0, isPast: true, isFuture: false })
      .state === "off",
  );
  check(
    "today is computed in the business timezone",
    todayYmd() ===
      new Intl.DateTimeFormat("en-CA", {
        timeZone: BUSINESS_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    `BUSINESS_TZ=${BUSINESS_TZ}`,
  );
  check(
    "a UTC evening still reads as the local business day",
    ymdInBusinessTz(new Date("2026-08-19T03:30:00Z")) === "2026-08-18",
    ymdInBusinessTz(new Date("2026-08-19T03:30:00Z")),
  );

  console.log("\n-- stored data --");
  const stores = await prisma.store.findMany({ orderBy: { storeNumber: "asc" } });
  check("13 stores", stores.length === 13, `got ${stores.length}`);
  const EXPECTED_CITIES: Record<string, string> = {
    "02627": "Abbotsford",
    "68295": "Abbotsford",
    "69830": "Abbotsford",
    "69910": "Abbotsford",
    "69926": "Abbotsford",
    "69975": "Abbotsford",
    "36997": "Chilliwack",
    "78057": "Chilliwack",
    "02631": "Mission",
    "37815": "Mission",
    "77947": "Aldergrove",
    "38866": "Langley",
    "91214": "Hope",
  };
  const wrongCity = stores.filter((s) => EXPECTED_CITIES[s.storeNumber] !== s.city);
  check(
    "every store sits in its assigned city",
    wrongCity.length === 0,
    wrongCity.map((s) => `${s.storeNumber}=${s.city}`).join(", "),
  );
  check(
    "all seven weekdays are deposit days for every store",
    stores.every((s) =>
      [0, 1, 2, 3, 4, 5, 6].every((d) => s.depositDays.split(",").includes(String(d))),
    ),
  );
  check("every store has a start date", stores.every((s) => !!s.startDate));
  check(
    "leading zeros survived the round-trip",
    stores.some((s) => s.storeNumber === "02627") &&
      stores.some((s) => s.storeNumber === "02631"),
  );

  const deposits = await prisma.deposit.findMany();
  console.log(`       (${deposits.length} deposits currently on the books)`);
  check(
    "every stored amount is a positive integer number of cents",
    deposits.every((d) => Number.isInteger(d.totalCents) && d.totalCents > 0),
  );

  const managers = await prisma.user.findMany({ where: { role: "MANAGER" } });
  check("managers have no PIN", managers.every((m) => m.pinHash === null));
  const ownerRow = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
  check("Company Admin still has a PIN", !!ownerRow.pinHash);
  check(
    "the all-stores account is labelled Company Admin",
    ownerRow.name === "Company Admin",
    ownerRow.name,
  );

  console.log("\n-- access control (live HTTP) --");
  const anon = await get("/dashboard");
  check("anonymous /dashboard redirects to login", anon.location.includes("/login"), anon.location);
  const anonOwner = await get("/owner");
  check("anonymous /owner redirects to login", anonOwner.location.includes("/login"), anonOwner.location);

  const s101 = stores.find((s) => s.storeNumber === "69910")!; // Clearbrook
  const s102 = stores.find((s) => s.storeNumber === "02627")!; // Gas Bar
  const m101 = await prisma.user.findFirstOrThrow({ where: { storeId: s101.id } });

  const jwt101 = await token({
    id: m101.id,
    name: m101.name,
    role: "MANAGER",
    storeId: s101.id,
    storeNumber: s101.storeNumber,
    storeName: s101.name,
  });
  const jwtOwner = await token({
    id: ownerRow.id,
    name: ownerRow.name,
    role: "OWNER",
    storeId: null,
    storeNumber: null,
    storeName: null,
  });

  const dash = await get("/dashboard", jwt101);
  check(
    "manager sees own dashboard",
    dash.status === 200 && dash.body.includes(s101.storeNumber),
  );
  check("manager dashboard shows own store name", dash.body.includes(esc(s101.name)));
  check(
    "manager dashboard does NOT name another store",
    !dash.body.includes(esc(s102.name)) && !dash.body.includes(s102.storeNumber),
    "leaked another store",
  );

  // The book is empty on a fresh install, so create one deposit per store to
  // test isolation against, and remove them again at the end.
  const m102 = await prisma.user.findFirstOrThrow({ where: { storeId: s102.id } });
  const ownDep = await prisma.deposit.create({
    data: {
      storeId: s101.id,
      businessDate: todayYmd(),
      totalCents: 123456,
      enteredById: m101.id,
      note: "verify.ts fixture",
    },
  });
  const otherDep = await prisma.deposit.create({
    data: {
      storeId: s102.id,
      businessDate: todayYmd(),
      totalCents: 654321,
      enteredById: m102.id,
      note: "verify.ts fixture",
    },
  });
  fixtureIds.push(ownDep.id, otherDep.id);

  const ownView = await get(`/deposit/${ownDep.id}`, jwt101);
  check("manager can open own deposit", ownView.status === 200 && ownView.body.includes(fmt(ownDep.totalCents)));

  const crossView = await get(`/deposit/${otherDep.id}`, jwt101);
  check(
    "manager BLOCKED from another store's deposit",
    crossView.status >= 300 && crossView.location.includes("/dashboard"),
    `status ${crossView.status} -> ${crossView.location}`,
  );

  const crossStore = await get(`/owner/store/${s102.id}`, jwt101);
  check(
    "manager BLOCKED from admin store page",
    crossStore.status >= 300 && crossStore.location.includes("/dashboard"),
    `status ${crossStore.status} -> ${crossStore.location}`,
  );

  const managerOwnerPage = await get("/owner", jwt101);
  check(
    "manager BLOCKED from admin overview",
    managerOwnerPage.status >= 300,
    `status ${managerOwnerPage.status}`,
  );

  const ownerHome = await get("/owner", jwtOwner);
  check(
    "Company Admin sees overview",
    ownerHome.status === 200 &&
      ownerHome.body.includes("All stores") &&
      ownerHome.body.includes("Company Admin"),
  );
  check(
    "owner overview lists every store",
    stores.every((s) => ownerHome.body.includes(esc(s.name))),
  );

  const ownerCross = await get(`/deposit/${otherDep.id}`, jwtOwner);
  check("Company Admin can open any store's deposit", ownerCross.status === 200);

  const forged = await get("/dashboard", "not.a.real.token");
  check("forged cookie rejected", forged.status >= 300 && forged.location.includes("/login"));

  // A validly signed cookie is still only as good as the rows it names.
  const ghost = await token({
    id: 999999,
    name: "Ghost",
    role: "MANAGER",
    storeId: s101.id,
    storeNumber: s101.storeNumber,
    storeName: s101.name,
  });
  const ghostRes = await get("/dashboard", ghost);
  check(
    "session naming a deleted user is rejected",
    ghostRes.status >= 300 && ghostRes.location.includes("/login"),
    `status ${ghostRes.status} -> ${ghostRes.location}`,
  );

  const wrongStore = await token({
    id: m101.id,
    name: m101.name,
    role: "MANAGER",
    storeId: s102.id,
    storeNumber: s102.storeNumber,
    storeName: s102.name,
  });
  const wrongStoreRes = await get("/dashboard", wrongStore);
  check(
    "session claiming a store the user is not assigned to is rejected",
    wrongStoreRes.status >= 300 && wrongStoreRes.location.includes("/login"),
    `status ${wrongStoreRes.status} -> ${wrongStoreRes.location}`,
  );

  const escalated = await token({
    id: m101.id,
    name: m101.name,
    role: "OWNER",
    storeId: null,
    storeNumber: null,
    storeName: null,
  });
  const escalatedRes = await get("/owner", escalated);
  check(
    "manager cookie claiming OWNER is rejected",
    escalatedRes.status >= 300 && escalatedRes.location.includes("/login"),
    `status ${escalatedRes.status} -> ${escalatedRes.location}`,
  );

  console.log("\n-- hardening --");
  // The throttle must survive a cold start, so it is asserted against the
  // database rather than a counter that dies with the process.
  const probeKey = `verify:${Date.now()}`;
  const limit = { limit: 3, windowMs: 60_000, lockMs: 60_000 };
  let allowed = 0;
  for (let i = 0; i < 10; i++) {
    if ((await checkRate(probeKey, limit)).ok) {
      allowed++;
      await recordFailure(probeKey);
    }
  }
  check("rate limiter stops repeated attempts", allowed === 3, `allowed ${allowed}`);
  const locked = await checkRate(probeKey, limit);
  check(
    "locked out attempts report a wait",
    !locked.ok && locked.retryAfterSeconds > 0,
  );
  check(
    "the throttle is stored, not in memory",
    (await prisma.loginAttempt.count({ where: { key: probeKey } })) === 3,
  );
  await clearRate(probeKey);
  check(
    "a success clears the throttle",
    (await prisma.loginAttempt.count({ where: { key: probeKey } })) === 0,
  );

  const secret = process.env.SESSION_SECRET ?? "";
  check("SESSION_SECRET is at least 32 chars", secret.length >= 32, `${secret.length} chars`);
  check(
    "SESSION_SECRET is not the shipped placeholder",
    !secret.startsWith("dev-only-change-me"),
  );
  check(
    "the app connects through the pooled endpoint",
    /-pooler\./.test(process.env.DATABASE_URL ?? ""),
  );

  const headRes = await fetch(BASE + "/login");
  check(
    "responses set X-Content-Type-Options",
    headRes.headers.get("x-content-type-options") === "nosniff",
  );
  check(
    "responses refuse framing",
    headRes.headers.get("x-frame-options") === "DENY",
  );
  check(
    "deposit pages are not cached",
    (headRes.headers.get("cache-control") ?? "").includes("no-store"),
  );

  // The off-provider copy has to be downloadable, and only by the admin.
  const exportAnon = await get("/owner/export");
  check("CSV export refuses anonymous callers", exportAnon.status >= 300);
  const exportMgr = await get("/owner/export", jwt101);
  check("CSV export refuses a store manager", exportMgr.status >= 300);
  const exportRes = await fetch(BASE + "/owner/export", {
    headers: { cookie: `ds_session=${jwtOwner}` },
  });
  const csv = await exportRes.text();
  check("Company Admin can download the CSV", exportRes.status === 200);
  check(
    "the CSV carries the cents, not just a formatted amount",
    csv.split("\n")[0].includes("amount_cents"),
  );

  // Deleting is Company Admin only. Checked over HTTP: importing the action
  // here would drag in server-only, which cannot load outside Next.
  const victim = await prisma.deposit.create({
    data: {
      storeId: s101.id,
      businessDate: todayYmd(),
      totalCents: 987654,
      enteredById: m101.id,
      note: "verify.ts delete fixture",
    },
  });
  fixtureIds.push(victim.id);

  check(
    "a deposit exists to delete",
    (await prisma.deposit.count({ where: { id: victim.id } })) === 1,
  );
  check(
    "deleting is not offered to a store manager",
    !(await get(`/deposit/${victim.id}`, jwt101)).body.includes("Delete this deposit"),
  );
  check(
    "deleting is offered to the Company Admin",
    (await get(`/deposit/${victim.id}`, jwtOwner)).body.includes("Delete this deposit"),
  );
  console.log("\n-- shell and branding --");
  const newDeposit = await get("/deposit/new", jwt101);
  for (const [label, page] of [
    ["manager dashboard", dash],
    ["deposit form", newDeposit],
    ["admin overview", ownerHome],
  ] as const) {
    check(`${label}: Aethon Core attribution in footer`, page.body.includes("aethoncore.com"));
    check(`${label}: product wordmark in header`, page.body.includes("Deposit"));
  }
  const loginPage = await get("/login");
  check("login page carries the attribution", loginPage.body.includes("aethoncore.com"));
  check(
    "attribution links out to https://aethoncore.com",
    loginPage.body.includes('href="https://aethoncore.com"'),
  );

  const denials = await prisma.auditLog.count({ where: { action: "VIEW_DENIED" } });
  check("blocked attempts were written to the audit log", denials >= 2, `${denials} logged`);

  // Remove the deposits this script created, so the books are left as found.
  if (fixtureIds.length) {
    await prisma.deposit.deleteMany({ where: { id: { in: fixtureIds } } });
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  if (fixtureIds.length) {
    await prisma.deposit.deleteMany({ where: { id: { in: fixtureIds } } });
  }
  await prisma.$disconnect();
  process.exit(1);
});
