-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'STICKER';

-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "stickerId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "stickerId" TEXT;

-- CreateTable
CREATE TABLE "Sticker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sticker_category_idx" ON "Sticker"("category");

-- CreateIndex
CREATE INDEX "DirectMessage_stickerId_idx" ON "DirectMessage"("stickerId");

-- CreateIndex
CREATE INDEX "Message_stickerId_idx" ON "Message"("stickerId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
