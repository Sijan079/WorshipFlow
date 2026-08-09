import assert from "node:assert/strict";
import {
  WORKSPACE_ROLES,
  canManageMembers,
  canMutateWorkspace,
  canManageMember,
  type WorkspaceRole,
} from "./workspace-auth.ts";

export function runWorkspaceAuthTests() {
  assert.deepEqual(WORKSPACE_ROLES, ["OWNER", "ADMIN", "MEMBER"]);
  assert.equal(canMutateWorkspace("OWNER"), true);
  assert.equal(canMutateWorkspace("ADMIN"), true);
  assert.equal(canMutateWorkspace("MEMBER"), false);
  assert.equal(canManageMembers("OWNER"), true);
  assert.equal(canManageMembers("ADMIN"), true);
  assert.equal(canManageMembers("MEMBER"), false);
  assert.equal(canMutateWorkspace("INVALID" as WorkspaceRole), false);
  assert.equal(canManageMember("OWNER", "ADMIN"), true);
  assert.equal(canManageMember("ADMIN", "ADMIN"), false);
  assert.equal(canManageMember("ADMIN", "MEMBER"), true);
  assert.equal(canManageMember("OWNER", "OWNER"), false);
}
