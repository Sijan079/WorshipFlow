import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const dockerStartupTimeoutMs = 120_000;
const prismaMigrationsPath = path.join("prisma", "migrations-current");
const dockerDesktopPath = path.join(
  process.env.ProgramFiles ?? "C:\\Program Files",
  "Docker",
  "Docker",
  "Docker Desktop.exe",
);

function runOrExit(command, args) {
  const result = spawnSync(command, args, {
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function isDockerReady() {
  const result = spawnSync("docker", ["info"], {
    shell: process.platform === "win32",
    stdio: "ignore",
  });

  return result.status === 0;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function ensureDockerReady() {
  if (isDockerReady() || process.platform !== "win32") {
    return;
  }

  if (!existsSync(dockerDesktopPath)) {
    throw new Error(
      "Docker is not running and Docker Desktop.exe was not found. Start Docker, then run npm run dev again.",
    );
  }

  console.log("Docker is not running. Starting Docker Desktop...");
  const dockerDesktop = spawn(dockerDesktopPath, [], {
    detached: true,
    stdio: "ignore",
  });
  dockerDesktop.unref();

  const deadline = Date.now() + dockerStartupTimeoutMs;
  while (Date.now() < deadline) {
    await sleep(2_000);
    if (isDockerReady()) {
      console.log("Docker Desktop is ready.");
      return;
    }
  }

  throw new Error(
    "Docker Desktop did not become ready within two minutes. Finish starting Docker Desktop, then run npm run dev again.",
  );
}

async function needsPrismaBaselineBootstrap() {
  const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_DATABASE_URL is required for local Prisma migrations.");
  }

  const pool = new pg.Pool({ connectionString });
  try {
    const result = await pool.query("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists");
    return !result.rows[0]?.exists;
  } finally {
    await pool.end();
  }
}

function getPrismaMigrationNames() {
  return readdirSync(prismaMigrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(prismaMigrationsPath, entry.name, "migration.sql")))
    .map((entry) => entry.name)
    .sort();
}

try {
  await ensureDockerReady();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.log("Starting local Supabase services through Docker...");
runOrExit("npx", ["supabase", "start"]);

if (await needsPrismaBaselineBootstrap()) {
  console.log("Synchronizing the current Prisma schema for the fresh local database...");
  runOrExit("npx", ["prisma", "db", "push", "--skip-generate"]);

  console.log("Recording existing Prisma migrations as the local baseline...");
  for (const migrationName of getPrismaMigrationNames()) {
    runOrExit("npx", ["prisma", "migrate", "resolve", "--applied", migrationName]);
  }
}

console.log("Applying Prisma migrations to the local Supabase database...");
runOrExit("npx", ["prisma", "migrate", "deploy"]);

const nextCli = path.join("node_modules", "next", "dist", "bin", "next");
const next = spawn(process.execPath, [nextCli, "dev", ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
});

next.on("error", (error) => {
  console.error("Failed to start the local Next.js server:", error);
  process.exitCode = 1;
});

next.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
