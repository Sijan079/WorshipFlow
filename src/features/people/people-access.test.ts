import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canPerformPeopleAction, type PeopleGrants } from "./people-access-rules.ts";

const none: PeopleGrants = { VIEW: false, CREATE: false, EDIT: false };
const all: PeopleGrants = { VIEW: true, CREATE: true, EDIT: true };

export function runPeopleAccessTests() {
  // Owner and Admin can do everything, including hard delete.
  for (const role of ["OWNER", "ADMIN"]) {
    for (const action of ["VIEW", "CREATE", "EDIT", "DELETE"] as const) {
      assert.equal(canPerformPeopleAction(role, action, none), true, `${role} ${action}`);
    }
  }

  // A Member with no grant is refused everything.
  for (const action of ["VIEW", "CREATE", "EDIT", "DELETE"] as const) {
    assert.equal(canPerformPeopleAction("MEMBER", action, none), false, `member without grant ${action}`);
  }

  // A Member with only View can read but not change anything.
  const viewOnly: PeopleGrants = { VIEW: true, CREATE: false, EDIT: false };
  assert.equal(canPerformPeopleAction("MEMBER", "VIEW", viewOnly), true);
  assert.equal(canPerformPeopleAction("MEMBER", "CREATE", viewOnly), false);
  assert.equal(canPerformPeopleAction("MEMBER", "EDIT", viewOnly), false);

  // Create and Edit also need View: nobody edits a directory they cannot read.
  const editWithoutView: PeopleGrants = { VIEW: false, CREATE: true, EDIT: true };
  assert.equal(canPerformPeopleAction("MEMBER", "CREATE", editWithoutView), false);
  assert.equal(canPerformPeopleAction("MEMBER", "EDIT", editWithoutView), false);
  assert.equal(canPerformPeopleAction("MEMBER", "EDIT", all), true);

  // Hard delete is never granted to a Member, even with every other grant.
  assert.equal(canPerformPeopleAction("MEMBER", "DELETE", all), false);

  // Unknown roles get nothing.
  assert.equal(canPerformPeopleAction("VIEWER", "VIEW", all), false);

  // The Membership screen renders every configurable module, so PEOPLE appears
  // there with no separate wiring.
  const membershipUi = readFileSync(join(process.cwd(), "src", "components", "member-permissions.tsx"), "utf8");
  assert.match(membershipUi, /CONFIGURABLE_MODULE_ACTIONS\.map/);
}
