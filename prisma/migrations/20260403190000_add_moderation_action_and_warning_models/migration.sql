-- CreateEnum
CREATE TYPE "BoardModerationActionType" AS ENUM ('WARNING', 'UNWARNING', 'BAN', 'UNBAN', 'KICK');

-- CreateEnum
CREATE TYPE "PlatformModerationActionType" AS ENUM ('WARNING', 'UNWARNING', 'BAN', 'UNBAN', 'STRIKE', 'CLEAR_STRIKES', 'NOTE');

-- AlterTable
ALTER TABLE "BoardBan" DROP COLUMN "updatedAt",
ADD COLUMN     "issuedById" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "BoardWarning" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardWarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformWarning" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "reportId" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformWarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardModerationAction" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "actionType" "BoardModerationActionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformModerationAction" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "actionType" "PlatformModerationActionType" NOT NULL,
    "reportId" TEXT,
    "strikeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardWarning_profileId_idx" ON "BoardWarning"("profileId");

-- CreateIndex
CREATE INDEX "BoardWarning_issuedById_idx" ON "BoardWarning"("issuedById");

-- CreateIndex
CREATE INDEX "BoardWarning_boardId_profileId_idx" ON "BoardWarning"("boardId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardWarning_boardId_profileId_key" ON "BoardWarning"("boardId", "profileId");

-- CreateIndex
CREATE INDEX "PlatformWarning_issuedById_idx" ON "PlatformWarning"("issuedById");

-- CreateIndex
CREATE INDEX "PlatformWarning_reportId_idx" ON "PlatformWarning"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformWarning_profileId_key" ON "PlatformWarning"("profileId");

-- CreateIndex
CREATE INDEX "BoardModerationAction_boardId_createdAt_idx" ON "BoardModerationAction"("boardId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BoardModerationAction_profileId_createdAt_idx" ON "BoardModerationAction"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BoardModerationAction_issuedById_createdAt_idx" ON "BoardModerationAction"("issuedById", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BoardModerationAction_actionType_idx" ON "BoardModerationAction"("actionType");

-- CreateIndex
CREATE INDEX "PlatformModerationAction_profileId_createdAt_idx" ON "PlatformModerationAction"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformModerationAction_issuedById_createdAt_idx" ON "PlatformModerationAction"("issuedById", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformModerationAction_actionType_idx" ON "PlatformModerationAction"("actionType");

-- CreateIndex
CREATE INDEX "PlatformModerationAction_reportId_idx" ON "PlatformModerationAction"("reportId");

-- CreateIndex
CREATE INDEX "PlatformModerationAction_strikeId_idx" ON "PlatformModerationAction"("strikeId");

-- CreateIndex
CREATE INDEX "BoardBan_profileId_idx" ON "BoardBan"("profileId");

-- CreateIndex
CREATE INDEX "BoardBan_issuedById_idx" ON "BoardBan"("issuedById");

-- AddForeignKey
ALTER TABLE "BoardBan" ADD CONSTRAINT "BoardBan_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardWarning" ADD CONSTRAINT "BoardWarning_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardWarning" ADD CONSTRAINT "BoardWarning_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardWarning" ADD CONSTRAINT "BoardWarning_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformWarning" ADD CONSTRAINT "PlatformWarning_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformWarning" ADD CONSTRAINT "PlatformWarning_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformWarning" ADD CONSTRAINT "PlatformWarning_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardModerationAction" ADD CONSTRAINT "BoardModerationAction_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardModerationAction" ADD CONSTRAINT "BoardModerationAction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardModerationAction" ADD CONSTRAINT "BoardModerationAction_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformModerationAction" ADD CONSTRAINT "PlatformModerationAction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformModerationAction" ADD CONSTRAINT "PlatformModerationAction_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformModerationAction" ADD CONSTRAINT "PlatformModerationAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformModerationAction" ADD CONSTRAINT "PlatformModerationAction_strikeId_fkey" FOREIGN KEY ("strikeId") REFERENCES "Strike"("id") ON DELETE SET NULL ON UPDATE CASCADE;
