import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { DEFAULT_SONG_TAG_PRESETS, upsertDefaultSongTagPresets } from "./song-tag-defaults";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is missing.");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await upsertDefaultSongTagPresets(prisma);
  console.log(`Upserted ${DEFAULT_SONG_TAG_PRESETS.length} default song tag presets.`);
}

main()
  .catch((error) => {
    console.error("Error seeding default song tags:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
