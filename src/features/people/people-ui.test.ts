import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { datePartsToIso, emptyPersonForm, formToPayload, isoToDateParts, personToForm, validatePersonForm } from "./person-form.ts";
import { formatBaptism, formatLongDate, formatStatusLabel, personInitials } from "./people-format.ts";
import type { PersonRecord } from "./person-types.ts";

const record: PersonRecord = {
  id: "p1",
  firstName: "Angel Evee",
  lastName: "Hipolito",
  status: "MEMBER",
  gender: "FEMALE",
  birthdate: "1952-03-04",
  baptismStatus: "BAPTIZED",
  baptismDate: "2019-03-10",
  ministries: [{ id: "m1", label: "Church Leaders" }],
  createdAt: "2026-10-26T01:00:00.000Z",
  updatedAt: "2026-10-26T02:00:00.000Z",
  createdByName: "Artsijan Yu",
  updatedByName: null,
};

export function runPeopleUiTests() {
  // Dates are typed as separate month, day, and year choices.
  assert.equal(datePartsToIso({ year: "1952", month: "3", day: "4" }), "1952-03-04");
  assert.equal(datePartsToIso({ year: "", month: "", day: "" }), null);
  assert.equal(datePartsToIso({ year: "1952", month: "3", day: "" }), "incomplete");
  assert.deepEqual(isoToDateParts("1952-03-04"), { year: "1952", month: "3", day: "4" });
  assert.deepEqual(isoToDateParts(null), { year: "", month: "", day: "" });

  // A new form starts with sensible defaults, and a record round-trips through the form.
  const blank = emptyPersonForm();
  assert.equal(blank.status, "REGULAR");
  assert.equal(blank.baptismStatus, "UNKNOWN");
  assert.deepEqual(blank.ministryIds, []);
  const form = personToForm(record);
  assert.equal(form.firstName, "Angel Evee");
  assert.deepEqual(form.ministryIds, ["m1"]);
  assert.deepEqual(formToPayload(form), {
    firstName: "Angel Evee",
    lastName: "Hipolito",
    status: "MEMBER",
    gender: "FEMALE",
    birthdate: "1952-03-04",
    baptismStatus: "BAPTIZED",
    baptismDate: "2019-03-10",
    ministryIds: ["m1"],
  });

  // Leaving Baptized clears the date in the payload.
  assert.equal(formToPayload({ ...form, baptismStatus: "NOT_BAPTIZED" }).baptismDate, null);

  // Validation returns plain, field-level messages.
  assert.deepEqual(validatePersonForm({ ...blank, firstName: "", lastName: "" }), {
    firstName: "First name is required.",
    lastName: "Last name is required.",
  });
  assert.equal(validatePersonForm({ ...blank, firstName: "Joel", lastName: "Dizon" }), null);
  assert.equal(
    validatePersonForm({ ...blank, firstName: "Joel", lastName: "Dizon", birthYear: "1952", birthMonth: "3" })?.birthdate,
    "Choose a month, day, and year.",
  );
  assert.equal(
    validatePersonForm({ ...blank, firstName: "Joel", lastName: "Dizon", birthYear: "1952", birthMonth: "2", birthDay: "30" })?.birthdate,
    "Enter a real date that is not in the future.",
  );

  // Display helpers.
  assert.equal(formatLongDate("1952-03-04"), "Mar 4, 1952");
  assert.equal(formatLongDate(null), "—");
  assert.equal(formatBaptism(record), "Baptized · Mar 10, 2019");
  assert.equal(formatBaptism({ ...record, baptismDate: null }), "Baptized");
  assert.equal(formatBaptism({ ...record, baptismStatus: "NOT_BAPTIZED", baptismDate: null }), "Not baptized");
  assert.equal(formatBaptism({ ...record, baptismStatus: "UNKNOWN", baptismDate: null }), "—");
  assert.equal(formatStatusLabel("INACTIVE"), "Inactive");
  assert.equal(personInitials("Angel Evee", "Hipolito"), "AH");

  // The screens are reachable: nav entries exist and the page gate checks PEOPLE access.
  const shell = readFileSync(join(process.cwd(), "src", "components", "workspace-shell.tsx"), "utf8");
  assert.match(shell, /href: "\/people"/);
  assert.match(shell, /href: "\/ministries"/);
  const page = readFileSync(join(process.cwd(), "src", "app", "w", "[workspaceSlug]", "[[...path]]", "page.tsx"), "utf8");
  assert.match(page, /case "people":\s*case "ministries": \{[\s\S]*?hasModuleAction\(context, "PEOPLE", "VIEW"\)[\s\S]*?notFound\(\)/);
}
