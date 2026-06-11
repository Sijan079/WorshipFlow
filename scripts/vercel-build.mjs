import "dotenv/config";
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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for the Vercel build.");
  process.exit(1);
}

if (process.env.DIRECT_DATABASE_URL) {
  run("npx", ["prisma", "migrate", "deploy"], {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DIRECT_DATABASE_URL,
    },
  });
} else {
  console.log("DIRECT_DATABASE_URL is not set; skipping prisma migrate deploy.");
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
