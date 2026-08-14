import { PrismaClient } from "@prisma/client";
import { syncSeedContent } from "./seed";

// シード済みDBの編集部作品コンテンツを最新シード内容へ同期する(vercel-buildから実行)
const db = new PrismaClient();
syncSeedContent(db)
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
