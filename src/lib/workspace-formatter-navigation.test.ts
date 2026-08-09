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

  assert.match(source, /queryClient\.getQueryData<FormatterDraftSession>\(formatterDraftQueryKey\)/);
  assert.match(source, /queryClient\.setQueryData\(formatterDraftQueryKey/);
  assert.match(source, /text: result\.text/);
  assert.match(source, /songTitle: extractorSongTitle/);
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

test("formatter editor uses current semantic workspace theme tokens", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "components", "service-builder-client.tsx"),
    "utf8",
  );
  const editorMarker = source.indexOf("Song Editor");
  const editorStart = source.lastIndexOf("<section", editorMarker);
  const editorEnd = source.indexOf("No extracted draft yet", editorMarker);
  const editor = source.slice(editorStart, editorEnd);

  assert.match(editor, /bg-\[var\(--surface-panel\)\]/);
  assert.match(editor, /text-\[var\(--text-primary\)\]/);
  assert.match(editor, /border-\[var\(--border-default\)\]/);
  assert.doesNotMatch(editor, /var\(--color-(?:accent-ink|brand-|card-yellow|danger|focus|secondary|text-)/);
});

test("formatter block editor uses a viewport-aware scrollable workspace", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "components", "service-builder-client.tsx"),
    "utf8",
  );
  const editorMarker = source.indexOf("Song Editor");
  const editorStart = source.lastIndexOf("<section", editorMarker);
  const editorEnd = source.indexOf("No extracted draft yet", editorMarker);
  const editor = source.slice(editorStart, editorEnd);

  assert.match(
    editor,
    /className="grid h-\[clamp\(32rem,calc\(100dvh-12rem\),45rem\)\] items-stretch overflow-hidden"/,
  );
  assert.match(editor, /className="relative overflow-y-auto border-r/);
  assert.match(editor, /className="flex min-h-0 min-w-0 flex-col overflow-hidden/);
  assert.match(editor, /className="flex shrink-0 items-center justify-between border-b/);
  assert.match(editor, /className="min-h-0 flex-1 overflow-y-auto p-6"/);
  assert.match(editor, /className="flex shrink-0 flex-col gap-3 border-t/);
  assert.ok(editor.indexOf("Interactive Block Editor") < editor.indexOf('className="min-h-0 flex-1 overflow-y-auto p-6"'));
  assert.ok(editor.indexOf('className="min-h-0 flex-1 overflow-y-auto p-6"') < editor.indexOf("Clear draft"));
  assert.doesNotMatch(editor, /overscroll-contain/);
  assert.doesNotMatch(editor, /max-h-\[calc\(100vh-14rem\)\]/);
});
