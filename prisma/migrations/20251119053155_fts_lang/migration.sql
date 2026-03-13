-- CreateEnum
CREATE TYPE "Languages" AS ENUM ('EN', 'ES');

-- DropIndex
DROP INDEX "public"."board_document_idx";

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "languages" "Languages"[] DEFAULT ARRAY['EN']::"Languages"[];

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "languages" "Languages"[] DEFAULT ARRAY['EN']::"Languages"[];
