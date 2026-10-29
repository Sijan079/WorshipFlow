import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildTime, formatTime, itemIndexFromScroll, parseTime, scrollForIndex } from "./time-of-day.ts";

const read = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [path] : [];
  });
}

test("a 24-hour time is read as a 12-hour clock with AM or PM", () => {
  assert.deepEqual(parseTime("18:00"), { hour: 6, minute: 0, period: "PM" });
  assert.deepEqual(parseTime("09:05"), { hour: 9, minute: 5, period: "AM" });
  assert.deepEqual(parseTime("00:30"), { hour: 12, minute: 30, period: "AM" }, "just after midnight is 12 AM");
  assert.deepEqual(parseTime("12:00"), { hour: 12, minute: 0, period: "PM" }, "noon is 12 PM");
  assert.deepEqual(parseTime("23:59"), { hour: 11, minute: 59, period: "PM" });
});

test("anything that is not a time is not read", () => {
  for (const value of ["", "25:00", "12:60", "7:5", "noon", "18:00:00"]) assert.equal(parseTime(value), null, value);
});

test("a 12-hour choice is written back as the 24-hour time the forms keep", () => {
  assert.equal(buildTime(6, 0, "PM"), "18:00");
  assert.equal(buildTime(9, 5, "AM"), "09:05");
  assert.equal(buildTime(12, 0, "AM"), "00:00");
  assert.equal(buildTime(12, 15, "PM"), "12:15");
  for (const value of ["00:00", "06:45", "12:00", "13:30", "23:55"]) {
    const read = parseTime(value)!;
    assert.equal(buildTime(read.hour, read.minute, read.period), value, `${value} survives a round trip`);
  }
});

test("a time is shown the way people say it", () => {
  assert.equal(formatTime("18:00"), "6:00 PM");
  assert.equal(formatTime("07:05"), "7:05 AM");
  assert.equal(formatTime("00:00"), "12:00 AM");
  assert.equal(formatTime(""), "");
});

test("how far a wheel has scrolled tells which row sits in the middle band, and back", () => {
  assert.equal(itemIndexFromScroll(0, 44, 12), 0);
  assert.equal(itemIndexFromScroll(132, 44, 12), 3, "exactly on a row");
  assert.equal(itemIndexFromScroll(140, 44, 12), 3, "a little past a row still counts as that row");
  assert.equal(itemIndexFromScroll(160, 44, 12), 4, "past halfway goes to the next row");
  assert.equal(itemIndexFromScroll(9999, 44, 12), 11, "cannot go past the last row");
  assert.equal(itemIndexFromScroll(-30, 44, 12), 0, "cannot go before the first row");
  assert.equal(scrollForIndex(3, 44), 132);
  for (let index = 0; index < 60; index += 1) assert.equal(itemIndexFromScroll(scrollForIndex(index, 44), 44, 60), index, `row ${index} round trip`);
});

test("the time picker is an alarm-style wheel in our own popup, with the same style as the date picker", () => {
  const picker = read("src", "components", "ui", "production-time-picker.tsx");
  for (const text of ["Choose time", "Done", "Popover.Root", "Clock", "AM", "PM", "snap-y", "onScroll", "role=\"listbox\"", "Hour", "Minute"]) assert.ok(picker.includes(text), text);
  assert.doesNotMatch(picker, /type="time"/, "not the browser's own clock");
  assert.doesNotMatch(picker, /<svg|pointToAngle|minuteChoices|grid-cols-6/, "not the clock face or the old grid of buttons");
});

test("the whole app uses the Services date picker and our time picker, never the browser's own date or time fields", () => {
  const offenders = sourceFiles(join(process.cwd(), "src")).filter((file) => /type="(date|time|datetime-local)"/.test(readFileSync(file, "utf8")));
  assert.deepEqual(offenders.map((file) => file.replace(process.cwd(), "")), []);
});
