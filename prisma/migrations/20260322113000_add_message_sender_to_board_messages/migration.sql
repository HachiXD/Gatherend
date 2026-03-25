-- AlterTable
ALTER TABLE "Message" ADD COLUMN "messageSenderId" TEXT;

-- Backfill stable sender from the current member relation when available
UPDATE "Message" AS msg
SET "messageSenderId" = m."profileId"
FROM "Member" AS m
WHERE msg."memberId" = m."id"
  AND msg."messageSenderId" IS NULL;

-- CreateIndex
CREATE INDEX "Message_messageSenderId_idx" ON "Message"("messageSenderId");

-- AddForeignKey
ALTER TABLE "Message"
ADD CONSTRAINT "Message_messageSenderId_fkey"
FOREIGN KEY ("messageSenderId") REFERENCES "Profile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
