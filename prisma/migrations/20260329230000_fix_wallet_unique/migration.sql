-- DropIndex
DROP INDEX IF EXISTS "Wallet_userId_address_key";

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_network_address_key" ON "Wallet"("userId", "network", "address");
