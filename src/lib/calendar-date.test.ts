import assert from "node:assert/strict";
import {
  calendarYearOptions,
  formatCalendarDate,
  getCalendarDays,
  isCalendarDayDisabled,
  monthIsAfter,
  parseCalendarDate,
} from "./calendar-date.ts";

export function runCalendarDateTests() {
  assert.equal(formatCalendarDate(new Date(2026, 8, 8)), "2026-09-08");
  assert.equal(parseCalendarDate("2026-02-29"), null);
  assert.equal(formatCalendarDate(parseCalendarDate("2028-02-29")!), "2028-02-29");

  const days = getCalendarDays(new Date(2026, 8, 1));
  assert.equal(days.length, 42);
  assert.equal(days[0].value, "2026-08-30");
  assert.equal(days[2].value, "2026-09-01");
  assert.equal(days[2].inCurrentMonth, true);
  assert.equal(days[0].inCurrentMonth, false);

  // Jumping to a birth year: newest year first, down to a floor.
  const years = calendarYearOptions(2026, 1900);
  assert.equal(years.length, 127);
  assert.equal(years[0], 2026);
  assert.equal(years[years.length - 1], 1900);

  // Days after the latest allowed date cannot be chosen (a birthdate is never in the future).
  assert.equal(isCalendarDayDisabled("2026-10-27", "2026-10-26"), true);
  assert.equal(isCalendarDayDisabled("2026-10-26", "2026-10-26"), false);
  assert.equal(isCalendarDayDisabled("2099-01-01"), false);

  // The next-month button stops at the month of the latest allowed date.
  assert.equal(monthIsAfter(new Date(2026, 10, 1), "2026-10-26"), true);
  assert.equal(monthIsAfter(new Date(2026, 9, 1), "2026-10-26"), false);
  assert.equal(monthIsAfter(new Date(2030, 0, 1)), false);
}
