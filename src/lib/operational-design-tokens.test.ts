import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function relativeLuminance(hex: string) {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function runOperationalDesignTokenTests() {
  const tokensSource = readFileSync(join(process.cwd(), "tokens.css"), "utf8");
  const globalsSource = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const workspaceTheme = globalsSource.slice(
    globalsSource.indexOf(".workspace-content-light {"),
    globalsSource.indexOf(".workspace-content-light input"),
  );
  const railTheme = globalsSource.slice(
    globalsSource.indexOf(".workspace-nav-surface {"),
    globalsSource.indexOf(".workspace-content-light {"),
  );

  assert.match(tokensSource, /\/\* Operational workspace palette: Services and Teams \*\//);
  assert.match(tokensSource, /--palette-workspace-canvas: #ffffff;/);
  assert.match(tokensSource, /--palette-workspace-control-inactive: #f1f5f9;/);
  assert.match(tokensSource, /--palette-workspace-accent: #7c3aed;/);
  assert.match(tokensSource, /--palette-workspace-accent-hover: #8754ee;/);
  assert.ok(contrastRatio("#8754ee", "#ffffff") >= 4.5, "Primary hover must retain readable white text.");
  assert.ok(contrastRatio("#b91c1c", "#ffffff") >= 4.5, "Danger hover must retain readable white text.");
  assert.match(tokensSource, /--workspace-surface-panel-strong: var\(--palette-workspace-control-inactive\);/);
  assert.match(tokensSource, /--workspace-elevation-raised:/);
  assert.match(tokensSource, /--control-height-compact: 2\.5rem;/);
  assert.match(tokensSource, /--control-height-standard: 2\.75rem;/);
  assert.match(tokensSource, /--touch-target-min: 2\.5rem;/);
  assert.match(tokensSource, /--ledger-row-min-height: 4\.5rem;/);
  assert.match(tokensSource, /--row-menu-touch-width: 3\.75rem;/);

  assert.match(workspaceTheme, /--surface-app: var\(--workspace-surface-app\);/);
  assert.match(workspaceTheme, /--action-primary-bg: var\(--workspace-action-primary-bg\);/);
  assert.match(workspaceTheme, /--elevation-raised: var\(--workspace-elevation-raised\);/);
  assert.doesNotMatch(workspaceTheme, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(workspaceTheme, /rgb\(/i);

  assert.match(railTheme, /--surface-canvas: var\(--rail-surface-canvas\);/);
  assert.doesNotMatch(railTheme, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(railTheme, /rgb\(/i);

  assert.match(globalsSource, /min-height: var\(--control-height-compact\);/);
  assert.match(globalsSource, /min-height: var\(--ledger-row-min-height\);/);
  assert.match(globalsSource, /width: var\(--row-menu-touch-width\);/);
  assert.match(
    globalsSource,
    /\.ui-btn-danger \{[\s\S]*?background: transparent;[\s\S]*?border: 1px solid var\(--border-default\);[\s\S]*?color: var\(--text-primary\);[\s\S]*?\}/,
  );
  assert.match(
    globalsSource,
    /\.ui-btn-danger:hover:not\(:disabled\) \{[\s\S]*?background: var\(--state-danger\);[\s\S]*?border-color: transparent;[\s\S]*?color: var\(--action-primary-ink\);[\s\S]*?\}/,
  );
}
