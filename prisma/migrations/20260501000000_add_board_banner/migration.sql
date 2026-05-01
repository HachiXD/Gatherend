-- Add a dedicated banner asset for boards while preserving imageAsset as avatar.
ALTER TYPE "AssetContext" ADD VALUE IF NOT EXISTS 'BOARD_BANNER';

ALTER TABLE "Board" ADD COLUMN "bannerAssetId" TEXT;

ALTER TABLE "Board"
  ADD CONSTRAINT "Board_bannerAssetId_fkey"
  FOREIGN KEY ("bannerAssetId")
  REFERENCES "UploadedAsset"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "Board_bannerAssetId_idx" ON "Board"("bannerAssetId");
