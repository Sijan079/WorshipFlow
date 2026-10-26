import assert from "node:assert/strict";
import { addTeamMember, dropdownReserve, filterTeamMembers, removeTeamMember } from "./team-member-picker.ts";

const members = [
  { id: "a", name: "Alice Santos" },
  { id: "b", name: "Benjamin Cruz" },
  { id: "c", name: "Alicia Reyes" },
];

export function runTeamMemberPickerTests() {
  assert.deepEqual(filterTeamMembers(members, "ali", ["a"]), [{ id: "c", name: "Alicia Reyes" }]);
  assert.deepEqual(addTeamMember(["a", "b"], "c"), ["a", "b", "c"]);
  assert.deepEqual(addTeamMember(["a", "b"], "a"), ["a", "b"]);
  assert.deepEqual(removeTeamMember(["a", "b", "c"], "b"), ["a", "c"]);

  // Room to reserve under the field so the open list never sits flush against a dialog footer:
  // up to five 40px rows, 8px of list padding, a 4px gap under the field, and 16px of breathing room.
  assert.equal(dropdownReserve(500, 10), 0);
  assert.equal(dropdownReserve(100, 10), 128);
  assert.equal(dropdownReserve(100, 3), 48);
  assert.equal(dropdownReserve(300, 1), 0);
  assert.equal(dropdownReserve(40, 0), 28);
  assert.equal(dropdownReserve(-20, 10), 248);
}
