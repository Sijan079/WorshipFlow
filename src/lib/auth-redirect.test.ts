import assert from "node:assert/strict";
import { getAuthRedirectUrl } from "./auth-redirect.ts";

export function runAuthRedirectTests() {
  assert.equal(
    getAuthRedirectUrl("http://localhost:3000", "/workspaces"),
    "http://localhost:3000/auth/callback?next=%2Fworkspaces",
  );
}
