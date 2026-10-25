import assert from "node:assert/strict";
import { test } from "node:test";

test("event creation rejects an end before its start", async () => {
  const validation = await import("./event-validation.ts").catch(() => ({} as { CreateEventSchema?: { safeParse: (value: unknown) => { success: boolean } } }));
  assert.ok(validation.CreateEventSchema);
  const parsed = validation.CreateEventSchema!.safeParse({
    title: "Fellowship",
    localDate: "2026-12-20",
    startsAt: "2026-12-20T18:00:00+08:00",
    endsAt: "2026-12-20T17:00:00+08:00",
    timezone: "Asia/Manila",
  });
  assert.equal(parsed.success, false);
});
