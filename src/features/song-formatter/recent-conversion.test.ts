import assert from "node:assert/strict";
import test from "node:test";
import { formatLastTouchedAge } from "./recent-conversion.ts";

test("last-touch age uses compact minute and hour labels", () => {
  const now = Date.parse("2026-09-19T12:00:00.000Z");

  assert.equal(formatLastTouchedAge("2026-09-19T11:59:40.000Z", now), "Just now");
  assert.equal(formatLastTouchedAge("2026-09-19T11:42:00.000Z", now), "18m ago");
  assert.equal(formatLastTouchedAge("2026-09-19T11:00:00.000Z", now), "1hr ago");
  assert.equal(formatLastTouchedAge("2026-09-19T04:00:00.000Z", now), "8hrs ago");
});
