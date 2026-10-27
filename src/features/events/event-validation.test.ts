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

const base = {
  title: "Prayer meeting",
  localDate: "2026-11-04",
  startsAt: "2026-11-04T19:00:00+08:00",
  endsAt: "2026-11-04T20:30:00+08:00",
  timezone: "Asia/Manila",
};

test("an event can repeat weekly on chosen days until a date, or never", async () => {
  const { CreateEventSchema } = await import("./event-validation.ts");
  assert.equal(CreateEventSchema.safeParse(base).success, true, "no repeat is a one-off");
  assert.equal(CreateEventSchema.safeParse({ ...base, repeat: { kind: "WEEKLY", weekdays: [0, 3], until: "2027-03-31" } }).success, true);
  assert.equal(CreateEventSchema.safeParse({ ...base, repeat: { kind: "WEEKLY", weekdays: [3], until: null } }).success, true, "never ends");
  assert.equal(CreateEventSchema.safeParse({ ...base, repeat: { kind: "DAILY", weekdays: [], until: "2026-11-10" } }).success, true);
});

test("a repeat rule must make sense", async () => {
  const { CreateEventSchema } = await import("./event-validation.ts");
  const bad = (repeat: unknown) => CreateEventSchema.safeParse({ ...base, repeat }).success;
  assert.equal(bad({ kind: "WEEKLY", weekdays: [], until: null }), false, "weekly needs a day");
  assert.equal(bad({ kind: "WEEKLY", weekdays: [7], until: null }), false, "days are 0 to 6");
  assert.equal(bad({ kind: "WEEKLY", weekdays: [1, 1], until: null }), false, "no repeated days");
  assert.equal(bad({ kind: "MONTHLY", weekdays: [], until: null }), false, "monthly is deferred");
  assert.equal(bad({ kind: "DAILY", weekdays: [], until: "2026-11-03" }), false, "cannot end before it starts");
  assert.equal(bad({ kind: "DAILY", weekdays: [], until: "2029-01-01" }), false, "a bounded series is limited to two years");
});

test("an event may span several days, but a repeating one cannot overlap itself", async () => {
  const { CreateEventSchema } = await import("./event-validation.ts");
  const retreat = { ...base, localDate: "2026-11-06", startsAt: "2026-11-06T18:00:00+08:00", endsAt: "2026-11-08T12:00:00+08:00" };
  assert.equal(CreateEventSchema.safeParse(retreat).success, true);
  assert.equal(CreateEventSchema.safeParse({ ...retreat, repeat: { kind: "WEEKLY", weekdays: [5], until: null } }).success, true, "two days a week apart is fine");
  assert.equal(CreateEventSchema.safeParse({ ...retreat, repeat: { kind: "DAILY", weekdays: [], until: null } }).success, false, "a two-day event cannot repeat daily");
  assert.equal(CreateEventSchema.safeParse({ ...retreat, endsAt: "2026-12-30T12:00:00+08:00" }).success, false, "a one-off is limited to 31 days");
});

test("events can be marked public and default to private", async () => {
  const { CreateEventSchema } = await import("./event-validation.ts");
  assert.equal(CreateEventSchema.parse(base).isPublic, false);
  assert.equal(CreateEventSchema.parse({ ...base, isPublic: true }).isPublic, true);
});

test("one occurrence can change its time, note, link, headcount or cancelled state, but not be empty", async () => {
  const { UpdateOccurrenceSchema } = await import("./event-validation.ts");
  assert.equal(UpdateOccurrenceSchema.safeParse({ status: "CANCELLED", changeNote: "Typhoon" }).success, true);
  assert.equal(UpdateOccurrenceSchema.safeParse({ attendanceCount: 42 }).success, true);
  assert.equal(UpdateOccurrenceSchema.safeParse({ attendanceCount: null }).success, true, "a headcount can be cleared");
  assert.equal(UpdateOccurrenceSchema.safeParse({ startsAt: "2026-11-04T19:00:00+08:00", endsAt: "2026-11-04T18:00:00+08:00" }).success, false);
  assert.equal(UpdateOccurrenceSchema.safeParse({ startsAt: "2026-11-04T19:00:00+08:00" }).success, false, "a time change needs both ends");
  assert.equal(UpdateOccurrenceSchema.safeParse({ attendanceCount: -1 }).success, false);
  assert.equal(UpdateOccurrenceSchema.safeParse({}).success, false);
  assert.equal(UpdateOccurrenceSchema.safeParse({ registrationUrl: "javascript:alert(1)" }).success, false);
});

test("the series can change its details, public flag, rule and times", async () => {
  const { UpdateEventSchema } = await import("./event-validation.ts");
  assert.equal(UpdateEventSchema.safeParse({ title: "New name", isPublic: true }).success, true);
  assert.equal(UpdateEventSchema.safeParse({ repeat: { kind: "WEEKLY", weekdays: [0], until: null }, startLocal: "09:00", endLocal: "11:00" }).success, true);
  assert.equal(UpdateEventSchema.safeParse({ startLocal: "25:00" }).success, false);
  assert.equal(UpdateEventSchema.safeParse({ title: "" }).success, false);
  assert.equal(UpdateEventSchema.safeParse({}).success, false);
});
