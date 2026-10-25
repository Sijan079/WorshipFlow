import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../../next.config.ts";

test("only the workspace captions page permits browser microphone requests", async () => {
  const rules = await nextConfig.headers?.();
  assert.ok(rules);
  const allRoutes = rules.find((rule) => rule.source === "/(.*)");
  const captions = rules.find((rule) => rule.source === "/w/:workspaceSlug/captions");
  assert.match(allRoutes?.headers.find((header) => header.key === "Permissions-Policy")?.value ?? "", /microphone=\(\)/);
  assert.match(captions?.headers.find((header) => header.key === "Permissions-Policy")?.value ?? "", /microphone=\(self\)/);
});
