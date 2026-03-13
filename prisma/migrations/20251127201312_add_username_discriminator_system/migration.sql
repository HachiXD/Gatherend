/*
  Warnings:

  - You are about to drop the column `name` on the `Profile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[discriminator]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `discriminator` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `Profile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "name",
ADD COLUMN     "discriminator" TEXT NOT NULL,
ADD COLUMN     "username" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Profile_username_discriminator_idx" ON "Profile"("username", "discriminator");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_discriminator_key" ON "Profile"("discriminator");
