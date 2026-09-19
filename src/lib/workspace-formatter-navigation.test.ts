import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

test("formatter navigation preserves the active workspace route", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "components", "service-builder-client.tsx"),
    "utf8",
  );

  assert.doesNotMatch(source, /router\.push\("\/song-formatter\//);
  assert.doesNotMatch(source, /href="\/song-formatter\//);
  assert.match(source, /workspaceFormatterPath\("format"\)/);
  assert.match(source, /workspaceFormatterPath\("upload"\)/);
});

test("formatter extraction survives the upload-to-format route remount", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "components", "service-builder-client.tsx"),
    "utf8",
  );

  assert.match(source, /useServerDraft\(/);
  const route = readFileSync(join(process.cwd(), "src/app/api/extractor/route.ts"), "utf8");
  assert.match(route, /await createFormatterDraft/);
  assert.match(route, /conversionId: saved\.draft/);
  assert.doesNotMatch(source, /queryClient\.setQueryData\(formatterDraftQueryKey/);
});

test("formatter empty state uses the current light workspace theme", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "components", "service-builder-client.tsx"),
    "utf8",
  );
  const markerIndex = source.indexOf("No extracted draft yet");
  const emptyStateStart = source.lastIndexOf("<section", markerIndex);
  const emptyStateEnd = source.indexOf("</section>", markerIndex);
  const emptyState = source.slice(emptyStateStart, emptyStateEnd);

  assert.match(emptyState, /border-\[var\(--border-default\)\]/);
  assert.match(emptyState, /bg-\[var\(--surface-panel\)\]/);
  assert.match(emptyState, /text-\[var\(--text-primary\)\]/);
  assert.doesNotMatch(emptyState, /var\(--color-brand-/);
});

test("upload page keeps supported outputs in a header information popover", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "components", "service-builder-client.tsx"),
    "utf8",
  );
  const uploadStart = source.indexOf('activeSongStep === "upload"');
  const uploadEnd = source.indexOf('activeSongStep === "format"', uploadStart);
  const upload = source.slice(uploadStart, uploadEnd);

  assert.match(upload, /<Popover\.Root>/);
  assert.match(upload, /aria-label="Supported output formats"/);
  assert.match(upload, /border-0 bg-transparent/);
  assert.match(upload, /text-\[var\(--text-accent\)\]/);
  assert.doesNotMatch(upload, /aria-label="Supported output formats"[\s\S]{0,300}ui-btn-secondary/);
  assert.match(upload, /<Popover\.Content[\s\S]*align="end"/);
  assert.match(upload, /Planning Center XML/);
  assert.match(upload, /ProPresenter 7 Slides/);
  assert.doesNotMatch(upload, /md:grid-cols-3/);
});

test("recent conversions use icon actions and editor identity without expiry copy", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "components", "service-builder-client.tsx"),
    "utf8",
  );
  const recentStart = source.indexOf("Recent Conversions");
  const recentEnd = source.indexOf('activeSongStep === "format"', recentStart);
  const recent = source.slice(recentStart, recentEnd);

  assert.match(recent, /Last touched by/);
  assert.match(recent, /lastTouchedBy\?\.displayName/);
  assert.match(recent, /formatLastTouchedAge\(job\.lastTouchedAt/);
  assert.doesNotMatch(recent, /lastTouchedBy\?\.email|lastTouchedBy\.email/);
  assert.match(recent, /aria-label=\{`Resume /);
  assert.match(recent, /<Pencil/);
  assert.match(recent, /<Check/);
  assert.match(recent, /aria-busy="true"/);
  assert.match(recent, /animate-pulse/);
  assert.match(recent, /title="Done"[\s\S]{0,300}text-\[var\(--text-accent\)\]/);
  assert.doesNotMatch(recent, /min to resume|older draft|Recover draft|Open in editor/);
});

test("formatter uses the dedicated document editor and existing export workflow", () => {
  const source = readFileSync(join(process.cwd(), "src", "components", "service-builder-client.tsx"), "utf8");
  assert.match(source, /<SongDocumentEditor/);
  assert.match(source, /dynamic\(\(\) => import\("@\/features\/song-formatter\/song-document-editor"\)/);
  assert.match(source, /onExport=\{\(\) => generateLyricsDocxMutation\.mutate/);
  assert.match(source, /recovery\.clear\(\)/);
  assert.match(source, /extractorDraftText \|\| formatterDraftOpened/);
  assert.doesNotMatch(source, /Interactive Block Editor/);
});

test("document viewport uses semantic surfaces and continuous mobile editing", () => {
  const css = readFileSync(join(process.cwd(), "src", "features", "song-formatter", "song-document-editor.module.css"), "utf8");
  assert.match(css, /var\(--surface-panel\)/);
  assert.match(css, /var\(--text-primary\)/);
  assert.match(css, /var\(--border-default\)/);
  assert.match(css, /overflow: auto/);
  assert.match(css, /100dvh/);
  assert.match(css, /data-continuous='true'/);
});

test("clearing the formatter removes recovery and returns to song selection", () => {
  const source = readFileSync(join(process.cwd(), "src", "components", "service-builder-client.tsx"), "utf8");
  const clear = source.slice(source.indexOf("onClear={async () =>"), source.indexOf("onClear={async () =>") + 1000);
  assert.match(clear, /recovery\.clear\(\)/);
  assert.match(clear, /if \(!await recovery\.clear\(\)\) return/);
  assert.match(clear, /setExtractorDraftText\(""\)/);
  assert.match(clear, /router\.push\(workspaceFormatterPath\("upload"\)\)/);
});
