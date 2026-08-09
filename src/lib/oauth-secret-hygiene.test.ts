import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

export function runOAuthSecretHygieneTests() {
  assert.match(read(".gitignore"), /^\/client_secret\*\.json$/m);
}

export function runOAuthClientBoundaryTests() {
  const client = read("src/lib/supabase/client.ts");
  const login = read("src/components/login-form.tsx");
  const callback = read("src/app/auth/callback/route.ts");
  const session = read("src/app/api/auth/session/route.ts");
  const source = `${client}\n${login}\n${callback}\n${session}`;

  assert.doesNotMatch(source, /GOOGLE_CLIENT_SECRET|client_secret/i);
  assert.doesNotMatch(source, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
}
