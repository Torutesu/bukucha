-- AlterTable
ALTER TABLE "Situation" ADD COLUMN     "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "creatorComment" TEXT,
ADD COLUMN     "lore" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "style" JSONB NOT NULL DEFAULT '{}';

