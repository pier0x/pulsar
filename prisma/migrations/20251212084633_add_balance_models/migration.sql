-- CreateTable
CREATE TABLE "Balance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Balance_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "network" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "logoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TokenBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TokenBalance_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TokenBalance_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BalanceRefreshJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "walletsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Balance_walletId_key" ON "Balance"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_network_contractAddress_key" ON "Token"("network", "contractAddress");

-- CreateIndex
CREATE INDEX "TokenBalance_walletId_idx" ON "TokenBalance"("walletId");

-- CreateIndex
CREATE INDEX "TokenBalance_tokenId_idx" ON "TokenBalance"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenBalance_walletId_tokenId_key" ON "TokenBalance"("walletId", "tokenId");
