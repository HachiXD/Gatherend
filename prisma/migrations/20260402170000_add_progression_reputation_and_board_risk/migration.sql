-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "reputationScore" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "reputationUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CommunityPost" ADD COLUMN     "memberId" TEXT;

-- AlterTable
ALTER TABLE "CommunityPostComment" ADD COLUMN     "memberId" TEXT;

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "riskLevel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "riskPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "riskUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "levelUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Strike" ADD COLUMN     "boardId" TEXT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "boardId" TEXT,
ADD COLUMN     "channelId" TEXT;

-- CreateTable
CREATE TABLE "ProfileReputationEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "boardId" TEXT,
    "reportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileReputationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberXpEvent" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberXpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardRiskEvent" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "profileId" TEXT,
    "reportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardRiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileReputationEvent_profileId_createdAt_idx" ON "ProfileReputationEvent"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProfileReputationEvent_reason_idx" ON "ProfileReputationEvent"("reason");

-- CreateIndex
CREATE INDEX "ProfileReputationEvent_boardId_idx" ON "ProfileReputationEvent"("boardId");

-- CreateIndex
CREATE INDEX "ProfileReputationEvent_reportId_idx" ON "ProfileReputationEvent"("reportId");

-- CreateIndex
CREATE INDEX "MemberXpEvent_memberId_createdAt_idx" ON "MemberXpEvent"("memberId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MemberXpEvent_profileId_boardId_createdAt_idx" ON "MemberXpEvent"("profileId", "boardId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MemberXpEvent_boardId_createdAt_idx" ON "MemberXpEvent"("boardId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MemberXpEvent_reason_idx" ON "MemberXpEvent"("reason");

-- CreateIndex
CREATE INDEX "BoardRiskEvent_boardId_createdAt_idx" ON "BoardRiskEvent"("boardId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BoardRiskEvent_reason_idx" ON "BoardRiskEvent"("reason");

-- CreateIndex
CREATE INDEX "BoardRiskEvent_reportId_idx" ON "BoardRiskEvent"("reportId");

-- CreateIndex
CREATE INDEX "CommunityPost_memberId_idx" ON "CommunityPost"("memberId");

-- CreateIndex
CREATE INDEX "CommunityPostComment_memberId_idx" ON "CommunityPostComment"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_boardId_profileId_key" ON "Member"("boardId", "profileId");

-- CreateIndex
CREATE INDEX "Strike_boardId_idx" ON "Strike"("boardId");

-- CreateIndex
CREATE INDEX "Report_boardId_idx" ON "Report"("boardId");

-- CreateIndex
CREATE INDEX "Report_channelId_idx" ON "Report"("channelId");

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strike" ADD CONSTRAINT "Strike_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileReputationEvent" ADD CONSTRAINT "ProfileReputationEvent_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileReputationEvent" ADD CONSTRAINT "ProfileReputationEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileReputationEvent" ADD CONSTRAINT "ProfileReputationEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberXpEvent" ADD CONSTRAINT "MemberXpEvent_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberXpEvent" ADD CONSTRAINT "MemberXpEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberXpEvent" ADD CONSTRAINT "MemberXpEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardRiskEvent" ADD CONSTRAINT "BoardRiskEvent_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardRiskEvent" ADD CONSTRAINT "BoardRiskEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardRiskEvent" ADD CONSTRAINT "BoardRiskEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

