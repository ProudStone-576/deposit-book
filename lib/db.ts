import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  sqliteTuned?: boolean;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error"] : [] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * SQLite durability settings, applied once per process.
 *
 *  journal_mode=WAL  a half-written transaction is rolled back from the log
 *                    instead of leaving a torn database file. This is what
 *                    stops a power cut or a killed container costing the book.
 *  synchronous=FULL  flush to disk before reporting a deposit as filed. Slower
 *                    per write, and the right trade when the write is money.
 *  busy_timeout      wait rather than fail if a backup holds a read lock.
 *  foreign_keys      SQLite leaves these off by default; we rely on them.
 */
if (!globalForPrisma.sqliteTuned) {
  globalForPrisma.sqliteTuned = true;
  void (async () => {
    try {
      // journal_mode reports the mode it settled on, so it has to be run as a
      // query; SQLite rejects a statement that returns rows via execute.
      const rows = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>(
        "PRAGMA journal_mode = WAL",
      );
      const mode = rows?.[0]?.journal_mode ?? "unknown";
      if (mode.toLowerCase() !== "wal") {
        console.error(`[db] WAL not enabled (journal_mode=${mode})`);
      }
      // busy_timeout also reports back, so it is a query too.
      await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
      await prisma.$executeRawUnsafe("PRAGMA synchronous = FULL");
      await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    } catch (e) {
      console.error("[db] could not apply SQLite pragmas:", e);
    }
  })();
}
