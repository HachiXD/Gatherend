/*
  Warnings:

  - The primary key for the `IdempotencyKey` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "IdempotencyKey" DROP CONSTRAINT "IdempotencyKey_pkey",
ADD CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id", "userId", "endpoint");
