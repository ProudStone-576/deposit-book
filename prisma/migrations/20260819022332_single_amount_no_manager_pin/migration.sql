/*
  Warnings:

  - You are about to drop the column `cashCents` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `chequeCents` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `dimes` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `fifties` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `fives` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `hundreds` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `loonies` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `nickels` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `otherCents` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `quarters` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `tens` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `toonies` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `twenties` on the `Deposit` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deposit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "storeId" INTEGER NOT NULL,
    "businessDate" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "bagNumber" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enteredById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedById" INTEGER,
    "voidedAt" DATETIME,
    "voidReason" TEXT,
    "correctsId" INTEGER,
    CONSTRAINT "Deposit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Deposit_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Deposit_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Deposit" ("bagNumber", "businessDate", "correctsId", "createdAt", "enteredById", "id", "note", "status", "storeId", "totalCents", "voidReason", "voidedAt", "voidedById") SELECT "bagNumber", "businessDate", "correctsId", "createdAt", "enteredById", "id", "note", "status", "storeId", "totalCents", "voidReason", "voidedAt", "voidedById" FROM "Deposit";
DROP TABLE "Deposit";
ALTER TABLE "new_Deposit" RENAME TO "Deposit";
CREATE INDEX "Deposit_storeId_businessDate_idx" ON "Deposit"("storeId", "businessDate");
CREATE INDEX "Deposit_businessDate_idx" ON "Deposit"("businessDate");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "loginCode" TEXT NOT NULL,
    "pinHash" TEXT,
    "storeId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "createdAt", "id", "loginCode", "name", "pinHash", "role", "storeId") SELECT "active", "createdAt", "id", "loginCode", "name", "pinHash", "role", "storeId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_loginCode_key" ON "User"("loginCode");
CREATE INDEX "User_storeId_idx" ON "User"("storeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
