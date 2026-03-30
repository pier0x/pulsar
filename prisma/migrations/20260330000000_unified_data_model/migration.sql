-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

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
CREATE TABLE "UserSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "network" TEXT,
    "address" TEXT,
    "plaidConnectionId" TEXT,
    "plaidAccountId" TEXT,
    "plaidSubtype" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalUsdValue" DECIMAL(65,30) NOT NULL,
    "nativeBalance" TEXT,
    "nativeBalanceUsd" DECIMAL(65,30),
    "nativePriceUsd" DECIMAL(65,30),
    "tokensUsdValue" DECIMAL(65,30),
    "availableBalance" DECIMAL(65,30),
    "currentBalance" DECIMAL(65,30),
    "currency" TEXT,
    "holdingsValue" DECIMAL(65,30),
    "cashBalance" DECIMAL(65,30),

    CONSTRAINT "AccountSnapshot_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "HoldingSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "priceUsd" DECIMAL(65,30) NOT NULL,
    "valueUsd" DECIMAL(65,30) NOT NULL,
    "costBasis" DECIMAL(65,30),

    CONSTRAINT "HoldingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaidConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cursor" TEXT,
    "lastSynced" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPrice" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "priceUsd" DECIMAL(65,30) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'buy',
    "amount" DECIMAL(65,30) NOT NULL,
    "priceUsd" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "UserSetting_userId_idx" ON "UserSetting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSetting_userId_key_key" ON "UserSetting"("userId", "key");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_type_idx" ON "Account"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_network_address_key" ON "Account"("userId", "network", "address");

-- CreateIndex
CREATE INDEX "AccountSnapshot_accountId_idx" ON "AccountSnapshot"("accountId");

-- CreateIndex
CREATE INDEX "AccountSnapshot_accountId_timestamp_idx" ON "AccountSnapshot"("accountId", "timestamp");

-- CreateIndex
CREATE INDEX "AccountSnapshot_timestamp_idx" ON "AccountSnapshot"("timestamp");

-- CreateIndex
CREATE INDEX "TokenSnapshot_snapshotId_idx" ON "TokenSnapshot"("snapshotId");

-- CreateIndex
CREATE INDEX "HoldingSnapshot_snapshotId_idx" ON "HoldingSnapshot"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaidConnection_itemId_key" ON "PlaidConnection"("itemId");

-- CreateIndex
CREATE INDEX "PlaidConnection_userId_idx" ON "PlaidConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPrice_asset_key" ON "AssetPrice"("asset");

-- CreateIndex
CREATE INDEX "Position_userId_idx" ON "Position"("userId");

-- CreateIndex
CREATE INDEX "Position_userId_asset_idx" ON "Position"("userId", "asset");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE INDEX "RateLimit_key_idx" ON "RateLimit"("key");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSetting" ADD CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_plaidConnectionId_fkey" FOREIGN KEY ("plaidConnectionId") REFERENCES "PlaidConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSnapshot" ADD CONSTRAINT "AccountSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenSnapshot" ADD CONSTRAINT "TokenSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AccountSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldingSnapshot" ADD CONSTRAINT "HoldingSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AccountSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidConnection" ADD CONSTRAINT "PlaidConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

