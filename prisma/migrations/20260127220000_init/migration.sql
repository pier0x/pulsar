-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nativeBalance" TEXT NOT NULL,
    "nativeBalanceUsd" DECIMAL(65,30) NOT NULL,
    "nativePriceUsd" DECIMAL(65,30) NOT NULL,
    "tokensUsdValue" DECIMAL(65,30) NOT NULL,
    "totalUsdValue" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "decimals" INTEGER NOT NULL,
    "logoUrl" TEXT,
    "balance" TEXT NOT NULL,
    "balanceUsd" DECIMAL(65,30) NOT NULL,
    "priceUsd" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "TokenSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "walletsAttempted" INTEGER NOT NULL,
    "walletsSucceeded" INTEGER NOT NULL,
    "walletsFailed" INTEGER NOT NULL,
    "durationMs" INTEGER,

    CONSTRAINT "RefreshLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshError" (
    "id" TEXT NOT NULL,
    "refreshLogId" TEXT NOT NULL,
    "walletId" TEXT,
    "walletAddress" TEXT,
    "network" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "errorDetails" TEXT,

    CONSTRAINT "RefreshError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastAction" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_network_idx" ON "Wallet"("network");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_address_key" ON "Wallet"("userId", "address");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_walletId_idx" ON "BalanceSnapshot"("walletId");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_walletId_timestamp_idx" ON "BalanceSnapshot"("walletId", "timestamp");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_timestamp_idx" ON "BalanceSnapshot"("timestamp");

-- CreateIndex
CREATE INDEX "TokenSnapshot_snapshotId_idx" ON "TokenSnapshot"("snapshotId");

-- CreateIndex
CREATE INDEX "RefreshLog_timestamp_idx" ON "RefreshLog"("timestamp");

-- CreateIndex
CREATE INDEX "RefreshError_refreshLogId_idx" ON "RefreshError"("refreshLogId");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE INDEX "RateLimit_key_idx" ON "RateLimit"("key");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenSnapshot" ADD CONSTRAINT "TokenSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "BalanceSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshError" ADD CONSTRAINT "RefreshError_refreshLogId_fkey" FOREIGN KEY ("refreshLogId") REFERENCES "RefreshLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
