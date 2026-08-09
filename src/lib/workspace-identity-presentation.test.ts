import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runWorkspaceIdentityPresentationTests() {
  const adminSections = readFileSync(
    join(process.cwd(), "src", "components", "settings-admin-sections.tsx"),
    "utf8",
  );

  assert.match(adminSections, />Workspace Identity<\/h3>/);
  assert.doesNotMatch(adminSections, />Workspace identity<\/h3>/);
  assert.match(
    adminSections,
    /overflow-hidden rounded-lg border border-\[var\(--border-default\)\] bg-\[var\(--surface-panel\)\] shadow-\[var\(--elevation-subtle\)\]/,
  );
}
