-- Create the new upload schema without deleting legacy columns.
-- CreateEnum
CREATE TYPE "AssetVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AssetContext" AS ENUM ('PROFILE_AVATAR', 'PROFILE_BANNER', 'BOARD_IMAGE', 'COMMUNITY_IMAGE', 'COMMUNITY_POST_IMAGE', 'MESSAGE_ATTACHMENT', 'DM_ATTACHMENT', 'STICKER_IMAGE');

-- Add new columns
ALTER TABLE "Board" ADD COLUMN "imageAssetId" TEXT;

ALTER TABLE "Community" ADD COLUMN "imageAssetId" TEXT;

ALTER TABLE "CommunityPost" ADD COLUMN "imageAssetId" TEXT;

ALTER TABLE "DirectMessage" ADD COLUMN "attachmentAssetId" TEXT;

ALTER TABLE "Message" ADD COLUMN "attachmentAssetId" TEXT;

ALTER TABLE "Profile"
ADD COLUMN "avatarAssetId" TEXT,
ADD COLUMN "badgeStickerId" TEXT,
ADD COLUMN "bannerAssetId" TEXT;

ALTER TABLE "Sticker" ADD COLUMN "assetId" TEXT;

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
