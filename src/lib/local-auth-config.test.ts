import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

export function runLocalAuthConfigTests() {
  const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
  const supabaseConfig = read("supabase/config.toml");
  const readme = read("README.md");
  const agentsGuide = read("AGENTS.md");
  const gitignore = read(".gitignore");

  assert.equal(
    packageJson.scripts?.dev,
    "npm run dev:docker",
  );
  assert.equal(
    packageJson.scripts?.["dev:docker"],
    "node --env-file=.env.local.docker scripts/dev-docker.mjs",
  );
  const dockerDevScript = read("scripts/dev-docker.mjs");
  assert.match(
    dockerDevScript,
    /runOrExit\("npx", \["supabase", "start"\]\)/,
    "The Docker dev entry point must start local Supabase services.",
  );
  assert.match(
    dockerDevScript,
    /runOrExit\("npx", \["prisma", "migrate", "deploy"\]\)/,
    "The Docker dev entry point must apply Prisma migrations before starting Next.js.",
  );
  assert.match(
    dockerDevScript,
    /runOrExit\("npx", \["prisma", "db", "push", "--skip-generate"\]\)/,
    "The Docker dev entry point must synchronize the current Prisma schema on a fresh local database.",
  );
  assert.match(
    dockerDevScript,
    /readdirSync\(prismaMigrationsPath, \{ withFileTypes: true \}\)/,
    "The Docker dev entry point must record all checked-in migrations as historical after a fresh-schema bootstrap.",
  );
  assert.match(
    dockerDevScript,
    /entry\.isDirectory\(\) && existsSync\(path\.join\(prismaMigrationsPath, entry\.name, "migration\.sql"\)\)/,
    "The Docker dev entry point must ignore migration directories without a migration SQL file.",
  );
  assert.match(
    dockerDevScript,
    /Docker Desktop\.exe/,
    "The Docker dev entry point must be able to launch Docker Desktop on Windows.",
  );
  assert.match(
    dockerDevScript,
    /ensureDockerReady/,
    "The Docker dev entry point must wait for Docker before starting Supabase.",
  );
  assert.match(supabaseConfig, /site_url = "http:\/\/localhost:3000"/);
  assert.match(
    supabaseConfig,
    /additional_redirect_urls = \["http:\/\/localhost:3000\/auth\/callback"\]/,
  );
  assert.match(supabaseConfig, /\[auth\.external\.google\][\s\S]*?enabled = true/);
  assert.match(
    supabaseConfig,
    /client_id = "env\(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID\)"/,
  );
  assert.match(
    supabaseConfig,
    /secret = "env\(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET\)"/,
  );
  assert.match(readme, /npm run dev/);
  assert.match(readme, /http:\/\/127\.0\.0\.1:54321\/auth\/v1\/callback/);
  assert.match(
    agentsGuide,
    /Always start the development server with `npm run dev` so it uses the local Docker Supabase stack\./,
  );
  assert.match(gitignore, /^\/remote-supabase-\*\.sql$/m);
  assert.match(gitignore, /^\/supabase_db_\*-backup-\*\.tar\.gz$/m);
}
