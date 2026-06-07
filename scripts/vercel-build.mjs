import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const migrationDatabaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!migrationDatabaseUrl) {
  console.error("DIRECT_DATABASE_URL or DATABASE_URL is required for Prisma migrations.");
  process.exit(1);
}

run("npx", ["prisma", "migrate", "deploy"], {
  env: {
    ...process.env,
    DATABASE_URL: migrationDatabaseUrl,
  },
});

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
