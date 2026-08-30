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
  const backgroundRemoval = readFileSync(
    join(process.cwd(), "src", "components", "background-removal-tool.tsx"),
    "utf8",
  );
  const backgroundRemovalRoute = readFileSync(
    join(process.cwd(), "src", "app", "api", "media", "background-removal", "route.ts"),
    "utf8",
  );

  assert.match(page, /case "song-formatter\/upload":/);
  assert.match(page, /case "song-formatter\/format":/);
  assert.match(page, /case "songs\/upload":[\s\S]*?redirect\([\s\S]*?song-formatter\/upload/);
  assert.match(page, /case "songs\/format":[\s\S]*?redirect\([\s\S]*?song-formatter\/format/);

  for (const mediaTool of ["phone-transfer", "qr-generator", "background-generator", "resize-image", "background-removal"]) {
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
  assert.match(serviceBuilder, /<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">/);
  assert.doesNotMatch(serviceBuilder, /grid divide-y divide-\[var\(--border-default\)\] border-y/);
  assert.match(serviceBuilder, /group pressable flex min-h-32 flex-col items-center justify-center gap-3 rounded-\[var\(--radius-card\)\] border border-\[var\(--border-default\)\] bg-\[var\(--surface-panel\)\] p-4 text-center shadow-\[var\(--elevation-subtle\)\] hover:bg-\[var\(--action-primary-bg\)\] hover:text-\[var\(--action-primary-ink\)\]/);
  assert.match(backgroundRemoval, /import \{ triggerBrowserDownload, workspaceApiPath \} from "@\/lib\/api-client"/);
  assert.match(backgroundRemoval, /fetch\(workspaceApiPath\("\/api\/media\/background-removal"\)/);
  assert.match(backgroundRemovalRoute, /model: "gpt-image-2"/);
  assert.doesNotMatch(backgroundRemovalRoute, /integration\?\.backgroundImageModel/);
}
