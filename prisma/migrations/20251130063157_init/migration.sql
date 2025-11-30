-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Balance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 18,
    "usdValue" REAL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Balance_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "totalUsd" REAL NOT NULL,
    "cryptoUsd" REAL NOT NULL,
    "cashUsd" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_chain_key" ON "Wallet"("address", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "Balance_walletId_token_key" ON "Balance"("walletId", "token");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_createdAt_idx" ON "PortfolioSnapshot"("createdAt");
