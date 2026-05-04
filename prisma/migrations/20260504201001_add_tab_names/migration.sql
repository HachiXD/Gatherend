-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "tabNames" JSONB;

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "lastMessageAt" TIMESTAMP(3);
