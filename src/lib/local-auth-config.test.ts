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

  assert.equal(
    packageJson.scripts?.["dev:docker"],
    "node --env-file=.env.local.docker scripts/dev-docker.mjs",
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
  assert.match(readme, /npm run dev:docker/);
  assert.match(readme, /http:\/\/127\.0\.0\.1:54321\/auth\/v1\/callback/);
}
