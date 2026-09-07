import assert from "node:assert/strict";
import { formatCalendarDate, getCalendarDays, parseCalendarDate } from "./calendar-date.ts";

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
}
