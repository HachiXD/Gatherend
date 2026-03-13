/*
  Warnings:

  - The values [OCCUPIED] on the enum `SlotMode` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SlotMode_new" AS ENUM ('BY_INVITATION', 'BY_DISCOVERY');
ALTER TABLE "public"."Slot" ALTER COLUMN "mode" DROP DEFAULT;
ALTER TABLE "Slot" ALTER COLUMN "mode" TYPE "SlotMode_new" USING ("mode"::text::"SlotMode_new");
ALTER TYPE "SlotMode" RENAME TO "SlotMode_old";
ALTER TYPE "SlotMode_new" RENAME TO "SlotMode";
DROP TYPE "public"."SlotMode_old";
ALTER TABLE "Slot" ALTER COLUMN "mode" SET DEFAULT 'BY_INVITATION';
COMMIT;
