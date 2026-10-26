import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { datePartsToIso, emptyPersonForm, formToPayload, isoToDateParts, personToForm, validatePersonForm } from "./person-form.ts";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "./field-styles.ts";
import { formatPersonDisplayName, formatBaptism, formatLongDate, formatStatusLabel, personInitials } from "./people-format.ts";
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

  // Text fields match the Services text boxes: a plain rounded border on a transparent field,
  // never sunken (every input gets a global inset shadow, so it must be switched off), and the
  // border turns purple when the field is selected, with no outline ring.
  // The look lives in one `globals.css` rule, because every input gets global grey-fill and
  // inset-shadow styles that Tailwind utilities cannot override.
  assert.match(TEXT_FIELD_CLASS, /\bui-text-field\b/);
  const globals = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const rule = globals.slice(globals.indexOf(".ui-text-field {"), globals.indexOf("}", globals.indexOf(".ui-text-field {")));
  assert.match(rule, /background-color: transparent/);
  assert.match(rule, /box-shadow: none/);
  assert.match(rule, /border: 1px solid var\(--border-default\)/);
  const focusRule = globals.slice(globals.indexOf(".ui-text-field:focus-visible {"), globals.indexOf("}", globals.indexOf(".ui-text-field:focus-visible {")));
  assert.match(focusRule, /border-color: var\(--border-focus\)/);
  assert.match(focusRule, /outline: none/);
  assert.doesNotMatch(FIELD_LABEL_CLASS, /font-(medium|semibold|bold)/);
  const personDialog = readFileSync(join(process.cwd(), "src", "features", "people", "person-dialog.tsx"), "utf8");
  const ministriesDialogPage = readFileSync(join(process.cwd(), "src", "features", "ministries", "ministries-page-client.tsx"), "utf8");
  for (const source of [personDialog, ministriesDialogPage]) {
    assert.match(source, /TEXT_FIELD_CLASS/);
    assert.match(source, /FIELD_LABEL_CLASS/);
    assert.doesNotMatch(source, /ui-field ui-field-inactive/);
  }

  // The People page carries no privacy blurb under its heading.
  const peoplePageSource = readFileSync(join(process.cwd(), "src", "features", "people", "people-page-client.tsx"), "utf8");
  assert.doesNotMatch(peoplePageSource, /Birthdays and baptism details/);

  // Names in service pickers keep the church's convention: Ptr. for pastors, else Bro. or Sis.
  assert.equal(formatPersonDisplayName({ firstName: "John", lastName: "Cruz", gender: "MALE", ministryCodes: ["TECH"] }), "Bro. John Cruz");
  assert.equal(formatPersonDisplayName({ firstName: "Maria", lastName: "Santos", gender: "FEMALE", ministryCodes: [] }), "Sis. Maria Santos");
  assert.equal(formatPersonDisplayName({ firstName: "Joel", lastName: "Reyes", gender: "MALE", ministryCodes: ["PASTORS", "CHURCH_LEADERS"] }), "Ptr. Joel Reyes");
  assert.equal(formatPersonDisplayName({ firstName: "Ramon", lastName: "Cruz", gender: null, ministryCodes: [] }), "Ramon Cruz");

  // Pickers read names only, through an endpoint any workspace member can use (no birthdates,
  // baptism, or other directory details), scoped to the caller's workspace.
  const names = readFileSync(join(process.cwd(), "src", "app", "api", "people", "names", "route.ts"), "utf8");
  assert.match(names, /requireExplicitWorkspaceRole\("MEMBER"\)/);
  assert.match(names, /workspaceId: context\.workspaceId/);
  assert.match(names, /status: \{ notIn: \["ARCHIVED", "INACTIVE"\] \}/);
  assert.doesNotMatch(names, /birthdate|baptism/);

  // The service screens read People, not the old servant roster, and the dead fixed-role form
  // and its "add to roster" prompt are gone.
  const servicesPage = readFileSync(join(process.cwd(), "src", "components", "services-page-client.tsx"), "utf8");
  const serviceBuilder = readFileSync(join(process.cwd(), "src", "components", "service-builder-client.tsx"), "utf8");
  for (const source of [servicesPage, serviceBuilder]) {
    assert.doesNotMatch(source, /\/api\/servants/);
    assert.doesNotMatch(source, /formatServantDisplayName/);
  }
  assert.match(servicesPage, /fetchPeopleNames/);
  assert.match(serviceBuilder, /fetchPeopleNames/);
  assert.doesNotMatch(servicesPage, /function ServiceFormFields|collectUnlistedServantNames|Unlisted servants found|createMissingServantsMutation/);

  // The Status menu stands on its own: no explanatory line is shown under it.
  const dialog = readFileSync(join(process.cwd(), "src", "features", "people", "person-dialog.tsx"), "utf8");
  assert.doesNotMatch(dialog, /STATUS_DESCRIPTIONS/);
  assert.doesNotMatch(dialog, /formally joined/);

  // People and Ministries screens leave service-only ministries (Mixed) out.
  const peoplePage = readFileSync(join(process.cwd(), "src", "features", "people", "people-page-client.tsx"), "utf8");
  const ministriesPage = readFileSync(join(process.cwd(), "src", "features", "ministries", "ministries-page-client.tsx"), "utf8");
  assert.match(peoplePage, /!ministry\.serviceOnly/);
  assert.match(ministriesPage, /!ministry\.serviceOnly/);

  // The screens are reachable: nav entries exist and the page gate checks PEOPLE access.
  const shell = readFileSync(join(process.cwd(), "src", "components", "workspace-shell.tsx"), "utf8");
  assert.match(shell, /href: "\/people"/);
  assert.match(shell, /href: "\/ministries"/);
  const page = readFileSync(join(process.cwd(), "src", "app", "w", "[workspaceSlug]", "[[...path]]", "page.tsx"), "utf8");
  assert.match(page, /case "people":\s*case "ministries": \{[\s\S]*?hasModuleAction\(context, "PEOPLE", "VIEW"\)[\s\S]*?notFound\(\)/);
}
