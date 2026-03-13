/*
  Warnings:

  - You are about to drop the column `resolvedBy` on the `Report` table. All the data in the column will be lost.
  - The `status` column on the `Report` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `confidence` on the `Strike` table. All the data in the column will be lost.
  - You are about to drop the column `labels` on the `Strike` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[reporterId,targetType,targetId]` on the table `Report` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[originReportId]` on the table `Strike` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `snapshot` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `targetType` on the `Report` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `category` on the `Report` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `appealStatus` on table `Strike` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('MESSAGE', 'DIRECT_MESSAGE', 'PROFILE', 'BOARD');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('CSAM', 'SEXUAL_CONTENT', 'HARASSMENT', 'HATE_SPEECH', 'SPAM', 'IMPERSONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWING', 'ACTION_TAKEN', 'DISMISSED');

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "hiddenFromFeed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "falseReports" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reportAccuracy" DOUBLE PRECISION,
ADD COLUMN     "validReports" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "resolvedBy",
ADD COLUMN     "actionTaken" TEXT,
ADD COLUMN     "resolvedById" TEXT,
ADD COLUMN     "snapshot" JSONB NOT NULL,
ADD COLUMN     "targetOwnerId" TEXT,
DROP COLUMN "targetType",
ADD COLUMN     "targetType" "ReportTargetType" NOT NULL,
DROP COLUMN "category",
ADD COLUMN     "category" "ReportCategory" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Strike" DROP COLUMN "confidence",
DROP COLUMN "labels",
ADD COLUMN     "appealResolvedAt" TIMESTAMP(3),
ADD COLUMN     "appealResolvedBy" TEXT,
ADD COLUMN     "autoDetected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "originReportId" TEXT,
ADD COLUMN     "snapshot" JSONB,
ALTER COLUMN "appealStatus" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Board_hiddenFromFeed_idx" ON "Board"("hiddenFromFeed");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_targetOwnerId_idx" ON "Report"("targetOwnerId");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Report_category_idx" ON "Report"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_targetType_targetId_key" ON "Report"("reporterId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Strike_originReportId_key" ON "Strike"("originReportId");

-- CreateIndex
CREATE INDEX "Strike_appealStatus_idx" ON "Strike"("appealStatus");

-- CreateIndex
CREATE INDEX "Strike_expiresAt_idx" ON "Strike"("expiresAt");

-- AddForeignKey
ALTER TABLE "Strike" ADD CONSTRAINT "Strike_originReportId_fkey" FOREIGN KEY ("originReportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetOwnerId_fkey" FOREIGN KEY ("targetOwnerId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
