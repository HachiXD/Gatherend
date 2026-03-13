/*
  Warnings:

  - The `usernameColor` column on the `Profile` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "profileTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "usernameColor",
ADD COLUMN     "usernameColor" JSONB;
