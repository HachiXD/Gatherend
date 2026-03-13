-- Add materialized fields for discovery feed ranking
-- These fields are updated by cron every 1 minute

-- Add columns with defaults
ALTER TABLE "Community" ADD COLUMN "memberCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Community" ADD COLUMN "feedBoardCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Community" ADD COLUMN "rankingScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Community" ADD COLUMN "rankedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Populate initial values from current data
-- feedBoardCount only counts boards within 48h window with vacant discovery slots
WITH community_stats AS (
  SELECT 
    c.id,
    -- Count unique members across all boards in community
    COALESCE((
      SELECT COUNT(DISTINCT m."profileId")
      FROM "Board" b
      JOIN "Member" m ON m."boardId" = b.id
      WHERE b."communityId" = c.id
    ), 0) as member_count,
    -- Count boards currently in discovery feed (within 48h + has vacant slots)
    COALESCE((
      SELECT COUNT(DISTINCT b.id)
      FROM "Board" b
      WHERE b."communityId" = c.id
        AND (b."createdAt" >= NOW() - INTERVAL '48 hours' OR b."refreshedAt" >= NOW() - INTERVAL '48 hours')
        AND EXISTS (
          SELECT 1 FROM "Slot" s
          WHERE s."boardId" = b.id
            AND s.mode = 'BY_DISCOVERY'
            AND s."memberId" IS NULL
        )
    ), 0) as feed_board_count
  FROM "Community" c
)
UPDATE "Community" c
SET 
  "memberCount" = cs.member_count,
  "feedBoardCount" = cs.feed_board_count,
  "rankingScore" = LN(cs.member_count + 1) + cs.feed_board_count * 0.5,
  "rankedAt" = CURRENT_TIMESTAMP
FROM community_stats cs
WHERE c.id = cs.id;

-- Create index for efficient ordered pagination
CREATE INDEX "Community_rankingScore_id_idx" ON "Community"("rankingScore" DESC, "id");
