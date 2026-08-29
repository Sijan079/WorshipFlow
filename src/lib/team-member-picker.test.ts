import assert from "node:assert/strict";
import { addTeamMember, filterTeamMembers, removeTeamMember } from "./team-member-picker.ts";

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
}
