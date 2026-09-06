import assert from "node:assert/strict";
import { getServiceBlockDisplayValues, selectCurrentService, selectServiceForUpcomingSunday } from "./service-display.ts";

export function runServiceDisplayTests() {
  const services = [
    { id: "past", serviceDate: "2026-07-01T09:00:00.000Z" },
    { id: "later", serviceDate: "2026-08-10T09:00:00.000Z" },
    { id: "next", serviceDate: "2026-08-05T09:00:00.000Z" },
  ];

  assert.equal(selectCurrentService(services, Date.parse("2026-08-04T00:00:00.000Z"))?.id, "next");
  assert.equal(selectCurrentService(services, Date.parse("2026-09-01T00:00:00.000Z"))?.id, "later");
  assert.equal(selectCurrentService([], Date.now()), undefined);

  const sundayService = { id: "sunday", serviceDate: "2026-08-09T09:00:00.000Z" };
  const laterService = { id: "later-sunday", serviceDate: "2026-08-16T09:00:00.000Z" };
  assert.equal(
    selectServiceForUpcomingSunday([sundayService, laterService], new Date("2026-08-06T09:00:00.000Z"))?.id,
    "sunday",
  );
  assert.equal(
    selectServiceForUpcomingSunday([sundayService, laterService], new Date("2026-08-09T09:00:00.000Z"))?.id,
    "sunday",
  );
  assert.equal(selectServiceForUpcomingSunday([laterService], new Date("2026-08-06T09:00:00.000Z")), undefined);

  assert.deepEqual(getServiceBlockDisplayValues({
    songs: [{ song: { title: "Dakila Ka" } }],
    people: [{ personName: "Ate Ana" }],
    details: [{ value: "Psalm 100" }],
    fieldValues: { lyrics: "Sing joyfully", notes: ["Verse 1", "Verse 2"], personIds: ["private-id"] },
  }), ["Dakila Ka", "Ate Ana", "Psalm 100", "Sing joyfully", "Verse 1", "Verse 2"]);
  assert.deepEqual(getServiceBlockDisplayValues({ fieldValues: { personId: "private-id", nested: { text: "hidden" } } }), []);
}
