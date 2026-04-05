-- CreateEnum
CREATE TYPE "PlatformWarningStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "StrikeSourceType" AS ENUM ('DIRECT', 'WARNING_ESCALATION');

-- CreateEnum
CREATE TYPE "PlatformBanSourceType" AS ENUM ('MANUAL', 'AUTO_STRIKE_THRESHOLD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlatformModerationActionType" ADD VALUE 'REMOVE_WARNING';
ALTER TYPE "PlatformModerationActionType" ADD VALUE 'AUTO_BAN';
ALTER TYPE "PlatformModerationActionType" ADD VALUE 'AUTO_UNBAN';
ALTER TYPE "PlatformModerationActionType" ADD VALUE 'REMOVE_STRIKE';

-- DropIndex
DROP INDEX "PlatformWarning_profileId_key";

-- AlterTable
ALTER TABLE "PlatformWarning" ADD COLUMN     "promotedToStrikeId" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT,
ADD COLUMN     "status" "PlatformWarningStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "banSourceType" "PlatformBanSourceType";

-- AlterTable
ALTER TABLE "Strike" ADD COLUMN     "autoBanTriggered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceType" "StrikeSourceType" NOT NULL DEFAULT 'DIRECT';

-- CreateIndex
CREATE INDEX "PlatformWarning_profileId_status_createdAt_idx" ON "PlatformWarning"("profileId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformWarning_removedById_idx" ON "PlatformWarning"("removedById");

-- CreateIndex
CREATE INDEX "PlatformWarning_promotedToStrikeId_idx" ON "PlatformWarning"("promotedToStrikeId");

-- AddForeignKey
ALTER TABLE "PlatformWarning" ADD CONSTRAINT "PlatformWarning_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformWarning" ADD CONSTRAINT "PlatformWarning_promotedToStrikeId_fkey" FOREIGN KEY ("promotedToStrikeId") REFERENCES "Strike"("id") ON DELETE SET NULL ON UPDATE CASCADE;
