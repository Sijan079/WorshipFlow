import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Prisma.");
}

const directDatabaseUrl = process.env.DIRECT_DATABASE_URL;
if (!directDatabaseUrl) {
  throw new Error("DIRECT_DATABASE_URL is required for Prisma.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
    directUrl: directDatabaseUrl,
  },
  migrations: {
    path: "prisma/migrations-current",
    seed: "npx tsx prisma/seed.ts",
  },
});
