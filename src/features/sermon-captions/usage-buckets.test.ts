import test from "node:test";
import assert from "node:assert/strict";
import { azureHourBuckets, dayBuckets, deepgramBuckets, shortCount, utcWeekBuckets } from "./usage-buckets.ts";

// Local-time constructors, so the checks hold in any time zone.
const at = (month: number, day: number, hour = 0, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();
const now = new Date(2026, 9, 28, 14, 30); // Wednesday, October 28, 2026, 2:30 pm

test("the Azure day view covers the whole UTC month, marks days to come, and leaves unread days empty", () => {
  const days = dayBuckets("2026-10-01T00:00:00.000Z", [{ day: "2026-10-28", value: 199 }], "2026-10-30", false);
  assert.equal(days.length, 31);
  assert.equal(days.find((day) => day.key === "d:2026-10-28")?.value, 199);
  assert.equal(days.find((day) => day.key === "d:2026-10-27")?.value, null);
  assert.equal(days.find((day) => day.key === "d:2026-10-31")?.future, true);
  assert.equal(dayBuckets("2026-10-01T00:00:00.000Z", [], "2026-10-30", true)[3].value, 0);
});

test("the Deepgram day view is 24 hours, and a stream is shared out over the hours it covered", () => {
  const hours = deepgramBuckets("day", [[at(10, 28, 10, 30), 3600, 0.6]], now);
  assert.equal(hours.length, 24);
  assert.equal(Math.round(hours[10].value ?? -1), 30);
  assert.equal(Math.round(hours[11].value ?? -1), 30);
  assert.equal(hours[9].value, 0);
  assert.equal(hours[16].future, true);
  assert.equal(hours[16].value, null);
});

test("the Deepgram week runs Sunday to Saturday and the month runs day 1 to the last day", () => {
  const week = deepgramBuckets("week", [[at(10, 25, 9), 600, 0.1], [at(10, 28, 9), 1200, 0.2]], now);
  assert.equal(week.length, 7);
  assert.equal(Math.round(week[0].value ?? -1), 10);
  assert.equal(Math.round(week[3].value ?? -1), 20);
  assert.equal(week[4].future, true);
  const month = deepgramBuckets("month", [[at(10, 28, 9), 1200, 0.2]], now);
  assert.equal(month.length, 31);
  assert.equal(Math.round(month[27].value ?? -1), 20);
  assert.equal(month[29].future, true);
});

test("a stream that crosses midnight is split between the two days in proportion", () => {
  const month = deepgramBuckets("month", [[at(10, 27, 23, 30), 3600, 1]], now);
  assert.equal(Math.round(month[26].value ?? -1), 30);
  assert.equal(Math.round(month[27].value ?? -1), 30);
});

test("a day has the same key in the week and the month, and an hour names its day as its parent", () => {
  const week = deepgramBuckets("week", [], now);
  const month = deepgramBuckets("month", [], now);
  assert.equal(week[3].key, "d:2026-10-28");
  assert.equal(month[27].key, "d:2026-10-28");
  const hours = deepgramBuckets("day", [], now);
  assert.equal(hours[14].parent, "d:2026-10-28");
  assert.equal(new Set(hours.map((hour) => hour.key)).size, 24);
});

test("the Azure week runs Sunday to Saturday in UTC with the month's day keys, and big counts shorten to X.XM", () => {
  const week = utcWeekBuckets([{ day: "2026-10-28", value: 150 }], "2026-10-28");
  assert.equal(week.length, 7);
  assert.equal(week[0].key, "d:2026-10-25");
  assert.equal(week[3].value, 150);
  assert.equal(week[4].future, true);
  assert.equal(shortCount(1_950_000), "1.9M");
  assert.equal(shortCount(2_000_000), "2.0M");
  assert.equal(shortCount(999_999), "999,999");
});

test("the Azure day view puts each hour's characters in that local hour", () => {
  const hours = azureHourBuckets([[at(10, 28, 10), 120], [at(10, 28, 11), 30]], now);
  assert.equal(hours.length, 24);
  assert.equal(Math.round(hours[10].value ?? -1), 120);
  assert.equal(Math.round(hours[11].value ?? -1), 30);
  assert.equal(hours[9].value, 0);
  assert.equal(hours[20].future, true);
});
