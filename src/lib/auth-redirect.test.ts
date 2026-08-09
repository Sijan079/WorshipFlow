import assert from "node:assert/strict";
import { getAuthCallbackRecoveryUrl, getAuthRedirectUrl } from "./auth-redirect.ts";

export function runAuthRedirectTests() {
  assert.equal(
    getAuthRedirectUrl("http://localhost:3000", "/workspaces"),
    "http://localhost:3000/auth/callback?next=%2Fworkspaces",
  );

  assert.equal(
    getAuthCallbackRecoveryUrl("https://sndev-worship-flow.vercel.app/?code=oauth-code"),
    "https://sndev-worship-flow.vercel.app/auth/callback?code=oauth-code",
  );
  assert.equal(
    getAuthCallbackRecoveryUrl("https://sndev-worship-flow.vercel.app/?utm_source=test"),
    null,
  );
  assert.equal(
    getAuthCallbackRecoveryUrl("https://sndev-worship-flow.vercel.app/login?code=oauth-code"),
    null,
  );
}
