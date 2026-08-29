import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runDeploymentBuildTests() {
  const buildScript = readFileSync(join(process.cwd(), "scripts", "vercel-build.mjs"), "utf8");
  assert.match(buildScript, /runOrExit\("npx", \["prisma", "migrate", "deploy"\]/);
  assert.doesNotMatch(buildScript, /continuing build/);
}
