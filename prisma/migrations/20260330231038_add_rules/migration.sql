-- AlterEnum
ALTER TYPE "AssetContext" ADD VALUE 'BOARD_RULES_IMAGE';

-- CreateTable
CREATE TABLE "BoardRules" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardRules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardRules_boardId_key" ON "BoardRules"("boardId");

-- CreateIndex
CREATE INDEX "BoardRules_imageAssetId_idx" ON "BoardRules"("imageAssetId");

-- AddForeignKey
ALTER TABLE "BoardRules" ADD CONSTRAINT "BoardRules_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardRules" ADD CONSTRAINT "BoardRules_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
