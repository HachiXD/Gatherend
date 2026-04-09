-- AlterEnum
ALTER TYPE "AssetContext" ADD VALUE 'PROFILE_CARD_IMAGE';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "profileCardConfig" JSONB,
ADD COLUMN     "profileCardLeftBottomRightBottomImageAssetId" TEXT,
ADD COLUMN     "profileCardLeftBottomRightTopImageAssetId" TEXT,
ADD COLUMN     "profileCardLeftTopImageAssetId" TEXT,
ADD COLUMN     "profileCardRightBottomImageAssetId" TEXT,
ADD COLUMN     "profileCardRightTopImageAssetId" TEXT;

-- CreateIndex
CREATE INDEX "Profile_profileCardLeftTopImageAssetId_idx" ON "Profile"("profileCardLeftTopImageAssetId");

-- CreateIndex
CREATE INDEX "Profile_profileCardLeftBottomRightTopImageAssetId_idx" ON "Profile"("profileCardLeftBottomRightTopImageAssetId");

-- CreateIndex
CREATE INDEX "Profile_profileCardLeftBottomRightBottomImageAssetId_idx" ON "Profile"("profileCardLeftBottomRightBottomImageAssetId");

-- CreateIndex
CREATE INDEX "Profile_profileCardRightTopImageAssetId_idx" ON "Profile"("profileCardRightTopImageAssetId");

-- CreateIndex
CREATE INDEX "Profile_profileCardRightBottomImageAssetId_idx" ON "Profile"("profileCardRightBottomImageAssetId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_profileCardLeftTopImageAssetId_fkey" FOREIGN KEY ("profileCardLeftTopImageAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_profileCardLeftBottomRightTopImageAssetId_fkey" FOREIGN KEY ("profileCardLeftBottomRightTopImageAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_profileCardLeftBottomRightBottomImageAssetId_fkey" FOREIGN KEY ("profileCardLeftBottomRightBottomImageAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_profileCardRightTopImageAssetId_fkey" FOREIGN KEY ("profileCardRightTopImageAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_profileCardRightBottomImageAssetId_fkey" FOREIGN KEY ("profileCardRightBottomImageAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
