-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "choicesEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "useMidModel" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suggestDate" TEXT,
ADD COLUMN     "suggestUsed" INTEGER NOT NULL DEFAULT 0;
