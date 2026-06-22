import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MEDIA_TOOLS_MODULE, WORKSPACE_MODULES } from "./workspace-modules.ts";

export function runWorkspaceModulesTests() {
  assert.equal(MEDIA_TOOLS_MODULE, "media-tools");
  assert.equal(WORKSPACE_MODULES.includes("media-tools"), true);
  assert.equal(WORKSPACE_MODULES.includes("assets" as never), false);

  const mediaToolsPages = [
    "page.tsx",
    "phone-transfer/page.tsx",
    "qr-generator/page.tsx",
    "background-generator/page.tsx",
    "resize-image/page.tsx",
  ];

  for (const relativePath of mediaToolsPages) {
    const source = readFileSync(
      join(process.cwd(), "src", "app", "(workspace)", "media-tools", relativePath),
      "utf8",
    );
    assert.doesNotMatch(source, /module="assets"/);
  }
}
