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
  // The calendar is portaled and mounts a render after it opens, so the wheel and touch guard
  // must attach through a callback ref (an effect would look for the element too early).
  // The guard now lives in one shared hook that both the date picker and the time picker use.
  const guard = read("src", "components", "ui", "use-popover-scroll-guard.ts");
  assert.match(guard, /return useCallback\(\(node: HTMLDivElement \| null\) =>/);
  assert.match(guard, /addEventListener\("wheel"/);
  assert.match(guard, /addEventListener\("touchmove"/);
  const timePicker = read("src", "components", "ui", "production-time-picker.tsx");
  for (const source of [picker, timePicker]) {
    assert.match(source, /const scrollGuardRef = usePopoverScrollGuard\(\)/);
    assert.match(source, /ref=\{scrollGuardRef\}/);
  }
  assert.doesNotMatch(picker, /contentRef/);
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
  // The dropdown shows five people, then scrolls: five 40px rows plus 8px of padding is 13rem.
  assert.match(picker2, /max-h-52/);
  assert.match(picker2, /flex h-10 w-full items-center/);
  assert.doesNotMatch(picker2, /max-h-48/);
  // Near a dialog footer the field reserves room (measured, then scrolled into view with a margin),
  // and the list uses a lighter shadow than a dialog or menu.
  assert.match(picker2, /dropdownReserve\(/);
  assert.match(picker2, /useLayoutEffect/);
  assert.match(picker2, /scroll-mb-4/);
  assert.match(picker2, /aria-hidden="true" style=\{\{ height: reserve \}\}/);
  assert.match(picker2, /shadow-\[var\(--elevation-raised\)\]/);
  assert.doesNotMatch(picker2, /elevation-modal/);
  assert.doesNotMatch(services, /Manage people|peopleHref/);
  assert.doesNotMatch(read("src", "components", "service-builder-client.tsx"), /Manage people/);
  const globals = read("src", "app", "globals.css");
  const rule = globals.slice(globals.indexOf(".ui-raised-field {"), globals.indexOf("}", globals.indexOf(".ui-raised-field {")));
  assert.match(rule, /box-shadow: var\(--elevation-subtle\)/);
  assert.doesNotMatch(rule, /inset/);

  // A dropdown is exactly as wide as the field that opens it. The list inside used to be forced to
  // the field's full width while the box around it added padding and a border, so it ended up a few
  // pixels wider. Now the box carries the minimum width and the list inside only fills it.
  const select = read("src", "components", "ui", "select.tsx");
  assert.match(select, /data-\[position=popper\]:min-w-\(--radix-select-trigger-width\)/);
  const viewerStart = select.indexOf("<SelectPrimitive.Viewport");
  const viewport = select.slice(viewerStart, select.indexOf(">", select.indexOf("className", viewerStart)));
  assert.doesNotMatch(viewport, /min-w-\(--radix-select-trigger-width\)/);
  assert.match(viewport, /data-\[position=popper\]:min-w-0/);

  // The dropdown opens and closes smoothly: a short fade and small slide from where it opens, in
  // the standard motion tokens. Reduced motion is handled globally.
  assert.match(read("src", "components", "ui", "production-select.tsx"), /ui-select-content/);
  assert.match(globals, /@keyframes ui-pop-in \{[\s\S]*?opacity: 0[\s\S]*?opacity: 1/);
  assert.match(globals, /@keyframes ui-pop-out/);
  assert.match(globals, /\.ui-select-content\[data-state="open"\] \{\s*animation: ui-pop-in var\(--dur-fast\) var\(--ease-out\)/);
  assert.match(globals, /\.ui-select-content\[data-state="closed"\] \{\s*animation: ui-pop-out var\(--dur-fast\) var\(--ease-out\)/);
}
