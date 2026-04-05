-- CreateEnum
CREATE TYPE "BoardInvestigationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PlatformBoardActionType" AS ENUM ('DELETE');

-- CreateTable
CREATE TABLE "BoardInvestigation" (
    "id" TEXT NOT NULL,
    "boardId" TEXT,
    "sourceReportId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "status" "BoardInvestigationStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "boardSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "BoardInvestigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformBoardAction" (
    "id" TEXT NOT NULL,
    "boardId" TEXT,
    "issuedById" TEXT NOT NULL,
    "investigationId" TEXT,
    "sourceReportId" TEXT,
    "actionType" "PlatformBoardActionType" NOT NULL,
    "notes" TEXT,
    "boardSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformBoardAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardInvestigation_boardId_status_createdAt_idx" ON "BoardInvestigation"("boardId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BoardInvestigation_sourceReportId_idx" ON "BoardInvestigation"("sourceReportId");

-- CreateIndex
CREATE INDEX "BoardInvestigation_openedById_createdAt_idx" ON "BoardInvestigation"("openedById", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BoardInvestigation_closedById_createdAt_idx" ON "BoardInvestigation"("closedById", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BoardInvestigation_status_createdAt_idx" ON "BoardInvestigation"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformBoardAction_boardId_createdAt_idx" ON "PlatformBoardAction"("boardId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformBoardAction_issuedById_createdAt_idx" ON "PlatformBoardAction"("issuedById", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformBoardAction_investigationId_createdAt_idx" ON "PlatformBoardAction"("investigationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformBoardAction_sourceReportId_createdAt_idx" ON "PlatformBoardAction"("sourceReportId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformBoardAction_actionType_createdAt_idx" ON "PlatformBoardAction"("actionType", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "BoardInvestigation" ADD CONSTRAINT "BoardInvestigation_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardInvestigation" ADD CONSTRAINT "BoardInvestigation_sourceReportId_fkey" FOREIGN KEY ("sourceReportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardInvestigation" ADD CONSTRAINT "BoardInvestigation_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardInvestigation" ADD CONSTRAINT "BoardInvestigation_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBoardAction" ADD CONSTRAINT "PlatformBoardAction_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBoardAction" ADD CONSTRAINT "PlatformBoardAction_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBoardAction" ADD CONSTRAINT "PlatformBoardAction_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "BoardInvestigation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBoardAction" ADD CONSTRAINT "PlatformBoardAction_sourceReportId_fkey" FOREIGN KEY ("sourceReportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;
