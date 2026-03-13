-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "fileHeight" INTEGER,
ADD COLUMN     "fileWidth" INTEGER;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "fileHeight" INTEGER,
ADD COLUMN     "fileWidth" INTEGER;

-- CreateTable
CREATE TABLE "email_suppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isSuppressed" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "bounceType" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_suppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_suppression_email_key" ON "email_suppression"("email");

-- CreateIndex
CREATE INDEX "email_suppression_email_idx" ON "email_suppression"("email");
