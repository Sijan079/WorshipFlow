import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runSettingsNavigationTests() {
  const settings = readFileSync(join(process.cwd(), "src", "components", "settings-page-client.tsx"), "utf8");

  assert.doesNotMatch(settings, /id: "block-types", label: "Block types"/);
  assert.doesNotMatch(settings, /settings-panel-block-types/);
  assert.doesNotMatch(settings, /<ProgramBlockTypesSection/);
  assert.match(settings, /id: "integrations", label: "Integrations"/);
  assert.doesNotMatch(settings, /id: "usage-billing", label: "Usage & billing"/);
  assert.match(settings, /settings-panel-integrations/);
  assert.match(settings, /Google Drive/);
  assert.match(settings, /YouTube/);
  assert.match(settings, /Facebook Pages/);
  assert.match(settings, /Instagram/);
  assert.doesNotMatch(settings, /settings-panel-usage-billing/);
  assert.match(settings, /title="Service Templates"\s+description="Build reusable service flows\. Their stored order is copied into every new service\."\s+flat/);
  assert.match(settings, /overflow-hidden rounded-md border border-\[var\(--border-default\)\] bg-\[var\(--surface-panel\)\] shadow-\[var\(--elevation-subtle\)\]/);
  assert.match(settings, /label="New template"/);
  assert.match(settings, /action=\{\(\s*<div className="flex flex-wrap items-center justify-end gap-2">/);
  assert.match(settings, /id: `\$\{record\.id\}-\$\{block\.code \|\| "block"\}-\$\{index\}`/);
}
