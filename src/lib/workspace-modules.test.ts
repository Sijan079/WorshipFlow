import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MEDIA_TOOLS_MODULE, WORKSPACE_MODULES } from "./workspace-modules.ts";

export function runWorkspaceModulesTests() {
  assert.equal(MEDIA_TOOLS_MODULE, "media-tools");
  assert.equal(WORKSPACE_MODULES.includes("media-tools"), true);
  assert.equal(WORKSPACE_MODULES.includes("assets" as never), false);

  const workspacePage = readFileSync(
    join(process.cwd(), "src", "app", "w", "[workspaceSlug]", "[[...path]]", "page.tsx"),
    "utf8",
  );
  for (const tool of ["phone-transfer", "qr-generator", "background-generator", "comment-card", "resize-image", "background-removal"]) {
    assert.match(workspacePage, new RegExp(`case "media-tools/${tool}":`));
  }
  assert.doesNotMatch(workspacePage, /module="assets"/);

  const serviceBuilder = readFileSync(
    join(process.cwd(), "src", "components", "service-builder-client.tsx"),
    "utf8",
  );
  assert.match(serviceBuilder, /import ResizeImageTool from "@\/components\/resize-image-tool"/);
  assert.match(serviceBuilder, /import CommentCardTool from "@\/components\/comment-card-tool"/);
  assert.match(serviceBuilder, /mediaTool === "resize-image"[\s\S]*?<ResizeImageTool showToast=\{showToast\}/);
  assert.match(serviceBuilder, /mediaTool === "comment-card"[\s\S]*?<CommentCardTool showToast=\{showToast\}/);
}
