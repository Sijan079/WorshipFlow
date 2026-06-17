import assert from "node:assert/strict";
import { isPublicPathForProxy } from "./lib/proxy-paths.ts";

export function runProxyTests() {
  assert.equal(isPublicPathForProxy("/login"), true);
  assert.equal(isPublicPathForProxy("/api/auth/login"), true);
  assert.equal(isPublicPathForProxy("/api/pap/uploads"), false);
  assert.equal(isPublicPathForProxy("/api/pap/uploads/abc123/download"), false);
}
