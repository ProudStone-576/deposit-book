-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "storeNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "depositDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Store" ("active", "address", "city", "createdAt", "depositDays", "id", "name", "storeNumber") SELECT "active", "address", "city", "createdAt", "depositDays", "id", "name", "storeNumber" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE UNIQUE INDEX "Store_storeNumber_key" ON "Store"("storeNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
