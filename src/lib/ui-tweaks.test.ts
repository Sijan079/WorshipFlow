import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MINISTRIES } from "./ministries.ts";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

export function runUiTweaksTests() {
  const services = read("src", "components", "services-page-client.tsx");
  const peoplePage = read("src", "features", "people", "people-page-client.tsx");
  const ministriesPage = read("src", "features", "ministries", "ministries-page-client.tsx");

  // 1. A refresh button that spins must use the clockwise icon, or it appears to run backwards.
  for (const source of [services, peoplePage, ministriesPage]) {
    assert.match(source, /RefreshCw\b/);
    assert.doesNotMatch(source, /RefreshCcw/);
    assert.match(source, /<RefreshCw className=\{[^}]*animate-spin/);
  }

  // 2. Mixed is simply "Mixed".
  assert.equal(DEFAULT_MINISTRIES.find((ministry) => ministry.code === "MIXED")?.label, "Mixed");
  const migrations = join(process.cwd(), "prisma", "migrations-current");
  const restored = readdirSync(migrations).find((name) => name.endsWith("_mixed_label_restored"));
  assert.ok(restored, "Expected a *_mixed_label_restored migration");
  assert.match(read("prisma", "migrations-current", restored, "migration.sql"), /SET "label" = 'Mixed' WHERE "code" = 'MIXED'/);

  // 3. The People calendar (month and year menus) is the default everywhere, and it never gets
  // cut off: its height follows the space the browser has available, and it scrolls if needed.
  const picker = read("src", "components", "ui", "production-date-picker.tsx");
  assert.match(picker, /jumpToMonthAndYear = true/);
  assert.match(picker, /max-h-\[var\(--radix-popover-content-available-height\)\]/);
  assert.match(picker, /overflow-y-auto/);
  assert.match(picker, /collisionPadding/);
  assert.match(read("src", "features", "people", "person-dialog.tsx"), /minYear=\{1900\}/);
  for (const source of [services, read("src", "features", "people", "person-dialog.tsx")]) {
    assert.doesNotMatch(source, /jumpToMonthAndYear=\{false\}/);
  }

  // 4 and 5. A person field in Services is a raised search box with a search icon, the hint
  // "Name", and a dropdown arrow at the end. There is no "Team members / Manage people" line.
  const start = services.indexOf("function TeamMemberPicker");
  const picker2 = services.slice(start, services.indexOf("\nfunction ", start + 10) === -1 ? undefined : services.indexOf("\nfunction ", start + 10));
  assert.match(picker2, /placeholder="Name"/);
  assert.match(picker2, /<Search /);
  assert.match(picker2, /<ChevronDown /);
  assert.match(picker2, /ui-raised-field/);
  assert.doesNotMatch(services, /Manage people|peopleHref/);
  assert.doesNotMatch(read("src", "components", "service-builder-client.tsx"), /Manage people/);
  const globals = read("src", "app", "globals.css");
  const rule = globals.slice(globals.indexOf(".ui-raised-field {"), globals.indexOf("}", globals.indexOf(".ui-raised-field {")));
  assert.match(rule, /box-shadow: var\(--elevation-subtle\)/);
  assert.doesNotMatch(rule, /inset/);
}
