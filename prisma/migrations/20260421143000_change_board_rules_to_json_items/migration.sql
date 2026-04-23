-- AlterTable
ALTER TABLE "BoardRules"
ADD COLUMN "items" JSONB;

-- Backfill existing rules into the new JSON structure
UPDATE "BoardRules"
SET "items" = jsonb_build_array(
    jsonb_build_object(
        'order', 1,
        'title', "title",
        'description', "content"
    )
);

-- Make the new column required before removing the legacy fields
ALTER TABLE "BoardRules"
ALTER COLUMN "items" SET NOT NULL;

-- Drop legacy columns
ALTER TABLE "BoardRules"
DROP COLUMN "title",
DROP COLUMN "content";
