import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

function channel(value: number) {
  const unit = value / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((start) => channel(parseInt(hex.slice(start, start + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

// Trial (2026-10-27): sky blue is the secondary accent for accent text, links, and the hover and
// active states of secondary actions. Purple stays for primary actions, focus rings, and selection.
export function runSecondaryAccentTests() {
  const tokens = read("tokens.css");
  const globals = read("src", "app", "globals.css");

  // The colours pass WCAG AA (4.5:1) wherever they are used on the light workspace.
  const sky = "#0369a1";
  const skyHover = "#075985";
  const skySoft = "#e0f2fe";
  assert.match(tokens, /--palette-workspace-secondary: #0369a1;/);
  assert.match(tokens, /--palette-workspace-secondary-hover: #075985;/);
  assert.match(tokens, /--palette-workspace-secondary-soft: #e0f2fe;/);
  assert.match(tokens, /--palette-workspace-secondary-ink: #ffffff;/);
  for (const surface of ["#ffffff", "#f8fafc", "#f1f5f9"]) {
    assert.ok(contrast(sky, surface) >= 4.5, `accent text on ${surface} needs 4.5:1`);
  }
  assert.ok(contrast("#ffffff", sky) >= 4.5, "white text on the accent fill needs 4.5:1");
  assert.ok(contrast("#ffffff", skyHover) >= 4.5, "white text on the hover fill needs 4.5:1");
  assert.ok(contrast("#111827", skySoft) >= 4.5, "primary text on a highlighted row needs 4.5:1");
  assert.ok(contrast("#475569", skySoft) >= 4.5, "secondary text on a highlighted row needs 4.5:1");

  // One token recolours every piece of accent text and every link on the light workspace.
  assert.match(tokens, /--workspace-text-accent: var\(--palette-workspace-secondary\);/);
  assert.match(tokens, /--workspace-action-secondary-accent-bg: var\(--palette-workspace-secondary\);/);
  assert.match(tokens, /--workspace-action-secondary-accent-bg-hover: var\(--palette-workspace-secondary-hover\);/);
  assert.match(tokens, /--workspace-action-secondary-accent-ink: var\(--palette-workspace-secondary-ink\);/);
  assert.match(tokens, /--workspace-surface-highlight: var\(--palette-workspace-secondary-soft\);/);
  assert.match(globals, /--action-secondary-accent-bg: var\(--workspace-action-secondary-accent-bg\);/);
  assert.match(globals, /--action-secondary-accent-bg-hover: var\(--workspace-action-secondary-accent-bg-hover\);/);
  assert.match(globals, /--action-secondary-accent-ink: var\(--workspace-action-secondary-accent-ink\);/);
  assert.match(globals, /--surface-highlight: var\(--workspace-surface-highlight\);/);
  // Outside the light workspace (the dark rail, the login page) the accent falls back to purple.
  assert.match(tokens, /--action-secondary-accent-bg: var\(--palette-primary-fill\);/);
  assert.match(tokens, /--surface-highlight: var\(--palette-primary-focus\);/);

  // Purple is untouched where it must stay: primary fills, selection, and the focus ring.
  assert.match(tokens, /--palette-workspace-accent: #7c3aed;/);
  assert.match(tokens, /--workspace-border-focus: var\(--palette-workspace-accent\);/);
  assert.match(tokens, /--workspace-action-primary-bg: var\(--palette-workspace-accent\);/);

  // The places that borrowed a purple fill for a hover now use the secondary accent. A selected
  // dropdown row is a selection, so it stays purple.
  const select = read("src", "components", "ui", "production-select.tsx");
  assert.match(select, /hover:bg-\[var\(--surface-highlight\)\]/);
  assert.match(select, /focus:bg-\[var\(--surface-highlight\)\]/);
  assert.doesNotMatch(select, /hover:bg-\[var\(--palette-primary-focus\)\]|focus:bg-\[var\(--palette-primary-focus\)\]/);
  assert.match(select, /data-\[state=checked\]:bg-\[var\(--action-primary-bg\)\]/);
  const settings = read("src", "components", "settings-page-client.tsx");
  const builder = read("src", "components", "service-builder-client.tsx");
  for (const [name, source] of [["settings", settings], ["service builder", builder]] as const) {
    assert.doesNotMatch(source, /hover:bg-\[var\(--action-primary-bg\)\]/, `${name} still borrows the purple primary fill for a hover`);
    assert.match(source, /hover:bg-\[var\(--action-secondary-accent-bg\)\] hover:text-\[var\(--action-secondary-accent-ink\)\]/, name);
  }
  // Accent text that deepens on hover, and the faint wash behind a quiet control, follow it too. The
  // dark rail and the workspace chooser keep their purple.
  const datePicker = read("src", "components", "ui", "production-date-picker.tsx");
  const adminSections = read("src", "components", "settings-admin-sections.tsx");
  for (const [name, source] of [["service builder", builder], ["date picker", datePicker]] as const) {
    assert.doesNotMatch(source, /hover:text-\[var\(--action-primary-bg-hover\)\]/, `${name} hover text`);
    assert.match(source, /hover:text-\[var\(--action-secondary-accent-bg-hover\)\]/, name);
  }
  for (const [name, source] of [["settings", settings], ["settings sections", adminSections]] as const) {
    assert.doesNotMatch(source, /color-mix\(in_oklab,var\(--action-primary-bg\)_/, `${name} wash`);
    assert.match(source, /color-mix\(in_oklab,var\(--action-secondary-accent-bg\)_/, name);
  }
  assert.doesNotMatch(builder, /group-hover:text-\[var\(--action-primary-ink\)\]/);
  assert.match(builder, /group-hover:text-\[var\(--action-secondary-accent-ink\)\]/);
  assert.match(read("src", "components", "workspace-shell.tsx"), /color-mix\(in_oklab,var\(--action-primary-bg\)/);
  const test = read("src", "features", "sermon-captions", "audio-input-step.tsx");
  assert.match(test, /hover:bg-\[var\(--action-secondary-accent-bg\)\] hover:text-\[var\(--action-secondary-accent-ink\)\]/);
  assert.match(test, /TEST_ON = "bg-\[var\(--action-secondary-accent-bg\)\] text-\[var\(--action-secondary-accent-ink\)\]"/);
  assert.doesNotMatch(test, /--action-primary/);

  // The trial is on the record, with how to undo it.
  const design = read("DESIGN.md");
  assert.match(design, /Trial/);
  assert.match(design, /sky blue `#0369a1`/);
}
