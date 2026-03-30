CREATE TABLE "AssetPrice" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "priceUsd" DECIMAL(65,30) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssetPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetPrice_asset_key" ON "AssetPrice"("asset");
