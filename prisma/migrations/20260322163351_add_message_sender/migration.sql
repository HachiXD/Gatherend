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
  - Made the column `assetId` on table `Sticker` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Board" DROP COLUMN "imageUrl";

-- AlterTable
ALTER TABLE "Community" DROP COLUMN "imageUrl";

-- AlterTable
ALTER TABLE "CommunityPost" DROP COLUMN "imageUrl";

-- AlterTable
ALTER TABLE "DirectMessage" DROP COLUMN "fileHeight",
DROP COLUMN "fileKey",
DROP COLUMN "fileName",
DROP COLUMN "fileSize",
DROP COLUMN "fileType",
DROP COLUMN "fileUrl",
DROP COLUMN "fileWidth";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "fileHeight",
DROP COLUMN "fileKey",
DROP COLUMN "fileName",
DROP COLUMN "fileSize",
DROP COLUMN "fileType",
DROP COLUMN "fileUrl",
DROP COLUMN "fileWidth";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "badgeStickerUrl",
DROP COLUMN "imageUrl";

-- AlterTable
ALTER TABLE "Sticker" DROP COLUMN "imageUrl",
DROP COLUMN "publicId",
ALTER COLUMN "assetId" SET NOT NULL;
