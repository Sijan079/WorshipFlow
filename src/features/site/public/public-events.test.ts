import assert from "node:assert/strict";
import { test } from "node:test";
import { nextDatePerEvent } from "./public-events.ts";

const row = (id: string, eventId: string, day: number) => ({
  id,
  eventId,
  startsAt: new Date(Date.UTC(2026, 10, day, 10)),
  title: eventId === "prayer" ? "Prayer Meeting" : "Youth Camp",
  venue: null,
  timezone: "Asia/Manila",
});

test("a repeating event is shown once, on its next date", () => {
  const rows = [row("a", "prayer", 5), row("b", "prayer", 12), row("c", "camp", 8), row("d", "prayer", 19)];
  const shown = nextDatePerEvent(rows, 10);
  assert.deepEqual(shown.map((item) => item.id), ["a", "c"]);
});

test("events are listed soonest first, whatever order they arrive in", () => {
  const shown = nextDatePerEvent([row("c", "camp", 8), row("a", "prayer", 5)], 10);
  assert.deepEqual(shown.map((item) => item.id), ["a", "c"]);
});

test("the list is limited", () => {
  const rows = Array.from({ length: 15 }, (_, index) => row(`r${index}`, `event-${index}`, index + 1));
  assert.equal(nextDatePerEvent(rows, 10).length, 10);
});

test("nothing in, nothing out", () => {
  assert.deepEqual(nextDatePerEvent([], 10), []);
});
