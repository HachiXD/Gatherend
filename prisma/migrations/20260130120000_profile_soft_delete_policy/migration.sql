-- AlterTable: Make Friendship fields nullable with SetNull
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_requesterId_fkey";
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_receiverId_fkey";
ALTER TABLE "Friendship" ALTER COLUMN "requesterId" DROP NOT NULL;
ALTER TABLE "Friendship" ALTER COLUMN "receiverId" DROP NOT NULL;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Make CommunityHelper profileId nullable with SetNull
ALTER TABLE "CommunityHelper" DROP CONSTRAINT "CommunityHelper_profileId_fkey";
ALTER TABLE "CommunityHelper" ALTER COLUMN "profileId" DROP NOT NULL;
ALTER TABLE "CommunityHelper" ADD CONSTRAINT "CommunityHelper_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Make BoardBan profileId nullable with SetNull
ALTER TABLE "BoardBan" DROP CONSTRAINT "BoardBan_profileId_fkey";
ALTER TABLE "BoardBan" ALTER COLUMN "profileId" DROP NOT NULL;
ALTER TABLE "BoardBan" ADD CONSTRAINT "BoardBan_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Make Member profileId nullable with SetNull
ALTER TABLE "Member" DROP CONSTRAINT "Member_profileId_fkey";
ALTER TABLE "Member" ALTER COLUMN "profileId" DROP NOT NULL;
ALTER TABLE "Member" ADD CONSTRAINT "Member_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Make Reaction profileId nullable with SetNull
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_profileId_fkey";
ALTER TABLE "Reaction" ALTER COLUMN "profileId" DROP NOT NULL;
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Make Mention profileId nullable with SetNull
ALTER TABLE "Mention" DROP CONSTRAINT "Mention_profileId_fkey";
ALTER TABLE "Mention" ALTER COLUMN "profileId" DROP NOT NULL;
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Make Strike profileId nullable with SetNull
ALTER TABLE "Strike" DROP CONSTRAINT "Strike_profileId_fkey";
ALTER TABLE "Strike" ALTER COLUMN "profileId" DROP NOT NULL;
ALTER TABLE "Strike" ADD CONSTRAINT "Strike_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Make Report reporterId nullable with SetNull
ALTER TABLE "Report" DROP CONSTRAINT "Report_reporterId_fkey";
ALTER TABLE "Report" ALTER COLUMN "reporterId" DROP NOT NULL;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
