import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACCENT_THEME_COOKIE, ACCENT_THEME_OPTIONS, DEFAULT_ACCENT_THEME, parseAccentTheme } from "./accent-theme.ts";

function read(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function luminance(hex: string) {
  const [r = 0, g = 0, b = 0] = (hex.match(/[0-9a-f]{2}/gi) ?? []).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function tokenValue(block: string, name: string) {
  const match = block.match(new RegExp(`${name}: (#[0-9a-f]{6});`, "i"));
  assert.ok(match, `${name} is missing`);
  return match[1];
}

// Indigo is the main color and the default. Teal is a theme each person can pick (decided 2026-11-01,
// see docs/changes/20261101.md). The theme only changes palette tokens; status colors and neutrals never move.
export function runAccentThemeTests() {
  // The cookie value is checked against an allow-list; anything else falls back to Indigo.
  assert.equal(DEFAULT_ACCENT_THEME, "indigo");
  assert.equal(ACCENT_THEME_COOKIE, "wf-accent");
  assert.equal(parseAccentTheme("teal"), "teal");
  assert.equal(parseAccentTheme("indigo"), "indigo");
  for (const bad of [undefined, null, "", "purple", "TEAL", "teal;x", 7, {}]) {
    assert.equal(parseAccentTheme(bad), "indigo", `${String(bad)} must fall back to indigo`);
  }
  assert.deepEqual(ACCENT_THEME_OPTIONS.map((option) => option.id), ["indigo", "teal"]);

  const tokens = read("tokens.css");
  const tealStart = tokens.indexOf(':root:has([data-app-theme="teal"])');
  assert.ok(tealStart > 0, "tokens.css needs the teal override block on the document root");
  const base = tokens.slice(0, tealStart);
  const teal = tokens.slice(tealStart);

  // No purple is left in the tokens. Event colors are content people choose for events, not the accent.
  const accentTokens = tokens.split("\n").filter((line) => !line.includes("--event-")).join("\n").toLowerCase();
  for (const purple of ["#7c3aed", "#8754ee", "#8b5cf6", "#a875ff", "#8f4dff", "#c4b5fd", "#f6f0ff", "#f7f1ff", "168 117 255"]) {
    assert.ok(!accentTokens.includes(purple), `${purple} must be gone from tokens.css`);
  }

  // The override block changes only palette tokens, never a semantic token or a status color.
  const overridden = [...teal.matchAll(/^\s*(--[a-z0-9-]+):/gim)].map((match) => match[1]);
  assert.ok(overridden.length > 0);
  for (const name of overridden) {
    assert.match(name, /^--palette-(workspace-accent|workspace-accent-hover|workspace-secondary|workspace-secondary-hover|workspace-secondary-soft|rail-)/, `${name} must not be themed`);
  }
  assert.doesNotMatch(teal, /palette-workspace-(success|warning|danger|live|ready|idle)/);

  const themes = {
    indigo: { block: base, accent: "#4338ca", hover: "#3730a3", secondary: "#0369a1", secondaryHover: "#075985", secondarySoft: "#e0f2fe", railPanel: "#0e1330", railElevated: "#1a2150", railAccent: "#a5b4fc", railAction: "#4f46e5", railActionHover: "#4338ca" },
    teal: { block: teal, accent: "#0f766e", hover: "#115e59", secondary: "#334155", secondaryHover: "#1e293b", secondarySoft: "#e2e8f0", railPanel: "#0a1f1a", railElevated: "#12332b", railAccent: "#5eead4", railAction: "#0f766e", railActionHover: "#115e59" },
  } as const;

  // Teal has its own slate secondary (2026-11-01); sky blue stays with Indigo.
  assert.deepEqual(ACCENT_THEME_OPTIONS.map((option) => option.swatch.secondary), ["#0369a1", "#334155"]);

  for (const [name, theme] of Object.entries(themes)) {
    assert.equal(tokenValue(theme.block, "--palette-workspace-secondary"), theme.secondary, `${name} secondary`);
    assert.equal(tokenValue(theme.block, "--palette-workspace-secondary-hover"), theme.secondaryHover, `${name} secondary hover`);
    assert.equal(tokenValue(theme.block, "--palette-workspace-secondary-soft"), theme.secondarySoft, `${name} secondary wash`);
    assert.equal(tokenValue(theme.block, "--palette-workspace-accent"), theme.accent, `${name} accent`);
    assert.equal(tokenValue(theme.block, "--palette-workspace-accent-hover"), theme.hover, `${name} hover`);
    assert.equal(tokenValue(theme.block, "--palette-rail-panel"), theme.railPanel, `${name} rail`);
    assert.equal(tokenValue(theme.block, "--palette-rail-panel-elevated"), theme.railElevated, `${name} rail active`);
    assert.equal(tokenValue(theme.block, "--palette-rail-accent"), theme.railAccent, `${name} rail accent`);
    assert.equal(tokenValue(theme.block, "--palette-rail-action"), theme.railAction, `${name} rail action`);
    assert.equal(tokenValue(theme.block, "--palette-rail-action-hover"), theme.railActionHover, `${name} rail action hover`);

    // WCAG AA (4.5:1) for every text pairing the theme introduces.
    const railText = tokenValue(theme.block, "--palette-rail-text-primary");
    const railSecondary = tokenValue(theme.block, "--palette-rail-text-secondary");
    const railMuted = tokenValue(theme.block, "--palette-rail-text-muted");
    const checks: Array<[string, string, string]> = [
      ["white on the main color", "#ffffff", theme.accent],
      ["white on the main color hover", "#ffffff", theme.hover],
      ["main color text on white", theme.accent, "#ffffff"],
      ["main color text on the faint panel", theme.accent, "#f8fafc"],
      ["secondary accent text on white", theme.secondary, "#ffffff"],
      ["secondary accent text on the faint panel", theme.secondary, "#f8fafc"],
      ["secondary accent text on an inactive control", theme.secondary, "#f1f5f9"],
      ["white on the secondary accent fill", "#ffffff", theme.secondary],
      ["white on the secondary accent hover", "#ffffff", theme.secondaryHover],
      ["primary text on a highlighted row", "#111827", theme.secondarySoft],
      ["secondary text on a highlighted row", "#475569", theme.secondarySoft],
      ["secondary accent text on a highlighted row", theme.secondary, theme.secondarySoft],
      ["rail text", railText, theme.railPanel],
      ["rail secondary text", railSecondary, theme.railPanel],
      ["rail muted text", railMuted, theme.railPanel],
      ["rail muted text on the active item", railMuted, theme.railElevated],
      ["rail accent on the rail", theme.railAccent, theme.railPanel],
      ["rail accent on the active item", theme.railAccent, theme.railElevated],
      ["white on the rail button", "#ffffff", theme.railAction],
      ["white on the rail button hover", "#ffffff", theme.railActionHover],
    ];
    for (const [label, foreground, background] of checks) {
      assert.ok(contrast(foreground, background) >= 4.5, `${name}: ${label} needs 4.5:1 (${foreground} on ${background})`);
    }
  }

  // The rail button hover no longer uses the pale rail accent behind white text.
  assert.match(tokens, /--rail-action-primary-bg-hover: var\(--palette-rail-action-hover\);/);

  // The staff-app layout reads the cookie, validates it, and renders the marker the CSS keys on.
  const layout = read("src", "app", "w", "[workspaceSlug]", "layout.tsx");
  assert.match(layout, /cookies\(\)/);
  assert.match(layout, /parseAccentTheme/);
  assert.match(layout, /data-app-theme/);
  // The root layout is untouched, so public sites and the listener captions page stay static.
  assert.doesNotMatch(read("src", "app", "layout.tsx"), /cookies\(/);

  // Settings has an Appearance section anyone can open, and picking a theme writes the cookie and updates the marker.
  const settings = read("src", "components", "settings-page-client.tsx");
  assert.match(settings, /\{ id: "appearance", label: "Appearance" \}/);
  assert.match(settings, /settings-panel-appearance/);
  const picker = read("src", "components", "appearance-section.tsx");
  assert.match(picker, /saveAccentTheme/);
  assert.match(read("src", "lib", "accent-theme.ts"), /document\.cookie[\s\S]*data-app-theme/);
  assert.match(picker, /data-app-theme/);
  assert.match(picker, /role="radiogroup"/);
}
