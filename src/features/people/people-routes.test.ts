import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function route(...segments: string[]) {
  return readFileSync(join(process.cwd(), "src", "app", "api", ...segments, "route.ts"), "utf8");
}

export function runPeopleRoutesTests() {
  const list = route("people");
  const one = route("people", "[id]");
  const bulk = route("people", "bulk");

  // Every handler checks the PEOPLE action itself and scopes data to the caller's workspace.
  assert.match(list, /requirePeopleAction\("VIEW"\)/);
  assert.match(list, /requirePeopleAction\("CREATE"\)/);
  assert.match(one, /requirePeopleAction\("EDIT"\)/);
  assert.match(one, /requirePeopleAction\("DELETE"\)/);
  assert.match(bulk, /requirePeopleAction\("EDIT"\)/);
  for (const source of [list, one, bulk]) {
    assert.match(source, /workspaceId: context\.workspaceId/);
    assert.doesNotMatch(source, /getActiveWorkspaceId/);
  }

  // Saves record who created and last edited a person.
  assert.match(list, /createdByUserId: context\.userId/);
  assert.match(list, /updatedByUserId: context\.userId/);
  assert.match(one, /updatedByUserId: context\.userId/);

  // Ministries chosen for a person must belong to the same workspace.
  assert.match(list, /ministry\.findMany\(\{ where: \{ id: \{ in: [^\n]*workspaceId: context\.workspaceId/);
  assert.match(one, /ministry\.findMany\(\{ where: \{ id: \{ in: [^\n]*workspaceId: context\.workspaceId/);

  // Service-only ministries (Mixed) are never something a person can belong to.
  assert.match(list, /ministry\.findMany\(\{ where: \{ id: \{ in: [^\n]*serviceOnly: false/);
  assert.match(one, /ministry\.findMany\(\{ where: \{ id: \{ in: [^\n]*serviceOnly: false/);
  assert.match(bulk, /ministry\.findFirst\(\{ where: \{ id: ministryId[^\n]*serviceOnly: false/);
}
