/*
  Change Forum/Wiki from fixed board-level surfaces to channel-owned spaces.

  This migration intentionally performs the ownership change in phases:
  1. Add nullable channelId columns.
  2. Create default Foro/Wiki channels for existing boards.
  3. Backfill existing posts/wiki pages to those channels.
  4. Make channelId required and remove old boardId ownership columns.
*/

-- Drop old ownership foreign keys before reshaping the tables.
ALTER TABLE "CommunityPost" DROP CONSTRAINT "CommunityPost_boardId_fkey";
ALTER TABLE "WikiPage" DROP CONSTRAINT "WikiPage_boardId_fkey";

-- Drop old board-scoped lookup indexes.
DROP INDEX "CommunityPost_boardId_deleted_createdAt_id_idx";
DROP INDEX "CommunityPost_boardId_deleted_pinnedAt_createdAt_id_idx";
DROP INDEX "WikiPage_boardId_title_idx";

-- Board discovery ranking no longer stores a materialized post count.
ALTER TABLE "Board" DROP COLUMN "recentPostCount7d";

-- Add new ownership columns as nullable so existing rows can be backfilled.
ALTER TABLE "CommunityPost" ADD COLUMN "channelId" TEXT;
ALTER TABLE "WikiPage" ADD COLUMN "channelId" TEXT;

-- Preserve the existing fixed Forum/Wiki surfaces as default channels.
INSERT INTO "Channel" (
  "id",
  "name",
  "type",
  "position",
  "boardId",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  'Foro',
  'FORUM',
  3000,
  b."id",
  NOW(),
  NOW()
FROM "Board" b
WHERE NOT EXISTS (
  SELECT 1
  FROM "Channel" c
  WHERE c."boardId" = b."id"
    AND c."type" = 'FORUM'
);

INSERT INTO "Channel" (
  "id",
  "name",
  "type",
  "position",
  "boardId",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  'Wiki',
  'WIKI',
  4000,
  b."id",
  NOW(),
  NOW()
FROM "Board" b
WHERE NOT EXISTS (
  SELECT 1
  FROM "Channel" c
  WHERE c."boardId" = b."id"
    AND c."type" = 'WIKI'
);

-- Move existing board-owned posts into each board's Forum channel.
UPDATE "CommunityPost" p
SET "channelId" = c."id"
FROM "Channel" c
WHERE c."boardId" = p."boardId"
  AND c."type" = 'FORUM';

-- Move existing board-owned wiki pages into each board's Wiki channel.
UPDATE "WikiPage" w
SET "channelId" = c."id"
FROM "Channel" c
WHERE c."boardId" = w."boardId"
  AND c."type" = 'WIKI';

-- Fail loudly if any row could not be backfilled.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CommunityPost" WHERE "channelId" IS NULL) THEN
    RAISE EXCEPTION 'CommunityPost channelId backfill failed';
  END IF;

  IF EXISTS (SELECT 1 FROM "WikiPage" WHERE "channelId" IS NULL) THEN
    RAISE EXCEPTION 'WikiPage channelId backfill failed';
  END IF;
END $$;

-- New ownership is required after backfill.
ALTER TABLE "CommunityPost" ALTER COLUMN "channelId" SET NOT NULL;
ALTER TABLE "WikiPage" ALTER COLUMN "channelId" SET NOT NULL;

-- Remove old board ownership columns.
ALTER TABLE "CommunityPost" DROP COLUMN "boardId";
ALTER TABLE "WikiPage" DROP COLUMN "boardId";

-- CreateIndex
CREATE INDEX "Channel_boardId_type_position_idx" ON "Channel"("boardId", "type", "position");

CREATE INDEX "CommunityPost_channelId_deleted_pinnedAt_createdAt_id_idx" ON "CommunityPost"("channelId", "deleted", "pinnedAt" DESC, "createdAt" DESC, "id" DESC);

CREATE INDEX "CommunityPost_channelId_deleted_createdAt_id_idx" ON "CommunityPost"("channelId", "deleted", "createdAt" DESC, "id" DESC);

CREATE INDEX "WikiPage_channelId_title_idx" ON "WikiPage"("channelId", "title");

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
