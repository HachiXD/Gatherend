-- CreateEnum
CREATE TYPE "CommunityHelperInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'COMMUNITY_POST';

-- CreateTable
CREATE TABLE "CommunityHelperInvite" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "createdByProfileId" TEXT NOT NULL,
    "acceptedByProfileId" TEXT,
    "inviteCode" TEXT NOT NULL,
    "status" "CommunityHelperInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CommunityHelperInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "authorProfileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityHelperInvite_inviteCode_key" ON "CommunityHelperInvite"("inviteCode");

-- CreateIndex
CREATE INDEX "CommunityHelperInvite_communityId_status_createdAt_idx" ON "CommunityHelperInvite"("communityId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CommunityHelperInvite_createdByProfileId_status_createdAt_idx" ON "CommunityHelperInvite"("createdByProfileId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CommunityHelperInvite_acceptedByProfileId_idx" ON "CommunityHelperInvite"("acceptedByProfileId");

-- CreateIndex
CREATE INDEX "CommunityHelperInvite_expiresAt_idx" ON "CommunityHelperInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "CommunityPost_authorProfileId_idx" ON "CommunityPost"("authorProfileId");

-- CreateIndex
CREATE INDEX "CommunityPost_communityId_deleted_pinnedAt_createdAt_id_idx" ON "CommunityPost"("communityId", "deleted", "pinnedAt" DESC, "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "CommunityPost_communityId_deleted_createdAt_id_idx" ON "CommunityPost"("communityId", "deleted", "createdAt" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "CommunityHelperInvite" ADD CONSTRAINT "CommunityHelperInvite_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityHelperInvite" ADD CONSTRAINT "CommunityHelperInvite_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityHelperInvite" ADD CONSTRAINT "CommunityHelperInvite_acceptedByProfileId_fkey" FOREIGN KEY ("acceptedByProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
