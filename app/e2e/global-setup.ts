import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { seed } from "../prisma/seed";

const E2E_DB = "postgresql://bukucha:bukucha@localhost:5432/bukucha_e2e";

export default async function globalSetup() {
  // E2E専用DBを作り直してスキーマ適用+シード
  execSync(
    `psql postgresql://bukucha:bukucha@localhost:5432/postgres -c "DROP DATABASE IF EXISTS bukucha_e2e;" -c "CREATE DATABASE bukucha_e2e;"`,
    { stdio: "inherit" }
  );
  execSync(`npx prisma db push --skip-generate`, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: E2E_DB },
  });
  const db = new PrismaClient({ datasources: { db: { url: E2E_DB } } });
  await seed(db);
  await db.$disconnect();
}
