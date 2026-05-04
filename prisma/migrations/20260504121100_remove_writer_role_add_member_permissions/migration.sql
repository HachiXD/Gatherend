/*
  Warnings:

  - The values [WRITER] on the enum `MemberRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "MemberPermission" AS ENUM ('WRITE_WIKI');

-- AlterEnum
BEGIN;
CREATE TYPE "MemberRole_new" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'GUEST');
ALTER TABLE "public"."Member" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Member" ALTER COLUMN "role" TYPE "MemberRole_new" USING ("role"::text::"MemberRole_new");
ALTER TYPE "MemberRole" RENAME TO "MemberRole_old";
ALTER TYPE "MemberRole_new" RENAME TO "MemberRole";
DROP TYPE "public"."MemberRole_old";
ALTER TABLE "Member" ALTER COLUMN "role" SET DEFAULT 'GUEST';
COMMIT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "permissions" "MemberPermission"[] DEFAULT ARRAY[]::"MemberPermission"[];
