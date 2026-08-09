import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runWorkspaceMembersRouteTests() {
  const source = readFileSync(
    join(process.cwd(), "src", "app", "api", "workspaces", "[workspaceSlug]", "members", "route.ts"),
    "utf8",
  );

  assert.match(source, /orderBy: \[\{ role: "asc" \}, \{ createdAt: "asc" \}, \{ id: "asc" \}\]/);
}
