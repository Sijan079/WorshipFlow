import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSeriesPlan, initialOccurrences, seriesShapeFromTimes, type SeriesEvent } from "./event-series.ts";

const wednesdays: SeriesEvent = {
  repeatKind: "WEEKLY",
  repeatWeekdays: [3],
  repeatUntil: null,
  firstLocalDate: "2026-11-04",
  startLocal: "09:00",
  endLocal: "11:00",
  spanDays: 0,
  timezone: "Asia/Manila",
};

test("a new open-ended weekly series gets four months of occurrences with the right times", () => {
  const rows = initialOccurrences(wednesdays, "2026-11-04");
  assert.equal(rows.length, 18);
  assert.deepEqual(rows[0].localDate, "2026-11-04");
  assert.equal(rows[0].startsAt.toISOString(), "2026-11-04T01:00:00.000Z");
  assert.equal(rows[0].endsAt.toISOString(), "2026-11-04T03:00:00.000Z");
  assert.equal(rows.at(-1)?.localDate, "2027-03-03");
});

test("a series with an end date gets exactly its dates", () => {
  const rows = initialOccurrences({ ...wednesdays, repeatUntil: "2026-11-18" }, "2026-11-04");
  assert.deepEqual(rows.map((row) => row.localDate), ["2026-11-04", "2026-11-11", "2026-11-18"]);
});

test("a one-off event has a single occurrence, and an older event without a rule has none to generate", () => {
  const oneOff: SeriesEvent = { ...wednesdays, repeatKind: "NONE", repeatWeekdays: [] };
  assert.deepEqual(initialOccurrences(oneOff, "2026-11-04").map((row) => row.localDate), ["2026-11-04"]);
  const legacy: SeriesEvent = { ...oneOff, firstLocalDate: null, startLocal: null, endLocal: null };
  assert.deepEqual(initialOccurrences(legacy, "2026-11-04"), []);
  const plan = buildSeriesPlan(legacy, [{ id: "a", localDate: "2026-11-04", edited: false }], "2026-11-04", { reshape: true });
  assert.deepEqual(plan, { create: [], update: [], remove: [] });
});

test("moving the time updates only future occurrences that were not edited by hand", () => {
  const existing = [
    { id: "past", localDate: "2026-11-04", edited: false },
    { id: "edited", localDate: "2026-11-11", edited: true },
    { id: "next", localDate: "2026-11-18", edited: false },
  ];
  const later = { ...wednesdays, startLocal: "10:00", endLocal: "12:00", repeatUntil: "2026-11-18" };
  const plan = buildSeriesPlan(later, existing, "2026-11-12", { reshape: true });
  assert.deepEqual(plan.update.map((row) => row.id), ["next"]);
  assert.equal(plan.update[0].startsAt.toISOString(), "2026-11-18T02:00:00.000Z");
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.create, []);
});

test("shortening the end date removes only future unedited occurrences after it", () => {
  const existing = [
    { id: "a", localDate: "2026-11-18", edited: false },
    { id: "b", localDate: "2026-11-25", edited: false },
    { id: "c", localDate: "2026-12-02", edited: true },
  ];
  const plan = buildSeriesPlan({ ...wednesdays, repeatUntil: "2026-11-18" }, existing, "2026-11-12", { reshape: true });
  assert.deepEqual(plan.remove, ["b"]);
  assert.deepEqual(plan.update.map((row) => row.id), ["a"]);
});

test("extending an open-ended series only adds dates and never touches what exists", () => {
  const existing = initialOccurrences(wednesdays, "2026-11-04").map((row, index) => ({ id: `o${index}`, localDate: row.localDate, edited: index === 2 }));
  const plan = buildSeriesPlan({ ...wednesdays, startLocal: "17:00", endLocal: "18:00" }, existing, "2026-12-01", { reshape: false });
  assert.deepEqual(plan.update, [], "extending never changes times");
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.create.map((row) => row.localDate), ["2027-03-10", "2027-03-17", "2027-03-24", "2027-03-31"]);
  assert.equal(plan.create[0].startsAt.toISOString(), "2027-03-10T09:00:00.000Z", "new dates use the current times");
});

test("the local times and span are read from a first start and end in the event's time zone", () => {
  assert.deepEqual(
    seriesShapeFromTimes("2026-11-06T18:00:00+08:00", "2026-11-08T12:00:00+08:00", "Asia/Manila"),
    { firstLocalDate: "2026-11-06", startLocal: "18:00", endLocal: "12:00", spanDays: 2 },
  );
});
