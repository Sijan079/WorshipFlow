import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ServantSchema,
  SERVANT_GENDER_OPTIONS,
  SERVANT_GROUP_OPTIONS,
  formatServantDisplayName,
  formatServantGroupLabel,
  formatServantGenderLabel,
} from "./servants.ts";
import { WORKSPACE_MODULES } from "./workspace-modules.ts";

export function runServantDirectoryTests() {
  assert.equal(WORKSPACE_MODULES.includes("teams" as never), true);

  assert.deepEqual(
    SERVANT_GROUP_OPTIONS.map((option) => option.value),
    ["PASTORS", "CHURCH_LEADERS", "MENS", "LADIES", "YOUTH", "TECH", "MUSIC"],
  );
  assert.deepEqual(
    SERVANT_GROUP_OPTIONS.map((option) => option.label),
    ["Pastors", "Church Leaders", "Men's", "Ladies'", "Youth", "Tech", "Music"],
  );
  assert.deepEqual(
    SERVANT_GENDER_OPTIONS.map((option) => option.value),
    ["MALE", "FEMALE"],
  );
  assert.equal(formatServantGroupLabel("CHURCH_LEADERS"), "Church Leaders");
  assert.equal(formatServantGenderLabel("FEMALE"), "Female");
  assert.equal(formatServantDisplayName({ name: "John Cruz", gender: "MALE", group: "TECH" }), "Bro. John Cruz");
  assert.equal(formatServantDisplayName({ name: "Maria Santos", gender: "FEMALE", group: "LADIES" }), "Sis. Maria Santos");
  assert.equal(formatServantDisplayName({ name: "Joel Reyes", gender: "MALE", group: "PASTORS" }), "Ptr. Joel Reyes");
  assert.equal(formatServantDisplayName({ name: "Ptr. Joel Reyes", gender: "MALE", group: "PASTORS" }), "Ptr. Joel Reyes");
  assert.equal(formatServantDisplayName({ name: "Sis. Abby", gender: "FEMALE", group: "LADIES" }), "Sis. Abby");

  const valid = ServantSchema.safeParse({
    name: "  Sis. Abigail  ",
    gender: "FEMALE",
    group: "LADIES",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.name, "Sis. Abigail");
  }

  const invalid = ServantSchema.safeParse({
    name: " ",
    gender: "FEMALE",
    group: "LADIES",
  });
  assert.equal(invalid.success, false);

  const teamsPagePath = join(process.cwd(), "src", "app", "(workspace)", "teams", "page.tsx");
  assert.equal(existsSync(teamsPagePath), true);

  const teamsPageSource = readFileSync(teamsPagePath, "utf8");
  assert.match(teamsPageSource, /TeamsPageClient/);

  const shellSource = readFileSync(join(process.cwd(), "src", "components", "workspace-shell.tsx"), "utf8");
  assert.match(shellSource, /href: "\/teams"/);
}
