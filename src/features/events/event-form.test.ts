import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CreateEventSchema } from "./event-validation.ts";
import { buildCreatePayload, buildOccurrenceTimes, formProblem, initialForm, occurrenceProblem, timeInputValue, toggleWeekday } from "./event-form.ts";

const zone = "Asia/Manila";
const read = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");

test("a new form starts as a one-time event on the chosen date, with that weekday ready for repeating", () => {
  const form = initialForm("2026-10-28");
  assert.equal(form.repeat, "NONE");
  assert.equal(form.isPublic, false);
  assert.equal(form.endDate, "2026-10-28");
  assert.deepEqual(form.weekdays, [3]);
  assert.equal(form.ends, "NEVER");
});

test("weekday buttons toggle on and off and stay in order", () => {
  assert.deepEqual(toggleWeekday([3], 0), [0, 3]);
  assert.deepEqual(toggleWeekday([0, 3], 3), [0]);
  assert.deepEqual(toggleWeekday([], 6), [6]);
});

test("a one-time event keeps the times entered, read in the church's time zone", () => {
  const payload = buildCreatePayload({ ...initialForm("2026-10-28"), title: "Prayer night", startTime: "18:00", endTime: "19:30" }, zone);
  assert.equal(payload.startsAt, "2026-10-28T10:00:00.000Z");
  assert.equal(payload.endsAt, "2026-10-28T11:30:00.000Z");
  assert.equal(payload.localDate, "2026-10-28");
  assert.equal(payload.timezone, zone);
  assert.equal(payload.isPublic, false);
  assert.equal(payload.repeat, undefined);
  assert.equal(CreateEventSchema.safeParse(payload).success, true);
});

test("a multi-day event ends on the chosen date", () => {
  const payload = buildCreatePayload({ ...initialForm("2026-10-28"), title: "Retreat", startTime: "09:00", endTime: "12:00", endDate: "2026-10-30" }, zone);
  assert.equal(payload.endsAt, "2026-10-30T04:00:00.000Z");
  assert.equal(CreateEventSchema.safeParse(payload).success, true);
});

test("a weekly event sends its weekdays and its last date, or no end", () => {
  const base = { ...initialForm("2026-10-28"), title: "Bible study", repeat: "WEEKLY" as const, weekdays: [3, 5] };
  const never = buildCreatePayload(base, zone);
  assert.deepEqual(never.repeat, { kind: "WEEKLY", weekdays: [3, 5], until: null });
  const dated = buildCreatePayload({ ...base, ends: "ON_DATE", until: "2027-03-31" }, zone);
  assert.deepEqual(dated.repeat, { kind: "WEEKLY", weekdays: [3, 5], until: "2027-03-31" });
  assert.equal(CreateEventSchema.safeParse(dated).success, true);
});

test("a repeating event is one day long, even if an end date was typed before", () => {
  const payload = buildCreatePayload({ ...initialForm("2026-10-28"), title: "Daily prayer", repeat: "DAILY", endDate: "2026-11-05" }, zone);
  assert.equal(payload.endsAt.slice(0, 10), "2026-10-28");
  assert.deepEqual(payload.repeat, { kind: "DAILY", weekdays: [], until: null });
});

test("the form explains what is missing in plain words", () => {
  const form = { ...initialForm("2026-10-28"), title: "Prayer" };
  assert.equal(formProblem(form), null);
  assert.match(formProblem({ ...form, title: "  " }) ?? "", /name/i);
  assert.match(formProblem({ ...form, startTime: "19:00", endTime: "18:00" }) ?? "", /end/i);
  assert.match(formProblem({ ...form, endDate: "2026-10-27" }) ?? "", /end/i);
  assert.match(formProblem({ ...form, repeat: "WEEKLY", weekdays: [] }) ?? "", /day/i);
  assert.match(formProblem({ ...form, repeat: "DAILY", ends: "ON_DATE", until: "" }) ?? "", /last date/i);
  assert.match(formProblem({ ...form, repeat: "DAILY", ends: "ON_DATE", until: "2026-10-01" }) ?? "", /last date/i);
});

test("a time field shows the event's own wall-clock time", () => {
  assert.equal(timeInputValue("2026-10-28T10:00:00.000Z", zone), "18:00");
});

test("the screen offers repeat, a public switch, edit, cancel and restore", () => {
  const screen = ["events-page-client.tsx", "event-form-fields.tsx", "event-details.tsx"].map((file) => read("src", "features", "events", file)).join("\n");
  for (const text of ["Doesn't repeat", "Every day", "Every week", "Ends on", "Never", "Show on the church website", "Only the title, date, time and place are shown.", "Cancel this date", "Delete event", "Keep it", "cannot be undone", "Restore", "This date only", "All future dates", "Changed", "This date was changed on its own, so series changes skip it."]) {
    assert.ok(screen.includes(text), text);
  }
  assert.match(screen, /aria-pressed/, "weekday buttons announce whether they are on");
  assert.match(screen, /\/api\/events\/occurrences\//);
  assert.match(read("src", "app", "api", "events", "route.ts"), /canEdit/);
});

test("a service has an optional attendance number", () => {
  const services = read("src", "components", "service-builder-client.tsx");
  assert.ok(services.includes("How many attended"));
  assert.match(services, /headcount/);
});

test("editing one date can move it and change how many days it lasts", () => {
  const moved = buildOccurrenceTimes({ date: "2026-11-02", endDate: "2026-11-02", startTime: "18:00", endTime: "20:00" }, zone);
  assert.equal(moved.startsAt, "2026-11-02T10:00:00.000Z");
  assert.equal(moved.endsAt, "2026-11-02T12:00:00.000Z");
  const longer = buildOccurrenceTimes({ date: "2026-11-02", endDate: "2026-11-04", startTime: "09:00", endTime: "12:00" }, zone);
  assert.equal(longer.endsAt, "2026-11-04T04:00:00.000Z");
});

test("an edit that ends before it starts is explained", () => {
  assert.equal(occurrenceProblem({ date: "2026-11-02", endDate: "2026-11-02", startTime: "18:00", endTime: "20:00" }), null);
  assert.match(occurrenceProblem({ date: "2026-11-02", endDate: "2026-11-01", startTime: "18:00", endTime: "20:00" }) ?? "", /end date/i);
  assert.match(occurrenceProblem({ date: "2026-11-02", endDate: "2026-11-02", startTime: "20:00", endTime: "18:00" }) ?? "", /end time/i);
  assert.match(occurrenceProblem({ date: "", endDate: "", startTime: "18:00", endTime: "20:00" }) ?? "", /date/i);
});

test("the edit form has date fields and a one-time event keeps its saved shape in step", () => {
  const details = read("src", "features", "events", "event-details.tsx");
  assert.match(details, /type="date"/);
  assert.ok(details.includes("Ends on"));
  assert.match(details, /buildOccurrenceTimes\(/);
  const route = read("src", "app", "api", "events", "occurrences", "[id]", "route.ts");
  assert.match(route, /firstLocalDate/);
  assert.match(route, /repeatKind === "NONE"/);
});

test("the whole day cell selects the date, and an event chip inside it selects the event instead", () => {
  const page = read("src", "features", "events", "events-page-client.tsx");
  assert.match(page, /<div key=\{cell\.date\} onClick=/);
  assert.match(page, /event\.stopPropagation\(\)/);
});
