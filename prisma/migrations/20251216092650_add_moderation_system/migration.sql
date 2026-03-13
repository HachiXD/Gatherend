-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bannedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ModerationCache" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL,
    "reason" TEXT,
    "severity" TEXT,
    "labels" JSONB,
    "confidence" DOUBLE PRECISION,
    "context" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strike" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "imageHash" TEXT,
    "labels" JSONB,
    "confidence" DOUBLE PRECISION,
    "appealStatus" TEXT DEFAULT 'none',
    "appealedAt" TIMESTAMP(3),
    "appealNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Strike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModerationCache_hash_key" ON "ModerationCache"("hash");

-- CreateIndex
CREATE INDEX "ModerationCache_hash_idx" ON "ModerationCache"("hash");

-- CreateIndex
CREATE INDEX "ModerationCache_blocked_idx" ON "ModerationCache"("blocked");

-- CreateIndex
CREATE INDEX "ModerationCache_createdAt_idx" ON "ModerationCache"("createdAt");

-- CreateIndex
CREATE INDEX "Strike_profileId_idx" ON "Strike"("profileId");

-- CreateIndex
CREATE INDEX "Strike_severity_idx" ON "Strike"("severity");

-- CreateIndex
CREATE INDEX "Strike_createdAt_idx" ON "Strike"("createdAt");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_priority_idx" ON "Report"("priority");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- AddForeignKey
ALTER TABLE "Strike" ADD CONSTRAINT "Strike_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
