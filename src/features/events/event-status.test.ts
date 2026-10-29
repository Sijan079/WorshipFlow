import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { attendanceShown, canMarkDone, canRecordAttendance, canMarkNotDone, needsReview, registrationShown, reviewBannerText } from "./event-status.ts";

const read = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");
const now = new Date("2026-10-28T12:00:00Z");

function date(over: Partial<{ repeats: boolean; status: "SCHEDULED" | "CANCELLED"; doneAt: string | null; startsAt: string; endsAt: string }> = {}) {
  return { repeats: false, status: "SCHEDULED" as const, doneAt: null, startsAt: "2026-10-27T10:00:00Z", endsAt: "2026-10-27T11:00:00Z", ...over };
}

test("a one-time event needs review once it has ended and is neither done nor cancelled", () => {
  assert.equal(needsReview(date(), now), true);
  assert.equal(needsReview(date({ endsAt: "2026-10-28T13:00:00Z" }), now), false, "still running or ahead");
  assert.equal(needsReview(date({ doneAt: "2026-10-27T12:00:00Z" }), now), false);
  assert.equal(needsReview(date({ status: "CANCELLED" }), now), false);
});

test("a repeating event is never tracked this way", () => {
  assert.equal(needsReview(date({ repeats: true }), now), false);
  assert.equal(canMarkDone(date({ repeats: true }), now), false);
});

test("a one-time event can be marked done once it has started, and undone afterwards", () => {
  assert.equal(canMarkDone(date(), now), true);
  assert.equal(canMarkDone(date({ startsAt: "2026-10-28T12:30:00Z", endsAt: "2026-10-28T13:30:00Z" }), now), false, "has not started");
  assert.equal(canMarkDone(date({ startsAt: "2026-10-28T11:00:00Z", endsAt: "2026-10-28T13:00:00Z" }), now), true, "started, still running");
  assert.equal(canMarkDone(date({ status: "CANCELLED" }), now), false);
  assert.equal(canMarkDone(date({ doneAt: "2026-10-27T12:00:00Z" }), now), false, "already done");
  assert.equal(canMarkNotDone(date({ doneAt: "2026-10-27T12:00:00Z" })), true);
  assert.equal(canMarkNotDone(date()), false);
  assert.equal(canMarkNotDone(date({ repeats: true, doneAt: "2026-10-27T12:00:00Z" })), false);
});

test("Registration is shown only when there is a link or there are responses", () => {
  assert.equal(registrationShown({ registrationUrl: null, responseCount: null }), false);
  assert.equal(registrationShown({ registrationUrl: "https://forms.example/abc", responseCount: null }), true);
  assert.equal(registrationShown({ registrationUrl: null, responseCount: 0 }), true, "a form that exists but has no answers yet");
});

test("After the event is shown only once an attendance number has been recorded", () => {
  assert.equal(attendanceShown({ attendanceCount: null }), false);
  assert.equal(attendanceShown({ attendanceCount: 0 }), true, "zero is a recorded number");
  assert.equal(attendanceShown({ attendanceCount: 120 }), true);
});

test("a headcount can be recorded on any date that has started and is not cancelled, repeating or not, done or not", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  const started = "2026-10-29T10:00:00Z";
  const later = "2026-10-29T18:00:00Z";
  assert.equal(canRecordAttendance({ status: "SCHEDULED", startsAt: started }, now), true);
  assert.equal(canRecordAttendance({ status: "SCHEDULED", startsAt: later }, now), false, "it has not happened yet");
  assert.equal(canRecordAttendance({ status: "CANCELLED", startsAt: started }, now), false, "it did not happen");
  assert.equal(canRecordAttendance({ status: "SCHEDULED", startsAt: now.toISOString() }, now), true, "starting right now counts as started");
});

test("the card has an Attendance icon and an inline form for it, and the server holds the same rule", () => {
  const details = readFileSync(join(process.cwd(), "src", "features", "events", "event-details.tsx"), "utf8");
  assert.match(details, /<IconAction icon=\{Users\} label=\{item\.attendanceCount === null \? "Record attendance" : "Edit attendance"\}/);
  assert.match(details, /canRecordAttendance\(item\)/);
  assert.match(details, /function AttendanceForm/);
  assert.match(details, /<Collapse show=\{canEdit && mode === "attendance"\}><AttendanceForm/);
  assert.match(details, /const actionsVisible = mode === "view"/, "the icons are replaced by the form while it is open, like Edit");
  assert.match(details, /attendanceCount: count\.trim\(\) === "" \? null : Number\(count\.trim\(\)\)/, "an empty box clears the number");
  const route = readFileSync(join(process.cwd(), "src", "app", "api", "events", "occurrences", "[id]", "route.ts"), "utf8");
  assert.match(route, /typeof input\.attendanceCount === "number"/);
  assert.match(route, /This event has not started yet\./);
});

test("the Events card hides empty sections instead of explaining that they are empty", () => {
  const details = readFileSync(join(process.cwd(), "src", "features", "events", "event-details.tsx"), "utf8");
  assert.match(details, /registrationShown\(item\)/);
  assert.match(details, /attendanceShown\(item\)/);
  assert.doesNotMatch(details, /No registration link/);
  assert.doesNotMatch(details, /Attendance has not been recorded/);
  const fields = readFileSync(join(process.cwd(), "src", "features", "events", "event-form-fields.tsx"), "utf8");
  const switchButton = fields.slice(fields.indexOf('role="switch"'), fields.indexOf("</button>", fields.indexOf('role="switch"')));
  assert.doesNotMatch(switchButton, /border border-\[var\(--border-default\)\]/, "the website switch has no border");
});

test("the banner counts what needs review in plain words", () => {
  assert.equal(reviewBannerText(0), null);
  assert.equal(reviewBannerText(1), "1 past event needs to be marked done or cancelled.");
  assert.equal(reviewBannerText(3), "3 past events need to be marked done or cancelled.");
});

test("the database gets one additive column for done", () => {
  assert.match(read("prisma", "schema.prisma"), /doneAt\s+DateTime\?/);
  const migration = readdirSync(join(process.cwd(), "prisma", "migrations-current")).find((entry) => entry.endsWith("_event_done"));
  assert.ok(migration, "a *_event_done migration");
  const sql = read("prisma", "migrations-current", migration, "migration.sql");
  assert.match(sql, /ADD COLUMN "doneAt" TIMESTAMP\(3\)/);
  assert.doesNotMatch(sql, /DROP|DELETE|TRUNCATE|ALTER COLUMN|RENAME/i, "additive only");
});

test("marking done is checked on the server, changes nothing else about the date, and needs Edit", () => {
  const source = read("src", "app", "api", "events", "occurrences", "[id]", "route.ts");
  assert.match(source, /doneAt/);
  assert.match(source, /repeatKind/);
  assert.match(source, /Mark it not done first/);
  assert.match(source, /edited: touchesSchedule/);
  assert.match(read("src", "features", "events", "event-validation.ts"), /done: z\.boolean\(\)\.optional\(\)/);
});

test("deleting needs every date cancelled, enforced on the server, and a series can be cancelled in one step", () => {
  const source = read("src", "app", "api", "events", "[id]", "route.ts");
  assert.match(source, /occurrences: \{ none: \{ status: \{ not: "CANCELLED" \} \} \}/);
  assert.match(source, /status: 409/);
  assert.match(source, /cancelAll/);
  assert.match(read("src", "features", "events", "event-validation.ts"), /cancelAll: z\.literal\(true\)\.optional\(\)/);
});

test("the list says what needs review and offers a review list", () => {
  const route = read("src", "app", "api", "events", "route.ts");
  assert.match(route, /needsReviewCount/);
  assert.match(route, /doneAt/);
  assert.match(route, /activeDates/);
  assert.match(route, /searchParams\.get\("review"\)/);
  const screen = ["events-page-client.tsx", "event-details.tsx"].map((file) => read("src", "features", "events", file)).join("\n");
  for (const text of ["Mark done", "Mark not done", "Needs review", "Done", "Cancel all dates"]) {
    assert.ok(screen.includes(text), text);
  }
});
