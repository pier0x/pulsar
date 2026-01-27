/*
  Warnings:

  - You are about to drop the `Balance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BalanceRefreshJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Token` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TokenBalance` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Balance";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BalanceRefreshJob";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Token";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TokenBalance";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nativeBalance" TEXT NOT NULL,
    "nativeBalanceUsd" DECIMAL NOT NULL,
    "nativePriceUsd" DECIMAL NOT NULL,
    "tokensUsdValue" DECIMAL NOT NULL,
    "totalUsdValue" DECIMAL NOT NULL,
    CONSTRAINT "BalanceSnapshot_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TokenSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "decimals" INTEGER NOT NULL,
    "logoUrl" TEXT,
    "balance" TEXT NOT NULL,
    "balanceUsd" DECIMAL NOT NULL,
    "priceUsd" DECIMAL NOT NULL,
    CONSTRAINT "TokenSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "BalanceSnapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "walletsAttempted" INTEGER NOT NULL,
    "walletsSucceeded" INTEGER NOT NULL,
    "walletsFailed" INTEGER NOT NULL,
    "durationMs" INTEGER
);

-- CreateTable
CREATE TABLE "RefreshError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refreshLogId" TEXT NOT NULL,
    "walletId" TEXT,
    "walletAddress" TEXT,
    "network" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "errorDetails" TEXT,
    CONSTRAINT "RefreshError_refreshLogId_fkey" FOREIGN KEY ("refreshLogId") REFERENCES "RefreshLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "lastAction" DATETIME NOT NULL
);

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

-- CreateIndex
CREATE INDEX "Wallet_network_idx" ON "Wallet"("network");
