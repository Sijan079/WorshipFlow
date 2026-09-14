import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXTRACTOR_WARNING_CODES } from "./extractor-types.ts";
import { normalizeExtractorWarnings } from "./extractor-warnings.ts";

export function runExtractorWarningTests() {
  const normalized = normalizeExtractorWarnings([
    ...EXTRACTOR_WARNING_CODES,
    "possible_trailing_content_detected",
  ]);

  assert.equal(normalized.length, EXTRACTOR_WARNING_CODES.length, "warning codes are de-duplicated");
  for (const warning of normalized) {
    assert.ok(warning.title.length > 0, `${warning.code} has a user-facing title`);
    assert.ok(warning.message.length > 0, `${warning.code} has user-facing guidance`);
    assert.doesNotMatch(warning.title, /_/);
  }

  const editorSource = readFileSync(
    join(process.cwd(), "src", "components", "service-builder-client.tsx"),
    "utf8",
  );
  const warningPanelIndex = editorSource.indexOf('aria-label="Formatter warnings"');
  const formattedSectionsIndex = editorSource.indexOf("editorSections.map", warningPanelIndex);
  assert.ok(warningPanelIndex >= 0, "the formatter renders a visible warning section");
  assert.ok(formattedSectionsIndex > warningPanelIndex, "warnings appear above the formatted song sections");
  assert.match(editorSource, /aria-label="Dismiss formatter warnings"/);
  assert.match(editorSource, /normalizeExtractorWarnings\(extractorWarningCodes\)/);
  assert.doesNotMatch(editorSource, /extractorAiRetry\.warningCodes\.join/);
}
