-- AlterTable: Add manual asset fields to Account model
ALTER TABLE "Account" ADD COLUMN "category"  TEXT;
ALTER TABLE "Account" ADD COLUMN "costBasis" DECIMAL(65,30);
ALTER TABLE "Account" ADD COLUMN "notes"     TEXT;
ALTER TABLE "Account" ADD COLUMN "imagePath" TEXT;
