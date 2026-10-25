import assert from "node:assert/strict";
import { test } from "node:test";

test("December 2026 month places Sunday the 20th after Monday the 14th", async () => {
  const calendar = await import("./calendar.ts").catch(() => ({} as { getMonthCells?: (year: number, month: number) => Array<{ date: string; inMonth: boolean }> }));
  assert.equal(typeof calendar.getMonthCells, "function");
  const cells = calendar.getMonthCells!(2026, 11);
  assert.equal(cells[0].date, "2026-11-30");
  assert.equal(cells[20].date, "2026-12-20");
  assert.equal(cells.at(-1)?.date, "2027-01-03");
  assert.equal(cells[0].inMonth, false);
  assert.equal(cells[20].inMonth, true);
});

test("calendar groups an occurrence by its stored local date", async () => {
  const calendar = await import("./calendar.ts") as { groupByLocalDate?: (items: Array<{ localDate: string }>) => Map<string, Array<{ localDate: string }>> };
  assert.equal(typeof calendar.groupByLocalDate, "function");
  const item = { localDate: "2026-12-20" };
  assert.deepEqual(calendar.groupByLocalDate!([item]).get("2026-12-20"), [item]);
});
