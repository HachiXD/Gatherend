/*
  Warnings:

  - You are about to drop the column `userId` on the `Profile` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Profile_userId_key";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Sticker" ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "uploaderId" TEXT;

-- CreateIndex
CREATE INDEX "Sticker_uploaderId_idx" ON "Sticker"("uploaderId");

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
