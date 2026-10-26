import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { countRawHexColors, countSmallTextClasses } from "./design-rules.ts";

type Baseline = { smallText: Record<string, number>; rawColor: Record<string, number> };

function componentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return componentFiles(path);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx") ? [path] : [];
  });
}

function checkAgainstBaseline(rule: string, current: Record<string, number>, baseline: Record<string, number>) {
  const failures: string[] = [];
  for (const [file, count] of Object.entries(current)) {
    const allowed = baseline[file] ?? 0;
    if (count > allowed) failures.push(`${file}: ${count} ${rule} (baseline ${allowed})`);
  }
  assert.deepEqual(failures, [], `New design-rule violations. Fix them, or see DESIGN.md before updating the baseline.`);
}

export function runDesignRuleTests() {
  assert.equal(countSmallTextClasses('<p className="text-[10px] text-[11px] text-[12px] text-sm">'), 2);
  assert.equal(countSmallTextClasses('<p className="text-[0.6rem] text-[0.75rem]">'), 1);
  assert.equal(countSmallTextClasses('<p className="text-xs">'), 0);
  assert.equal(countRawHexColors('<div className="bg-[#fff] text-[#9f84c7]" style={{ color: "#CFE8F6" }}>'), 3);
  assert.equal(countRawHexColors('<a href="#workspace-content" className="bg-[var(--surface-panel)]">'), 0);

  const baselinePath = join(process.cwd(), "src", "lib", "design-rules-baseline.json");
  assert.equal(existsSync(baselinePath), true, "Run npm run design:baseline to create the baseline");
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline;

  const smallText: Record<string, number> = {};
  const rawColor: Record<string, number> = {};
  for (const path of componentFiles(join(process.cwd(), "src"))) {
    const source = readFileSync(path, "utf8");
    const name = relative(process.cwd(), path).split(sep).join("/");
    const small = countSmallTextClasses(source);
    const raw = countRawHexColors(source);
    if (small > 0) smallText[name] = small;
    if (raw > 0) rawColor[name] = raw;
  }
  checkAgainstBaseline("text sizes under 12px", smallText, baseline.smallText);
  checkAgainstBaseline("raw hex colors", rawColor, baseline.rawColor);

  const legacy = (record: Record<string, number>) => Object.values(record).reduce((sum, count) => sum + count, 0);
  console.warn(
    `design rules: ${legacy(smallText)} legacy text sizes under 12px and ${legacy(rawColor)} legacy raw hex colors remain (see DESIGN.md Target rules)`,
  );
}
