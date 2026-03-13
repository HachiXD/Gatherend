-- DropIndex
DROP INDEX "Profile_username_discriminator_idx";

-- CreateIndex
CREATE INDEX "Profile_username_idx" ON "Profile"("username");

-- CreateIndex
CREATE INDEX "Profile_discriminator_idx" ON "Profile"("discriminator");
