/*
  Warnings:

  - You are about to drop the column `memberCount` on the `Community` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'COMMUNITY';

-- DropIndex
DROP INDEX "Community_memberCount_idx";

-- AlterTable
ALTER TABLE "Community" DROP COLUMN "memberCount";
