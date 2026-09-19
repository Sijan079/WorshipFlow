import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isGlobalApiPathForProxy, isPublicPathForProxy } from "./lib/proxy-paths.ts";

export function runProxyTests() {
  assert.equal(isPublicPathForProxy("/"), true);
  assert.equal(isPublicPathForProxy("/login"), true);
  assert.equal(isPublicPathForProxy("/api/auth/login"), true);
  assert.equal(isPublicPathForProxy("/api/health"), false);
  assert.equal(isGlobalApiPathForProxy("/api/health"), true);
  assert.equal(isGlobalApiPathForProxy("/api/health/details"), false);
  assert.equal(isPublicPathForProxy("/api/internal/formatter-cleanup"), true);
  assert.equal(isPublicPathForProxy("/mockups/purple-editorial-signal.png"), true);
  assert.equal(isPublicPathForProxy("/mockups/isms/08-material.png"), true);
  assert.equal(isPublicPathForProxy("/api/pap/uploads"), false);
  assert.equal(isPublicPathForProxy("/api/pap/uploads/abc123/download"), false);

  const proxySource = readFileSync(new URL("./proxy.ts", import.meta.url), "utf8");
  assert.ok(
    proxySource.indexOf("if (isPublicPathForProxy(request.nextUrl.pathname))") <
      proxySource.indexOf("const session = await updateSession(request, response)"),
    "public paths must bypass remote session validation",
  );
}
