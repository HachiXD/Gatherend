-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "lastReadByOneAt" TIMESTAMP(3),
ADD COLUMN     "lastReadByTwoAt" TIMESTAMP(3);
