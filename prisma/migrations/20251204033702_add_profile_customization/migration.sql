-- CreateEnum
CREATE TYPE "UsernameFormat" AS ENUM ('NORMAL', 'BOLD', 'ITALIC');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "badge" VARCHAR(30),
ADD COLUMN     "longDescription" VARCHAR(200),
ADD COLUMN     "usernameColor" TEXT,
ADD COLUMN     "usernameFormat" "UsernameFormat" NOT NULL DEFAULT 'NORMAL';
