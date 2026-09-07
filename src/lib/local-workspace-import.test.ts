import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

export function runLocalWorkspaceImportTests() {
  const source = readFileSync(path.join(root, "scripts", "import-remote-workspace.mjs"), "utf8");

  assert.match(source, /--apply/);
  assert.match(source, /--reset-local/);
  assert.match(source, /auth\.users/);
  assert.match(source, /session_replication_role = replica/);
  assert.match(source, /WorkspaceIntegration/);
  assert.match(source, /GeneratedOutput/);
  assert.match(source, /remote database is never modified/i);
}
