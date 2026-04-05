-- AlterTable
ALTER TABLE "UploadedAsset" ADD COLUMN "boardId" TEXT;

-- AlterTable
ALTER TABLE "ModerationCache" ADD COLUMN "engine" TEXT;
ALTER TABLE "ModerationCache" ADD COLUMN "policyVersion" TEXT;

-- Backfill legacy moderation cache rows so the new NOT NULL constraint is valid.
UPDATE "ModerationCache"
SET "engine" = 'nudenet',
    "policyVersion" = 'legacy-v1'
WHERE "engine" IS NULL OR "policyVersion" IS NULL;

-- AlterTable
ALTER TABLE "ModerationCache" ALTER COLUMN "engine" SET NOT NULL;
ALTER TABLE "ModerationCache" ALTER COLUMN "policyVersion" SET NOT NULL;

-- DropIndex
DROP INDEX "ModerationCache_hash_key";

-- CreateIndex
CREATE INDEX "UploadedAsset_boardId_idx" ON "UploadedAsset"("boardId");

-- CreateIndex
CREATE INDEX "ModerationCache_engine_policyVersion_idx" ON "ModerationCache"("engine", "policyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationCache_hash_engine_policyVersion_key" ON "ModerationCache"("hash", "engine", "policyVersion");

-- AddForeignKey
ALTER TABLE "UploadedAsset" ADD CONSTRAINT "UploadedAsset_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;
