import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

export function runRlsHardeningTests() {
  const migration = readFileSync(
    path.join(root, "prisma/migrations-current/20260906000000_harden_exposed_workspace_tables/migration.sql"),
    "utf8",
  );
  const tables = [
    "ErrorNotification",
    "FeedbackRateLimit",
    "ProgramBlockType",
    "ProgramBlockTypeVersion",
    "ServiceTemplateBlock",
    "WorkspaceIntegration",
  ];

  for (const table of tables) {
    assert.match(migration, new RegExp(`'${table}'`));
  }
  assert.match(migration, /ALTER TABLE public\.%I ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.%I FROM anon, authenticated/);
}
