-- AlterTable
ALTER TABLE "PlatformModerationAction" ADD COLUMN     "warningId" TEXT;

-- CreateIndex
CREATE INDEX "PlatformModerationAction_warningId_idx" ON "PlatformModerationAction"("warningId");

-- AddForeignKey
ALTER TABLE "PlatformModerationAction" ADD CONSTRAINT "PlatformModerationAction_warningId_fkey" FOREIGN KEY ("warningId") REFERENCES "PlatformWarning"("id") ON DELETE SET NULL ON UPDATE CASCADE;
