import { cleanupFormatterDrafts } from "../src/features/song-formatter/draft-store.ts";
import prisma from "../src/lib/prisma.ts";
import { reportServerFailure } from "../src/lib/observability.ts";

async function run() {
  try { console.log(`Formatter cleanup removed ${await cleanupFormatterDrafts()} expired draft(s).`); }
  catch (error) {
    reportServerFailure(error, { event: "formatter.cleanup.failure", route: "formatter-cleanup-worker", source: "worker", status: 503 });
    if (!process.argv.includes("--watch")) process.exitCode = 1;
  }
}
async function main() {
  await run();
  if (process.argv.includes("--watch")) {
    let running = false;
    const timer = setInterval(async () => { if (running) return; running = true; try { await run(); } finally { running = false; } }, 5 * 60 * 1000);
    const stop = async () => { clearInterval(timer); await prisma.$disconnect(); process.exit(); };
    process.on("SIGINT", stop); process.on("SIGTERM", stop);
  } else await prisma.$disconnect();
}
void main();
