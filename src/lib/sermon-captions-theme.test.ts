import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runSermonCaptionsThemeTests() {
  const shell = readFileSync(
    join(process.cwd(), "src", "components", "workspace-shell.tsx"),
    "utf8",
  );
  const serviceBuilder = readFileSync(
    join(process.cwd(), "src", "components", "service-builder-client.tsx"),
    "utf8",
  );
  const automationStart = serviceBuilder.indexOf('{module === "automation" ? (');
  const automationEnd = serviceBuilder.indexOf("<PAPToastViewport", automationStart);
  const automationSection = serviceBuilder.slice(automationStart, automationEnd);
  const warningStart = shell.indexOf("{showInProgressWarning ? (");
  const warningEnd = shell.indexOf('<main id="workspace-content"', warningStart);
  const warningSection = shell.slice(warningStart, warningEnd);

  assert.match(
    warningSection,
    /workspace-content-light mx-auto[\s\S]*?bg-\[var\(--state-danger-soft\)\][\s\S]*?text-\[var\(--text-danger\)\]/,
  );
  assert.match(warningSection, /\{warningTitle\} is still in development/);
  assert.doesNotMatch(
    warningSection,
    /bg-\[var\(--surface-panel-strong\)\]/,
  );

  assert.match(
    serviceBuilder,
    /text-\[var\(--text-primary\)\][^>]*>[\s\S]*?\{moduleCopy\.title\}/,
  );
  assert.match(automationSection, /text-\[var\(--text-primary\)\]/);
  assert.match(automationSection, /bg-\[var\(--surface-panel-alt\)\]/);
  assert.match(automationSection, /text-\[var\(--text-secondary\)\]/);
  assert.doesNotMatch(automationSection, /--color-/);
}
