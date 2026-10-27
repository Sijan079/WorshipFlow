import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  eventSpanDays,
  localTimeInZone,
  occurrenceTimes,
  openEndedHorizon,
  planSeriesChange,
  seriesDates,
  zonedLocalToUtc,
} from "./recurrence.ts";

const manila = "Asia/Manila";

test("a weekly series on chosen weekdays lists exactly those dates inside the window", () => {
  // 2026-11-01 is a Sunday. Sundays and Wednesdays for three weeks.
  const dates = seriesDates({ kind: "WEEKLY", weekdays: [0, 3], firstLocalDate: "2026-11-01", until: "2026-11-18" }, { from: "2026-11-01", to: "2026-12-31" });
  assert.deepEqual(dates, ["2026-11-01", "2026-11-04", "2026-11-08", "2026-11-11", "2026-11-15", "2026-11-18"]);
});

test("a weekly series never lists a date before its first date, even on a chosen weekday", () => {
  // The first date is a Wednesday, so the Sunday before it is not part of the series.
  const dates = seriesDates({ kind: "WEEKLY", weekdays: [0, 3], firstLocalDate: "2026-11-04", until: "2026-11-15" }, { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(dates, ["2026-11-04", "2026-11-08", "2026-11-11", "2026-11-15"]);
});

test("a daily series lists every date, and a one-off lists only its first date", () => {
  assert.deepEqual(seriesDates({ kind: "DAILY", weekdays: [], firstLocalDate: "2026-11-01", until: "2026-11-03" }, { from: "2026-11-01", to: "2026-11-30" }), ["2026-11-01", "2026-11-02", "2026-11-03"]);
  assert.deepEqual(seriesDates({ kind: "NONE", weekdays: [], firstLocalDate: "2026-11-05", until: null }, { from: "2026-11-01", to: "2026-11-30" }), ["2026-11-05"]);
  assert.deepEqual(seriesDates({ kind: "NONE", weekdays: [], firstLocalDate: "2026-12-05", until: null }, { from: "2026-11-01", to: "2026-11-30" }), []);
});

test("the window limits what is listed and weekly rules need at least one weekday", () => {
  assert.deepEqual(seriesDates({ kind: "DAILY", weekdays: [], firstLocalDate: "2026-11-01", until: null }, { from: "2026-11-10", to: "2026-11-12" }), ["2026-11-10", "2026-11-11", "2026-11-12"]);
  assert.deepEqual(seriesDates({ kind: "WEEKLY", weekdays: [], firstLocalDate: "2026-11-01", until: null }, { from: "2026-11-01", to: "2026-11-30" }), []);
});

test("an open-ended series is kept for four months from today and a bounded one up to its end", () => {
  assert.equal(openEndedHorizon("2026-10-27"), "2027-02-27");
  assert.equal(openEndedHorizon("2026-10-31"), "2027-02-28", "a short month clamps to its last day");
  assert.equal(openEndedHorizon("2026-11-30"), "2027-03-30");
});

test("local dates move by whole days across month and year ends", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2026-11-01", 0), "2026-11-01");
});

test("a local wall-clock time becomes the right instant in its time zone", () => {
  // Manila is UTC+8 all year.
  assert.equal(zonedLocalToUtc("2026-11-01", "09:30", manila).toISOString(), "2026-11-01T01:30:00.000Z");
  // New York leaves daylight time on 2026-11-01 at 02:00, so 12:00 that day is UTC-5.
  assert.equal(zonedLocalToUtc("2026-11-01", "12:00", "America/New_York").toISOString(), "2026-11-01T17:00:00.000Z");
  assert.equal(zonedLocalToUtc("2026-10-31", "12:00", "America/New_York").toISOString(), "2026-10-31T16:00:00.000Z");
});

test("the local time and the span in days are read back from a start and end", () => {
  const starts = new Date("2026-11-01T01:30:00.000Z");
  const ends = new Date("2026-11-01T04:00:00.000Z");
  assert.equal(localTimeInZone(starts, manila), "09:30");
  assert.equal(eventSpanDays(starts, ends, manila), 0);
  // A retreat from Friday 18:00 to Sunday 12:00 spans two extra days.
  const friday = zonedLocalToUtc("2026-11-06", "18:00", manila);
  const sunday = zonedLocalToUtc("2026-11-08", "12:00", manila);
  assert.equal(eventSpanDays(friday, sunday, manila), 2);
});

test("an occurrence gets its start and end from the local date, the times, and the span", () => {
  const single = occurrenceTimes("2026-11-08", { startLocal: "09:00", endLocal: "11:00", spanDays: 0, timezone: manila });
  assert.equal(single.startsAt.toISOString(), "2026-11-08T01:00:00.000Z");
  assert.equal(single.endsAt.toISOString(), "2026-11-08T03:00:00.000Z");
  const multi = occurrenceTimes("2026-11-06", { startLocal: "18:00", endLocal: "12:00", spanDays: 2, timezone: manila });
  assert.equal(multi.startsAt.toISOString(), "2026-11-06T10:00:00.000Z");
  assert.equal(multi.endsAt.toISOString(), "2026-11-08T04:00:00.000Z");
});

test("changing a series keeps the past and anything edited by hand, and only reshapes the future", () => {
  const existing = [
    { id: "past", localDate: "2026-10-25", edited: false },
    { id: "kept-edit", localDate: "2026-11-08", edited: true },
    { id: "same", localDate: "2026-11-15", edited: false },
    { id: "dropped", localDate: "2026-11-22", edited: false },
    { id: "dropped-edit", localDate: "2026-11-29", edited: true },
  ];
  const plan = planSeriesChange({ existing, desiredDates: ["2026-11-08", "2026-11-15", "2026-12-06"], today: "2026-11-01" });
  assert.deepEqual(plan.create, ["2026-12-06"]);
  assert.deepEqual(plan.update.sort(), ["same"], "an unedited future occurrence takes the new times");
  assert.deepEqual(plan.remove, ["dropped"], "an edited occurrence is never removed by a series change");
});

test("today counts as the future so a series change can still fix today's occurrence", () => {
  const plan = planSeriesChange({ existing: [{ id: "today", localDate: "2026-11-01", edited: false }], desiredDates: [], today: "2026-11-01" });
  assert.deepEqual(plan.remove, ["today"]);
});

test("a new date that an edited occurrence already holds is not created twice", () => {
  const plan = planSeriesChange({ existing: [{ id: "edited", localDate: "2026-11-08", edited: true }], desiredDates: ["2026-11-08"], today: "2026-11-01" });
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.update, []);
});
