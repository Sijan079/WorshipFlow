import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

function exists(...segments: string[]) {
  return existsSync(join(process.cwd(), ...segments));
}

export function runTeamsRetiredTests() {
  // The Teams roster is replaced by People and Ministries.
  for (const gone of [
    ["src", "components", "teams-page-client.tsx"],
    ["src", "app", "api", "servants", "route.ts"],
    ["src", "app", "api", "servants", "[id]", "route.ts"],
    ["src", "app", "api", "settings", "ministries", "route.ts"],
    ["src", "app", "api", "settings", "ministries", "[id]", "route.ts"],
    ["src", "app", "api", "settings", "servant-groups", "route.ts"],
    ["src", "app", "api", "settings", "servant-groups", "[id]", "route.ts"],
    ["src", "lib", "servants.ts"],
  ]) {
    assert.equal(exists(...gone), false, `${gone.join("/")} should be removed`);
  }

  // Old bookmarks to Teams land on People. The nav and Settings no longer offer Teams,
  // Servant Groups, or the old Ministries presets.
  const page = read("src", "app", "w", "[workspaceSlug]", "[[...path]]", "page.tsx");
  assert.match(page, /case "teams":\s*redirect\(`\/w\/\$\{encodeURIComponent\(workspaceSlug\)\}\/people`\)/);
  assert.doesNotMatch(page, /TeamsPageClient/);
  assert.doesNotMatch(read("src", "components", "workspace-shell.tsx"), /href: "\/teams"/);
  const settings = read("src", "components", "settings-page-client.tsx");
  assert.doesNotMatch(settings, /servant-groups|api\/settings\/ministries/);

  // The old servant tables and the preset seeding are gone from the schema and the code. Gender
  // stays because People uses it. The drop of the old tables waits in prisma/deploy-queue.
  const schema = read("prisma", "schema.prisma");
  assert.doesNotMatch(schema, /^model Servant \{/m);
  assert.doesNotMatch(schema, /^model ServantGroupPreset \{/m);
  assert.doesNotMatch(schema, /^enum ServantGroup \{/m);
  assert.match(schema, /^enum ServantGender \{/m);
  const seeding = read("src", "lib", "settings-server.ts");
  assert.doesNotMatch(seeding, /seedServantGroupPresets|seedMinistryPresets|servantGroupPreset/);
  assert.doesNotMatch(read("src", "app", "api", "workspaces", "route.ts"), /seedServantGroupPresets|seedMinistryPresets/);
}
