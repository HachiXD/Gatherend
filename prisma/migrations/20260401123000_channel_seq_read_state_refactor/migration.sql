ALTER TABLE "Channel"
ADD COLUMN "lastMessageSeq" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Message"
ADD COLUMN "seq" INTEGER;

ALTER TABLE "ChannelReadState"
ADD COLUMN "lastReadSeq" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ChannelReadState"
ADD CONSTRAINT "ChannelReadState_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

WITH ranked_messages AS (
  SELECT
    m.id,
    ROW_NUMBER() OVER (
      PARTITION BY m."channelId"
      ORDER BY m."createdAt" ASC, m.id ASC
    ) AS seq
  FROM "Message" m
)
UPDATE "Message" m
SET "seq" = ranked_messages.seq
FROM ranked_messages
WHERE ranked_messages.id = m.id;

UPDATE "Channel" c
SET "lastMessageSeq" = COALESCE(channel_max.max_seq, 0)
FROM (
  SELECT
    m."channelId",
    MAX(m."seq") AS max_seq
  FROM "Message" m
  GROUP BY m."channelId"
) AS channel_max
WHERE channel_max."channelId" = c.id;

UPDATE "ChannelReadState" rs
SET "lastReadSeq" = GREATEST(c."lastMessageSeq" - COALESCE(rs."unreadCount", 0), 0)
FROM "Channel" c
WHERE c.id = rs."channelId";

INSERT INTO "ChannelReadState" (
  "id",
  "profileId",
  "channelId",
  "lastReadAt",
  "lastReadSeq",
  "unreadCount",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  m."profileId",
  c.id,
  NOW(),
  c."lastMessageSeq",
  0,
  NOW(),
  NOW()
FROM "Member" m
INNER JOIN "Channel" c
  ON c."boardId" = m."boardId"
LEFT JOIN "ChannelReadState" rs
  ON rs."profileId" = m."profileId"
 AND rs."channelId" = c.id
WHERE rs.id IS NULL;

ALTER TABLE "Message"
ALTER COLUMN "seq" SET NOT NULL;

CREATE UNIQUE INDEX "Message_channelId_seq_key"
ON "Message"("channelId", "seq");
