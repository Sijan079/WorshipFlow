import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CreateMinistrySchema, UpdateMinistrySchema, ministryCodeFromLabel } from "./ministry-validation.ts";

function route(...segments: string[]) {
  return readFileSync(join(process.cwd(), "src", "app", "api", ...segments, "route.ts"), "utf8");
}

export function runMinistryTests() {
  // Codes are generated from the label, never typed by the user.
  assert.equal(ministryCodeFromLabel("Prayer Warriors", []), "PRAYER_WARRIORS");
  assert.equal(ministryCodeFromLabel("  Men's & Boys  ", []), "MENS_BOYS");
  assert.equal(ministryCodeFromLabel("Youth", ["YOUTH"]), "YOUTH_2");
  assert.equal(ministryCodeFromLabel("Youth", ["YOUTH", "YOUTH_2"]), "YOUTH_3");
  assert.equal(ministryCodeFromLabel("!!!", []), "MINISTRY");

  assert.equal(CreateMinistrySchema.parse({ label: "  Choir " }).label, "Choir");
  assert.equal(CreateMinistrySchema.safeParse({ label: "" }).success, false);
  assert.equal(CreateMinistrySchema.safeParse({ label: "x".repeat(61) }).success, false);

  assert.equal(UpdateMinistrySchema.safeParse({}).success, false);
  assert.equal(UpdateMinistrySchema.safeParse({ active: false }).success, true);
  assert.equal(UpdateMinistrySchema.safeParse({ leaderId: null }).success, true);
  assert.equal(UpdateMinistrySchema.safeParse({ leaderId: "not-an-id" }).success, false);

  // Ministries are archived, never deleted, so services keep their label.
  const list = route("ministries");
  const one = route("ministries", "[id]");
  assert.match(list, /requirePeopleAction\("VIEW"\)/);
  assert.match(list, /requirePeopleAction\("EDIT"\)/);
  assert.match(one, /requirePeopleAction\("EDIT"\)/);
  assert.doesNotMatch(one, /export async function DELETE/);
  for (const source of [list, one]) {
    assert.match(source, /workspaceId: context\.workspaceId/);
    assert.doesNotMatch(source, /getActiveWorkspaceId/);
  }
  // A leader must belong to the ministry they lead.
  assert.match(one, /personMinistry\.findFirst/);
}
