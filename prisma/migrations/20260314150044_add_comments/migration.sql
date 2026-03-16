-- AlterEnum
ALTER TYPE "AssetContext" ADD VALUE 'COMMUNITY_POST_COMMENT_IMAGE';

-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'COMMUNITY_POST_COMMENT';

-- AlterTable
ALTER TABLE "CommunityPost" ADD COLUMN     "commentCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CommunityPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorProfileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageAssetId" TEXT,
    "replyToCommentId" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityPostComment_postId_deleted_createdAt_id_idx" ON "CommunityPostComment"("postId", "deleted", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CommunityPostComment_authorProfileId_idx" ON "CommunityPostComment"("authorProfileId");

-- CreateIndex
CREATE INDEX "CommunityPostComment_imageAssetId_idx" ON "CommunityPostComment"("imageAssetId");

-- CreateIndex
CREATE INDEX "CommunityPostComment_replyToCommentId_idx" ON "CommunityPostComment"("replyToCommentId");

-- AddForeignKey
ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_replyToCommentId_fkey" FOREIGN KEY ("replyToCommentId") REFERENCES "CommunityPostComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
