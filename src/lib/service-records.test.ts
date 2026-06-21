import assert from "node:assert/strict";
import {
  buildBibleGatewayUrl,
  formatOfferingPeople,
  getDefaultNextServiceSunday,
  inferAssignedMinistryFromName,
  mapTemplateTypeToServiceVariant,
  parseOfferingPeople,
  sortServicesBySoonest,
} from "./service-records.ts";

export function runServiceRecordTests() {
  assert.equal(
    getDefaultNextServiceSunday(new Date("2026-06-19T12:00:00.000Z")).toISOString(),
    "2026-06-28T00:00:00.000Z"
  );

  assert.equal(
    getDefaultNextServiceSunday(new Date("2026-06-21T12:00:00.000Z")).toISOString(),
    "2026-06-28T00:00:00.000Z"
  );

  assert.equal(
    buildBibleGatewayUrl("John 3:16"),
    "https://www.biblegateway.com/passage/?search=John%203%3A16&version=MBBTAG"
  );

  assert.equal(mapTemplateTypeToServiceVariant("REGULAR"), "STANDARD");
  assert.equal(mapTemplateTypeToServiceVariant("FIRST_SUNDAY"), "EXTENDED");
  assert.equal(inferAssignedMinistryFromName("Young People"), "YOUTH");
  assert.equal(inferAssignedMinistryFromName("Ladies Ministry"), "LADIES");
  assert.equal(inferAssignedMinistryFromName("Mixed"), "MIXED");
  assert.equal(formatOfferingPeople(["Sis. Samantha", "Sis. Sandra Marie"]), "Sis. Samantha & Sis. Sandra Marie");
  assert.deepEqual(parseOfferingPeople("Sis. Samantha & Sis. Sandra Marie"), ["Sis. Samantha", "Sis. Sandra Marie"]);

  const sorted = sortServicesBySoonest([
    { id: "b", serviceDate: "2026-06-29T09:00:00.000Z" },
    { id: "a", serviceDate: "2026-06-22T09:00:00.000Z" },
    { id: "c", serviceDate: "2026-07-06T09:00:00.000Z" },
  ]);

  assert.deepEqual(
    sorted.map((service) => service.id),
    ["a", "b", "c"]
  );
}
