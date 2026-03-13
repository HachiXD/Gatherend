/*
  Warnings:

  - A unique constraint covering the columns `[username,discriminator]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Profile_discriminator_key";

-- AlterTable
ALTER TABLE "Profile" ALTER COLUMN "discriminator" SET DEFAULT 'xxx';

-- CreateIndex
CREATE UNIQUE INDEX "Profile_username_discriminator_key" ON "Profile"("username", "discriminator");
