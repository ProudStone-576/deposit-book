-- A temporary closure window, inclusive at both ends, "YYYY-MM-DD".
-- Null on both columns means the store is open, which is every existing row.
ALTER TABLE "Store" ADD COLUMN "closedFrom" TEXT;
ALTER TABLE "Store" ADD COLUMN "closedUntil" TEXT;
