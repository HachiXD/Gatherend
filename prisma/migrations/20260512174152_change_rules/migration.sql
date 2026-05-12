/*
  Warnings:

  - The values [BOARD_RULES_IMAGE] on the enum `AssetContext` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `imageAssetId` on the `BoardRules` table. All the data in the column will be lost.
  - You are about to drop the column `items` on the `BoardRules` table. All the data in the column will be lost.
  - Added the required column `content` to the `BoardRules` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AssetContext_new" AS ENUM ('PROFILE_AVATAR', 'PROFILE_BANNER', 'PROFILE_CARD_IMAGE', 'BOARD_IMAGE', 'BOARD_BANNER', 'COMMUNITY_POST_IMAGE', 'COMMUNITY_POST_COMMENT_IMAGE', 'CHANNEL_IMAGE', 'MESSAGE_ATTACHMENT', 'DM_ATTACHMENT', 'STICKER_IMAGE', 'WIKI_PAGE_IMAGE');
ALTER TABLE "UploadedAsset" ALTER COLUMN "context" TYPE "AssetContext_new" USING ("context"::text::"AssetContext_new");
ALTER TYPE "AssetContext" RENAME TO "AssetContext_old";
ALTER TYPE "AssetContext_new" RENAME TO "AssetContext";
DROP TYPE "public"."AssetContext_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "BoardRules" DROP CONSTRAINT "BoardRules_imageAssetId_fkey";

-- DropIndex
DROP INDEX "BoardRules_imageAssetId_idx";

-- AlterTable (backfill: add nullable, populate, then set NOT NULL)
ALTER TABLE "BoardRules" DROP COLUMN "imageAssetId",
DROP COLUMN "items",
ADD COLUMN     "content" TEXT;

UPDATE "BoardRules" SET "content" = '' WHERE "content" IS NULL;

ALTER TABLE "BoardRules" ALTER COLUMN "content" SET NOT NULL;
