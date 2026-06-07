import assert from "node:assert/strict";
import { getDefaultWorkspaceSlug } from "./security-context.ts";

export function runSecurityContextTests() {
  assert.equal(getDefaultWorkspaceSlug({}), "default");
  assert.equal(getDefaultWorkspaceSlug({ WORSHIP_WORKSPACE_SLUG: "production" }), "production");
}
