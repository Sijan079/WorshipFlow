import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MINISTRIES, ministryCodeFromLegacy } from "./ministries.ts";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

export function runServicePeopleMinistryTests() {
  const root = process.cwd();
  const createRoute = read("src", "app", "api", "services", "route.ts");
  const updateRoute = read("src", "app", "api", "services", "[id]", "route.ts");
  const valuesRoute = read("src", "app", "api", "services", "[id]", "blocks", "[blockId]", "values", "route.ts");

  // A person chosen on a service must be someone in People for this workspace, not an old servant.
  assert.match(createRoute, /prisma\.person\.count\(\{ where: \{ workspaceId, id: \{ in: selectedPersonIds \} \} \}\)/);
  assert.match(valuesRoute, /prisma\.person\.count\(\{ where: \{ workspaceId, id: \{ in: personIds \} \} \}\)/);
  for (const source of [createRoute, updateRoute, valuesRoute]) {
    assert.doesNotMatch(source, /prisma\.servant|tx\.servant/);
  }

  // A service's ministry resolves against the Ministry list (the old "Leaders" code is Church
  // Leaders) and is recorded on the service.
  for (const source of [createRoute, updateRoute]) {
    assert.doesNotMatch(source, /ministryPreset\.findFirst/);
    assert.match(source, /ministry\.findFirst/);
    assert.match(source, /ministryCodeFromLegacy/);
    assert.match(source, /ministryId:/);
  }

  // Any member who builds services can read the ministry choices; it lists active ministries
  // for their own workspace, including service-only ones such as Mixed.
  const options = read("src", "app", "api", "ministries", "options", "route.ts");
  assert.match(options, /requireExplicitWorkspaceRole\("MEMBER"\)/);
  assert.match(options, /workspaceId: context\.workspaceId, active: true/);
  assert.match(options, /select: \{ id: true, code: true, label: true, serviceOnly: true \}/);

  // The Services page builds its ministry choice from the Ministry list.
  const page = read("src", "components", "services-page-client.tsx");
  assert.match(page, /fetchMinistryOptions/);
  assert.match(page, /ministryCodeFromLegacy/);
  assert.doesNotMatch(page, /\/api\/settings\/ministries/);

  // Mixed reads clearly where it is offered, and existing services keep their old codes working.
  assert.equal(DEFAULT_MINISTRIES.find((ministry) => ministry.code === "MIXED")?.label, "Mixed team (5th Sunday)");
  assert.equal(ministryCodeFromLegacy("LEADERS"), "CHURCH_LEADERS");
  const migrations = join(root, "prisma", "migrations-current");
  const folder = readdirSync(migrations).find((name) => name.endsWith("_mixed_team_label"));
  assert.ok(folder, "Expected a *_mixed_team_label migration");
  assert.match(read("prisma", "migrations-current", folder, "migration.sql"), /SET "label" = 'Mixed team \(5th Sunday\)'/);
  assert.equal(existsSync(join(migrations, folder, "migration.sql")), true);
}
