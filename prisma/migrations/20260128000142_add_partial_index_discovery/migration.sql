/*
  Warnings:

  - The primary key for the `IdempotencyKey` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "IdempotencyKey" DROP CONSTRAINT "IdempotencyKey_pkey",
ADD CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id");

-- CreateIndex: Partial index for vacant discovery slots
-- This dramatically improves EXISTS queries in discovery feed
-- Only indexes rows where mode='BY_DISCOVERY' AND memberId IS NULL
CREATE INDEX IF NOT EXISTS "Slot_vacant_discovery_idx" 
ON "Slot" ("boardId") 
WHERE "mode" = 'BY_DISCOVERY' AND "memberId" IS NULL;
