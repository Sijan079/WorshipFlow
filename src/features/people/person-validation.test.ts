import assert from "node:assert/strict";
import {
  CreatePersonSchema,
  UpdatePersonSchema,
  comparePeople,
  formatPersonName,
  resolveBaptism,
} from "./person-validation.ts";

const ministryId = "11111111-1111-4111-8111-111111111111";

export function runPersonValidationTests() {
  // Both names are required and trimmed, so people with the same first name stay distinguishable.
  const created = CreatePersonSchema.parse({ firstName: "  Angel Evee ", lastName: " Hipolito " });
  assert.equal(created.firstName, "Angel Evee");
  assert.equal(created.lastName, "Hipolito");
  assert.equal(created.status, "REGULAR");
  assert.equal(created.baptismStatus, "UNKNOWN");
  assert.deepEqual(created.ministryIds, []);
  assert.equal(CreatePersonSchema.safeParse({ firstName: "Angel" }).success, false);
  assert.equal(CreatePersonSchema.safeParse({ firstName: "  ", lastName: "Hipolito" }).success, false);
  assert.equal(CreatePersonSchema.safeParse({ firstName: "A", lastName: "B", status: "DELETED" }).success, false);

  // A baptism date needs a Baptized status (matches the database check constraint).
  assert.equal(CreatePersonSchema.safeParse({ firstName: "A", lastName: "B", baptismStatus: "BAPTIZED", baptismDate: "2019-03-10" }).success, true);
  assert.equal(CreatePersonSchema.safeParse({ firstName: "A", lastName: "B", baptismStatus: "BAPTIZED" }).success, true);
  assert.equal(CreatePersonSchema.safeParse({ firstName: "A", lastName: "B", baptismStatus: "UNKNOWN", baptismDate: "2019-03-10" }).success, false);
  assert.equal(CreatePersonSchema.safeParse({ firstName: "A", lastName: "B", baptismStatus: "NOT_BAPTIZED", baptismDate: "2019-03-10" }).success, false);

  // Dates must be real, plausible, and not in the future.
  assert.equal(CreatePersonSchema.safeParse({ firstName: "A", lastName: "B", birthdate: "1952-03-04" }).success, true);
  assert.equal(CreatePersonSchema.safeParse({ firstName: "A", lastName: "B", birthdate: "1952-02-30" }).success, false);
  assert.equal(CreatePersonSchema.safeParse({ firstName: "A", lastName: "B", birthdate: "1800-01-01" }).success, false);
  assert.equal(CreatePersonSchema.safeParse({ firstName: "A", lastName: "B", birthdate: "2999-01-01" }).success, false);
  assert.equal(CreatePersonSchema.safeParse({ firstName: "A", lastName: "B", birthdate: null }).success, true);

  // Ministries are ids, capped, and deduplicated.
  assert.equal(CreatePersonSchema.safeParse({ firstName: "A", lastName: "B", ministryIds: ["not-an-id"] }).success, false);
  assert.deepEqual(CreatePersonSchema.parse({ firstName: "A", lastName: "B", ministryIds: [ministryId, ministryId] }).ministryIds, [ministryId]);

  // Updates are partial but never empty.
  assert.equal(UpdatePersonSchema.safeParse({}).success, false);
  assert.equal(UpdatePersonSchema.safeParse({ status: "ARCHIVED" }).success, true);
  assert.equal(UpdatePersonSchema.safeParse({ lastName: "" }).success, false);

  // Baptism rule when a change arrives, given the person's current status.
  assert.deepEqual(resolveBaptism("UNKNOWN", { baptismStatus: "BAPTIZED", baptismDate: "2019-03-10" }), { ok: true, baptismStatus: "BAPTIZED", baptismDate: "2019-03-10" });
  assert.deepEqual(resolveBaptism("BAPTIZED", { baptismStatus: "NOT_BAPTIZED" }), { ok: true, baptismStatus: "NOT_BAPTIZED", baptismDate: null });
  assert.deepEqual(resolveBaptism("BAPTIZED", { baptismDate: "2020-01-05" }), { ok: true, baptismStatus: "BAPTIZED", baptismDate: "2020-01-05" });
  assert.equal(resolveBaptism("UNKNOWN", { baptismDate: "2020-01-05" }).ok, false);
  assert.deepEqual(resolveBaptism("BAPTIZED", {}), { ok: true, baptismStatus: "BAPTIZED", baptismDate: undefined });

  // Display and sort order: "First Last", sorted by last name then first name.
  assert.equal(formatPersonName("Angel Evee", "Hipolito"), "Angel Evee Hipolito");
  const sorted = [
    { firstName: "Zed", lastName: "Reyes" },
    { firstName: "Ana", lastName: "reyes" },
    { firstName: "Joel", lastName: "Dizon" },
  ].sort(comparePeople);
  assert.deepEqual(sorted.map((person) => person.firstName), ["Joel", "Ana", "Zed"]);
}
