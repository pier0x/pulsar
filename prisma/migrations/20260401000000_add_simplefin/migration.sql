-- CreateTable
CREATE TABLE "SimplefinConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessUrl" TEXT NOT NULL,
    "label" TEXT,
    "lastSynced" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimplefinConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimplefinConnection_userId_idx" ON "SimplefinConnection"("userId");

-- AddForeignKey
ALTER TABLE "SimplefinConnection" ADD CONSTRAINT "SimplefinConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add SimpleFIN fields to Account
ALTER TABLE "Account" ADD COLUMN "simplefinConnectionId" TEXT;
ALTER TABLE "Account" ADD COLUMN "simplefinAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_simplefinConnectionId_fkey" FOREIGN KEY ("simplefinConnectionId") REFERENCES "SimplefinConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
