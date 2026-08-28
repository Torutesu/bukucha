import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { seed } from "../prisma/seed";

const E2E_DB = "postgresql://headcanon:headcanon@localhost:5432/headcanon_e2e";

export default async function globalSetup() {
  // Rebuild the E2E database from scratch, then seed it.
  execSync(
    `psql postgresql://headcanon:headcanon@localhost:5432/postgres -c "DROP DATABASE IF EXISTS headcanon_e2e;" -c "CREATE DATABASE headcanon_e2e;"`,
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
