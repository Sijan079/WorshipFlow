import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (name: string) => readFileSync(join(process.cwd(), "src", "components", name), "utf8");

test("create service actions remain accessible as compact phone buttons", () => {
  const modal = source("services-page-client.tsx");
  assert.match(modal, /aria-label="Parse text"/);
  assert.match(modal, /aria-label="Create service"/);
  assert.match(modal, /<span className="hidden sm:inline">Parse text<\/span>/);
  assert.match(modal, /<span className="hidden sm:inline">Create Service<\/span>/);
});

test("all app choice fields use the shared toggling select", () => {
  for (const name of ["settings-page-client.tsx", "settings-admin-sections.tsx", "service-builder-client.tsx", "workspace-shell.tsx"]) {
    assert.doesNotMatch(source(name), /<select\b/, name);
  }
  const select = source("ui/select.tsx");
  assert.match(select, /openContext\.setOpen\(false\)/);
  assert.match(select, /event\.pointerType !== "mouse"/);
  assert.match(select, /!wasMouseClick && openContext\.open/);
});

test("song tags do not require horizontal scrolling on a phone", () => {
  const tags = source("settings-page-client.tsx").split("function SongTagsSection")[1]?.split("function ProgramBlockTypesSection")[0] ?? "";
  assert.doesNotMatch(tags, /min-w-\[38rem\]/);
  assert.match(tags, /grid-cols-\[2rem_minmax\(0,1fr\)_3rem_2\.75rem\]/);
});

test("checklist item editor fits the phone viewport", () => {
  const checklist = source("settings-page-client.tsx").split("function ChecklistSection")[1]?.split("function ServiceTemplateSection")[0] ?? "";
  assert.doesNotMatch(checklist, /min-w-\[34rem\]|minmax\(12rem,1fr\)/);
});

test("compact service rows keep actions beside the date and status under template", () => {
  const services = source("services-page-client.tsx");
  assert.match(services, /grid-cols-\[36px_minmax\(0,1fr\)_88px\]/);
  assert.match(services, /services-row-actions col-start-3 row-start-1/);
  assert.match(services, /flex flex-col items-start gap-1[^\"]*min-\[1200px\]:hidden/);
});
