import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runWorkspaceRouteTests() {
  const page = readFileSync(
    join(process.cwd(), "src", "app", "w", "[workspaceSlug]", "[[...path]]", "page.tsx"),
    "utf8",
  );
  const serviceBuilder = readFileSync(
    join(process.cwd(), "src", "components", "service-builder-client.tsx"),
    "utf8",
  );

  assert.match(page, /case "song-formatter\/upload":/);
  assert.match(page, /case "song-formatter\/format":/);
  assert.match(page, /case "songs\/upload":[\s\S]*?redirect\([\s\S]*?song-formatter\/upload/);
  assert.match(page, /case "songs\/format":[\s\S]*?redirect\([\s\S]*?song-formatter\/format/);

  for (const mediaTool of ["phone-transfer", "qr-generator", "background-generator", "resize-image"]) {
    assert.match(
      page,
      new RegExp(
        `case "media-tools/${mediaTool}":[\\s\\S]*?mediaTool="${mediaTool}"`,
      ),
    );
  }

  assert.match(serviceBuilder, /const workspaceMediaToolsPath = \(tool\?: MediaTool\)/);
  assert.match(serviceBuilder, /href=\{workspaceMediaToolsPath\(\)\}/);
  assert.equal(
    serviceBuilder.match(/href=\{workspaceMediaToolsPath\(tool\.id\)\}/g)?.length,
    2,
  );
  assert.doesNotMatch(serviceBuilder, /href=\{tool\.href\}/);
  assert.doesNotMatch(serviceBuilder, /href="\/media-tools"/);
}
