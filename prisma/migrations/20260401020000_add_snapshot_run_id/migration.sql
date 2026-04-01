-- Add runId to AccountSnapshot for grouping refresh runs
ALTER TABLE "AccountSnapshot" ADD COLUMN "runId" TEXT;
CREATE INDEX "AccountSnapshot_runId_idx" ON "AccountSnapshot"("runId");
