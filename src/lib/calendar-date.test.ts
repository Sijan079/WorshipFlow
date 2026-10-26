import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calendarYearOptions,
  formatCalendarDate,
  getCalendarDays,
  isCalendarDayDisabled,
  monthIsAfter,
  moveMenuIndex,
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

  // Keyboard movement in the month and year menus: stays inside the list.
  assert.equal(moveMenuIndex(2, "ArrowDown", 12), 3);
  assert.equal(moveMenuIndex(11, "ArrowDown", 12), 11);
  assert.equal(moveMenuIndex(0, "ArrowUp", 12), 0);
  assert.equal(moveMenuIndex(5, "Home", 12), 0);
  assert.equal(moveMenuIndex(5, "End", 12), 11);
  assert.equal(moveMenuIndex(3, "PageDown", 127), 8);
  assert.equal(moveMenuIndex(120, "PageDown", 127), 125);
  assert.equal(moveMenuIndex(124, "PageDown", 127), 126);
  assert.equal(moveMenuIndex(3, "PageUp", 127), 0);
  assert.equal(moveMenuIndex(4, "x", 12), 4);
  assert.equal(moveMenuIndex(-1, "ArrowDown", 12), 0);

  // The menus live outside the dialog's own content, so a dialog's scroll lock would swallow
  // the wheel and touch. The list handles both itself.
  const menu = readFileSync(join(process.cwd(), "src", "components", "ui", "calendar-menu.tsx"), "utf8");
  // React attaches its handlers at the document, level with the lock, so these must be
  // native listeners on the list element itself.
  assert.match(menu, /list\.addEventListener\("wheel", keepScrollHere/);
  assert.match(menu, /list\.addEventListener\("touchmove", keepScrollHere/);
  assert.doesNotMatch(menu, /onWheel=/);

  // The header controls (previous, month, year, next) have no borders and share one size.
  const picker = readFileSync(join(process.cwd(), "src", "components", "ui", "production-date-picker.tsx"), "utf8");
  assert.equal((picker.match(/border border-\[var\(--border-default\)\]/g) ?? []).length, 2, "only the field and the calendar panel keep a border");
  assert.doesNotMatch(menu, /border border-\[var\(--border-default\)\]/);
  assert.equal((picker.match(/h-10 w-10/g) ?? []).length, 2, "previous and next are the same size as the menus");
  assert.match(menu, /min-h-10/);

  // The next-month button stops at the month of the latest allowed date.
  assert.equal(monthIsAfter(new Date(2026, 10, 1), "2026-10-26"), true);
  assert.equal(monthIsAfter(new Date(2026, 9, 1), "2026-10-26"), false);
  assert.equal(monthIsAfter(new Date(2030, 0, 1)), false);
}
