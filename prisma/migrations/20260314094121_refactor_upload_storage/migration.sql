/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Board` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Community` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `CommunityPost` table. All the data in the column will be lost.
  - You are about to drop the column `fileHeight` on the `DirectMessage` table. All the data in the column will be lost.
  - You are about to drop the column `fileKey` on the `DirectMessage` table. All the data in the column will be lost.
  - You are about to drop the column `fileName` on the `DirectMessage` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `DirectMessage` table. All the data in the column will be lost.
  - You are about to drop the column `fileType` on the `DirectMessage` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `DirectMessage` table. All the data in the column will be lost.
  - You are about to drop the column `fileWidth` on the `DirectMessage` table. All the data in the column will be lost.
  - You are about to drop the column `fileHeight` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `fileKey` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `fileName` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `fileType` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `fileWidth` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `badgeStickerUrl` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Sticker` table. All the data in the column will be lost.
  - You are about to drop the column `publicId` on the `Sticker` table. All the data in the column will be lost.
  - Added the required column `assetId` to the `Sticker` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AssetVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AssetContext" AS ENUM ('PROFILE_AVATAR', 'PROFILE_BANNER', 'BOARD_IMAGE', 'COMMUNITY_IMAGE', 'COMMUNITY_POST_IMAGE', 'MESSAGE_ATTACHMENT', 'DM_ATTACHMENT', 'STICKER_IMAGE');

-- AlterTable
ALTER TABLE "Board" DROP COLUMN "imageUrl",
ADD COLUMN     "imageAssetId" TEXT;

-- AlterTable
ALTER TABLE "Community" DROP COLUMN "imageUrl",
ADD COLUMN     "imageAssetId" TEXT;

-- AlterTable
ALTER TABLE "CommunityPost" DROP COLUMN "imageUrl",
ADD COLUMN     "imageAssetId" TEXT;

-- AlterTable
ALTER TABLE "DirectMessage" DROP COLUMN "fileHeight",
DROP COLUMN "fileKey",
DROP COLUMN "fileName",
DROP COLUMN "fileSize",
DROP COLUMN "fileType",
DROP COLUMN "fileUrl",
DROP COLUMN "fileWidth",
ADD COLUMN     "attachmentAssetId" TEXT;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "fileHeight",
DROP COLUMN "fileKey",
DROP COLUMN "fileName",
DROP COLUMN "fileSize",
DROP COLUMN "fileType",
DROP COLUMN "fileUrl",
DROP COLUMN "fileWidth",
ADD COLUMN     "attachmentAssetId" TEXT;

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "badgeStickerUrl",
DROP COLUMN "imageUrl",
ADD COLUMN     "avatarAssetId" TEXT,
ADD COLUMN     "badgeStickerId" TEXT,
ADD COLUMN     "bannerAssetId" TEXT;

-- AlterTable
ALTER TABLE "Sticker" DROP COLUMN "imageUrl",
DROP COLUMN "publicId",
ADD COLUMN     "assetId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "UploadedAsset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "visibility" "AssetVisibility" NOT NULL,
    "context" "AssetContext" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "ownerProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadedAsset_key_key" ON "UploadedAsset"("key");

-- CreateIndex
CREATE INDEX "UploadedAsset_ownerProfileId_idx" ON "UploadedAsset"("ownerProfileId");

-- CreateIndex
CREATE INDEX "UploadedAsset_visibility_context_createdAt_idx" ON "UploadedAsset"("visibility", "context", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UploadedAsset_context_createdAt_idx" ON "UploadedAsset"("context", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Board_imageAssetId_idx" ON "Board"("imageAssetId");

-- CreateIndex
CREATE INDEX "Community_imageAssetId_idx" ON "Community"("imageAssetId");

-- CreateIndex
CREATE INDEX "CommunityPost_imageAssetId_idx" ON "CommunityPost"("imageAssetId");

-- CreateIndex
CREATE INDEX "DirectMessage_attachmentAssetId_idx" ON "DirectMessage"("attachmentAssetId");

-- CreateIndex
CREATE INDEX "Message_attachmentAssetId_idx" ON "Message"("attachmentAssetId");

-- CreateIndex
CREATE INDEX "Profile_avatarAssetId_idx" ON "Profile"("avatarAssetId");

-- CreateIndex
CREATE INDEX "Profile_bannerAssetId_idx" ON "Profile"("bannerAssetId");

-- CreateIndex
CREATE INDEX "Profile_badgeStickerId_idx" ON "Profile"("badgeStickerId");

-- CreateIndex
CREATE INDEX "Sticker_assetId_idx" ON "Sticker"("assetId");

-- AddForeignKey
ALTER TABLE "UploadedAsset" ADD CONSTRAINT "UploadedAsset_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_bannerAssetId_fkey" FOREIGN KEY ("bannerAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_badgeStickerId_fkey" FOREIGN KEY ("badgeStickerId") REFERENCES "Sticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_attachmentAssetId_fkey" FOREIGN KEY ("attachmentAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_attachmentAssetId_fkey" FOREIGN KEY ("attachmentAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "UploadedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
