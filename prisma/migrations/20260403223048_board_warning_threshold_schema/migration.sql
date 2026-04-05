/*
  Warnings:

  - Added the required column `updatedAt` to the `BoardWarning` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BoardWarningStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "BoardBanSourceType" AS ENUM ('MANUAL', 'WARNING_THRESHOLD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BoardModerationActionType" ADD VALUE 'REMOVE_WARNING';
ALTER TYPE "BoardModerationActionType" ADD VALUE 'AUTO_BAN';
ALTER TYPE "BoardModerationActionType" ADD VALUE 'AUTO_UNBAN';

-- DropIndex
DROP INDEX "BoardWarning_boardId_profileId_key";

-- AlterTable
ALTER TABLE "BoardBan" ADD COLUMN     "sourceType" "BoardBanSourceType" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "BoardModerationAction" ADD COLUMN     "banId" TEXT,
ADD COLUMN     "warningId" TEXT;

-- AlterTable
ALTER TABLE "BoardWarning" ADD COLUMN     "promotedToBanId" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT,
ADD COLUMN     "status" "BoardWarningStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "BoardBan_sourceType_idx" ON "BoardBan"("sourceType");

-- CreateIndex
CREATE INDEX "BoardModerationAction_warningId_idx" ON "BoardModerationAction"("warningId");

-- CreateIndex
CREATE INDEX "BoardModerationAction_banId_idx" ON "BoardModerationAction"("banId");

-- CreateIndex
CREATE INDEX "BoardWarning_removedById_idx" ON "BoardWarning"("removedById");

-- CreateIndex
CREATE INDEX "BoardWarning_promotedToBanId_idx" ON "BoardWarning"("promotedToBanId");

-- CreateIndex
CREATE INDEX "BoardWarning_boardId_profileId_status_createdAt_idx" ON "BoardWarning"("boardId", "profileId", "status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "BoardWarning" ADD CONSTRAINT "BoardWarning_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardWarning" ADD CONSTRAINT "BoardWarning_promotedToBanId_fkey" FOREIGN KEY ("promotedToBanId") REFERENCES "BoardBan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardModerationAction" ADD CONSTRAINT "BoardModerationAction_warningId_fkey" FOREIGN KEY ("warningId") REFERENCES "BoardWarning"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardModerationAction" ADD CONSTRAINT "BoardModerationAction_banId_fkey" FOREIGN KEY ("banId") REFERENCES "BoardBan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
