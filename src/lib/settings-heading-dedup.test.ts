import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runSettingsHeadingDedupTests() {
  const settings = readFileSync(
    join(process.cwd(), "src", "components", "settings-page-client.tsx"),
    "utf8",
  );
  assert.doesNotMatch(settings, /function refreshAll\(/);
  assert.doesNotMatch(settings, /aria-label="Refresh settings"/);
  assert.doesNotMatch(settings, />Settings <span aria-hidden="true"/);
  assert.doesNotMatch(settings, />General<\/h2>/);
  assert.doesNotMatch(settings, />Usage &amp; billing<\/h2>|>Usage & billing<\/h2>/);
  assert.equal(settings.match(/showTitle=\{false\}/g)?.length, 4);

  assert.equal(
    settings.match(/\[&>section>div:first-child>h2\]:hidden/g)?.length,
    2,
  );
  assert.match(settings, /role="tablist"/);
  assert.match(settings, /aria-selected=\{selected\}/);
}
