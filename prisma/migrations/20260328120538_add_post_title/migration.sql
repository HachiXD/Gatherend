-- Add title column as nullable first
ALTER TABLE "CommunityPost" ADD COLUMN "title" TEXT;

-- Backfill: use first 200 chars of content as title
-- Posts already soft-deleted have content="" so title="" is intentional for them
UPDATE "CommunityPost" SET "title" = LEFT(TRIM("content"), 200);

-- Now enforce NOT NULL
ALTER TABLE "CommunityPost" ALTER COLUMN "title" SET NOT NULL;
