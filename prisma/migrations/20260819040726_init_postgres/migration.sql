-- CreateTable
CREATE TABLE "Store" (
    "id" SERIAL NOT NULL,
    "storeNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "depositDays" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "startDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "loginCode" TEXT NOT NULL,
    "pinHash" TEXT,
    "storeId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "businessDate" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "bagNumber" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enteredById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedById" INTEGER,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "correctsId" INTEGER,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" INTEGER,
    "detail" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_storeNumber_key" ON "Store"("storeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_loginCode_key" ON "User"("loginCode");

-- CreateIndex
CREATE INDEX "User_storeId_idx" ON "User"("storeId");

-- CreateIndex
CREATE INDEX "Deposit_storeId_businessDate_idx" ON "Deposit"("storeId", "businessDate");

-- CreateIndex
CREATE INDEX "Deposit_businessDate_idx" ON "Deposit"("businessDate");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "LoginAttempt_key_at_idx" ON "LoginAttempt"("key", "at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
