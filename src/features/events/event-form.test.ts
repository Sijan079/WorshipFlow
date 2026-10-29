import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CreateEventSchema } from "./event-validation.ts";
import { detailsCardOpen } from "./calendar.ts";
import { cancelChoices } from "./event-status.ts";
import { buildCreatePayload, buildOccurrenceTimes, changeDate, formProblem, initialForm, occurrenceProblem, timeInputValue, toggleWeekday } from "./event-form.ts";

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

test("moving the date moves the ready weekday with it, but never undoes a choice the person made", () => {
  const moved = changeDate(initialForm("2026-10-29"), "2026-11-04");
  assert.equal(moved.date, "2026-11-04");
  assert.deepEqual(moved.weekdays, [3]);
  const chosen = { ...initialForm("2026-10-29"), weekdays: toggleWeekday([4], 0) };
  assert.deepEqual(changeDate(chosen, "2026-11-04").weekdays, [0, 4]);
  const later = changeDate({ ...initialForm("2026-10-29"), endDate: "2026-11-02" }, "2026-10-30");
  assert.equal(later.endDate, "2026-11-02", "an end date still after the new date is kept");
  assert.equal(changeDate(initialForm("2026-10-29"), "2026-11-04").endDate, "2026-11-04", "an end date before the new date moves with it");
  assert.deepEqual(changeDate(initialForm("2026-10-29"), "").weekdays, [4], "a cleared date leaves the weekday alone");
});

test("the Events screen follows the register layout: one surface, a toolbar, a footer, and the details under their row on a list", () => {
  const page = read("src", "features", "events", "events-page-client.tsx");
  assert.match(page, /ui-surface-elevated ui-operational-register/);
  assert.match(page, /ui-register-toolbar/);
  assert.match(page, /ui-page-header/);
  assert.match(page, /<ListPaginationFooter/);
  assert.match(page, /placeholderData: keepPreviousData/, "changing the month does not blank the register");
  assert.match(page, /aria-label="Event details"/);
  const screen = ["events-page-client.tsx", "event-details.tsx", "event-form-fields.tsx", "event-new-form.tsx", "event-month-grid.tsx"].map((file) => read("src", "features", "events", file)).join("\n");
  assert.doesNotMatch(screen, /border-\[var\(--border-default\)\] bg-\[var\(--surface-panel\)\] shadow/, "no second card beside the register");
  assert.doesNotMatch(screen, /uppercase tracking-wide/, "no eyebrow labels");
});

test("the details card is shown only when there is something to show, so the calendar is full width otherwise", () => {
  assert.equal(detailsCardOpen({ showForm: false, opened: false, hasSelection: true }), false, "nothing chosen yet");
  assert.equal(detailsCardOpen({ showForm: false, opened: true, hasSelection: true }), true);
  assert.equal(detailsCardOpen({ showForm: false, opened: true, hasSelection: false }), false, "a day with no events has nothing to show");
  assert.equal(detailsCardOpen({ showForm: true, opened: false, hasSelection: false }), true, "the New event form uses the card");
});

test("the details card is its own card with an X to close it, and the month toolbar has no event counter", () => {
  const page = read("src", "features", "events", "events-page-client.tsx");
  assert.match(page, /aria-label="Close event details"/);
  assert.match(page, /detailsCardOpen\(/);
  assert.match(page, /<motion\.aside[^>]*ui-surface-elevated/, "its own card, beside the calendar");
  assert.doesNotMatch(page, /\{calendarItems\.length\} \{calendarItems\.length === 1 \? "event" : "events"\}/, "no counter beside Month and List");
});

test("on a wide screen the list and the review list use the same details card; only a phone opens details under the row", () => {
  const page = read("src", "features", "events", "events-page-client.tsx");
  assert.match(page, /const inline = !wide;/);
  assert.match(page, /const listMode = inline \|\| reviewMode \|\| view === "list";/);
  assert.match(page, /const cardOpen = !inline && detailsCardOpen\(/);
  assert.match(page, /showForm && inline/, "the form sits above the list only on a phone");
  assert.match(page, /open && inline/, "details under the row only on a phone");
});

test("the event actions are quiet icon buttons with a name, placed right under the event's details", () => {
  const details = read("src", "features", "events", "event-details.tsx");
  assert.match(details, /function IconAction/);
  assert.match(details, /aria-label=\{label\}/);
  assert.match(details, /title=\{label\}/);
  for (const label of ["Edit", "Announce this event", "Restore", "Mark done", "Mark not done", "Delete event"]) {
    assert.match(details, new RegExp(`<IconAction[^>]*label="${label}"`), label);
  }
  const row = details.indexOf('<IconAction icon={Pencil}');
  assert.ok(row > details.indexOf("{item.edited ? <p"), "after the details text");
  assert.ok(row < details.indexOf("<PublicSwitch"), "before the website switch");
  assert.doesNotMatch(details.slice(row, row + 2500), /SECONDARY_BUTTON/, "no filled buttons in the action row");
});

test("cancel and delete ask in a modal, not inside the card; edit and mark done stay in the card", () => {
  const details = read("src", "features", "events", "event-details.tsx");
  assert.match(details, /function ConfirmModal/);
  assert.match(details, /<Dialog open onOpenChange/);
  assert.match(details, /ui-modal-close/);
  for (const form of ["CancelForm", "CancelAllForm", "DeleteForm"]) {
    assert.doesNotMatch(details, new RegExp(`<Collapse[^\\n]*><${form}`), `${form} is not drawn inside the card`);
    assert.match(details, new RegExp(`function ${form}[\\s\\S]*?<ConfirmModal`), `${form} uses the modal`);
  }
  assert.match(details, /<Collapse show=\{canEdit && mode === "edit"\}><EditForm/);
  assert.match(details, /<Collapse show=\{canEdit && mode === "done"\}><DoneForm/);
  for (const title of ["Cancel This Date?", "Cancel All Dates?", "Delete This Event?"]) assert.ok(details.includes(title), title);
});

test("the Events card has no filler lines under the website switch or the actions", () => {
  const screen = ["event-details.tsx", "event-form-fields.tsx", "event-new-form.tsx"].map((file) => read("src", "features", "events", file)).join("\n");
  assert.doesNotMatch(screen, /Only the title, date, time and place are shown/);
  assert.doesNotMatch(screen, /To delete this event, cancel it first/);
  assert.doesNotMatch(screen, /Dates are added automatically/);
  // Announcements still explain their own switch.
  assert.ok(read("src", "features", "posts", "announcement-details.tsx").includes("Shown on the public website while it is published"));
});

test("the action icons stay on screen while a cancel or delete modal is open", () => {
  const details = read("src", "features", "events", "event-details.tsx");
  assert.match(details, /const actionsVisible = mode === "view" \|\| mode === "cancel" \|\| mode === "cancelAll" \|\| mode === "delete";/);
  assert.match(details, /\(canEdit \|\| canDelete \|\| canAnnounce\) && actionsVisible/);
});

test("the destructive icons are grey until hovered, then red", () => {
  const details = read("src", "features", "events", "event-details.tsx");
  assert.match(details, /danger \? "text-\[var\(--text-secondary\)\] hover:text-\[var\(--state-danger\)\]"/);
  assert.doesNotMatch(details, /danger \? "text-\[var\(--state-danger\)\]/, "not red at rest");
  assert.match(details, /<IconAction icon=\{Trash2\} label="Delete event"[^\n]*danger/);
  for (const label of ["Edit", "Announce this event", "Restore", "Mark done", "Mark not done"]) {
    assert.doesNotMatch(details, new RegExp(`<IconAction icon=\\{\\w+\\} label="${label}"[^\\n]*danger`), `${label} is not a danger icon`);
  }
});

test("there is one Cancel icon; with two choices it opens a small menu, with one it opens that confirmation", () => {
  assert.deepEqual(cancelChoices({ canEdit: true, cancelled: false, done: false, repeats: true, activeDates: 5 }), ["this", "all"]);
  assert.deepEqual(cancelChoices({ canEdit: true, cancelled: false, done: false, repeats: false, activeDates: 1 }), ["this"], "a one-time event has no series to cancel");
  assert.deepEqual(cancelChoices({ canEdit: true, cancelled: true, done: false, repeats: true, activeDates: 4 }), ["all"], "this date is already cancelled");
  assert.deepEqual(cancelChoices({ canEdit: true, cancelled: true, done: false, repeats: true, activeDates: 0 }), [], "everything is cancelled already");
  assert.deepEqual(cancelChoices({ canEdit: true, cancelled: false, done: true, repeats: false, activeDates: 1 }), [], "a date marked done is not cancelled");
  assert.deepEqual(cancelChoices({ canEdit: false, cancelled: false, done: false, repeats: true, activeDates: 5 }), [], "needs Edit");
  const details = read("src", "features", "events", "event-details.tsx");
  assert.match(details, /<DropdownMenu/);
  assert.match(details, /aria-label="Cancel"/);
  assert.match(details, /cancelChoices\(/);
  assert.equal(details.match(/<IconAction[^\n]*label="Cancel (this date|all dates)"/g), null, "no separate cancel icons");
  for (const text of ["Cancel this date", "Cancel all dates"]) assert.ok(details.includes(text), text);
});

test("the Cancel This Date modal leaves a clear gap between the note field and its buttons", () => {
  const details = read("src", "features", "events", "event-details.tsx");
  const form = details.slice(details.indexOf("function CancelForm"), details.indexOf("function DeleteForm"));
  assert.match(form, /<div className="mt-6 flex justify-end gap-3">/);
});

test("the note says (Optional), Keep it is plain text with no fill or border, and Edit has no explainer line", () => {
  const details = read("src", "features", "events", "event-details.tsx");
  assert.match(details, /Note <span[^>]*>\(Optional\)<\/span>/);
  assert.equal(details.match(/onClick=\{onClose\} className=\{KEEP_BUTTON\}>Keep it</g)?.length, 3, "cancel, cancel all, and delete");
  const keep = details.match(/const KEEP_BUTTON = "([^"]*)"/)?.[1] ?? "";
  assert.ok(keep.length > 0, "KEEP_BUTTON is defined");
  assert.doesNotMatch(keep.replace(/--border-focus/g, ""), /ui-btn|border|bg-/, "no fill, no border (the focus outline colour is fine)");
  assert.doesNotMatch(details, /apply to every date of this event/);
  assert.doesNotMatch(details, /SECONDARY_BUTTON/, "no unused filled-button style left behind");
});

test("the Events page glides instead of jumping, and respects the reduced-motion setting", () => {
  const page = read("src", "features", "events", "events-page-client.tsx");
  assert.match(page, /<MotionConfig reducedMotion="user">/, "people who turn animation off get none");
  assert.match(page, /<AnimatePresence>\s*\{cardOpen \? <motion\.aside/, "the details card slides in and out");
  assert.match(page, /exit=\{\{ opacity: 0, x: 24 \}\}/);
  assert.match(page, /gridTemplateColumns: cardOpen \? "minmax\(0,1fr\) 360px" : "minmax\(0,1fr\) 0px"/, "the calendar or list glides wider as the card closes");
  assert.match(page, /transition: "grid-template-columns/);
  assert.match(page, /motion-reduce:!transition-none/);
  assert.match(page, /<motion\.div key=\{`\$\{month\.year\}-\$\{month\.index\}`\}/, "the month fades in when it changes");
  assert.match(page, /<motion\.li key=\{item\.id\}/, "list rows fade in");
  assert.match(page, /key=\{showForm \? "form" : selected\?\.id\}/, "the card content fades when it changes");
});

test("Edit, Mark done and the action icons open and close with a smooth collapse, not a jump", () => {
  const details = read("src", "features", "events", "event-details.tsx");
  assert.match(details, /function Collapse/);
  assert.match(details, /<AnimatePresence initial=\{false\}>/, "the card itself does not animate when it first appears");
  assert.match(details, /exit=\{\{ opacity: 0, height: 0, marginTop: 0, overflow: "hidden" \}\}/, "it can leave, not only arrive");
  assert.match(details, /transitionEnd: \{ overflow: "visible" \}/, "focus outlines are not clipped once it has settled");
  assert.match(details, /<Collapse show=\{\(canEdit \|\| canDelete \|\| canAnnounce\) && actionsVisible\}>/, "the icons ease away when a form opens");
  assert.doesNotMatch(details, /function Glide|<Glide>/, "the old fade-in-only wrapper is gone");
});

test("the review screen has a Title Case heading, no count, and a Back to calendar icon instead of a labelled button", () => {
  const page = read("src", "features", "events", "events-page-client.tsx");
  assert.ok(page.includes(">Past Events to Review<"));
  assert.ok(!page.includes("Past events to review"), "the old sentence-case heading is gone");
  assert.doesNotMatch(page, /\{items\.length\} to review/, "no count beside the heading");
  const back = page.slice(page.indexOf('aria-label="Back to calendar"') - 400, page.indexOf('aria-label="Back to calendar"') + 400);
  assert.match(back, /aria-label="Back to calendar" title="Back to calendar"/, "the icon still has a name and a tooltip");
  assert.match(back, /<ArrowLeft aria-hidden="true"/);
  assert.doesNotMatch(page, />Back to calendar</, "the words are no longer drawn on the button");
});

test("the review list shows a loading state while it loads and an error with Retry if it fails, never a false Nothing to review", () => {
  const page = read("src", "features", "events", "events-page-client.tsx");
  assert.match(page, /const reviewLoading = reviewMode && reviewQuery\.isPending;/);
  assert.match(page, /const reviewFailed = reviewMode && reviewQuery\.isError;/);
  assert.match(page, /\{monthLoading \|\| reviewLoading \? \(/, "a skeleton while the review list loads");
  assert.match(page, /<EventsSkeleton \/>/);
  assert.match(page, /\{eventQuery\.isError \|\| reviewFailed \?/, "an error band with Retry if it fails");
  assert.match(page, /\(reviewFailed \? reviewQuery : eventQuery\)\.refetch\(\)/, "Retry asks again for the list that failed");
  assert.match(page, /\{data && !monthLoading && !reviewLoading && !reviewFailed \?/, "the empty message only shows once the list has really loaded");
});

test("changing month shows a calendar skeleton until the new month has loaded, not the old month's events", () => {
  const grid = read("src", "features", "events", "event-month-grid.tsx");
  assert.match(grid, /export function EventMonthSkeleton/);
  assert.match(grid, /role="status" aria-label="Loading events"/);
  assert.match(grid, /animate-pulse/);
  const page = read("src", "features", "events", "events-page-client.tsx");
  assert.match(page, /const monthLoading = !reviewMode && \(eventQuery\.isPending \|\| eventQuery\.isPlaceholderData\);/, "the old month is only a placeholder while the new one loads");
  assert.match(page, /\{monthLoading \|\| reviewLoading \? \(/, "a skeleton while either list loads");
  assert.match(page, /<EventMonthSkeleton cells=\{cells\} \/>/, "the calendar's own shape on the month view");
  assert.match(page, /\{data && !monthLoading && !reviewLoading && !reviewFailed \?/, "the old month is hidden while the new one loads");
  assert.match(page, /placeholderData: keepPreviousData/, "the page's flags and buttons keep working underneath");
});

test("every serious confirmation on Events reads Yes, I am sure", () => {
  const details = read("src", "features", "events", "event-details.tsx");
  assert.equal(details.match(/Yes, I am sure/g)?.length, 3, "cancel this date, cancel all dates, and delete");
});

test("a cancelled event does not offer Announce this event", () => {
  const details = read("src", "features", "events", "event-details.tsx");
  assert.match(details, /canAnnounce && !cancelled \? <IconAction/);
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
  const fields = read("src", "features", "events", "event-form-fields.tsx");
  assert.match(fields, /\{ value: "NONE", label: "Never" \}/);
  assert.match(fields, /\{ value: "DAILY", label: "Daily" \}/);
  assert.match(fields, /\{ value: "WEEKLY", label: "Weekly" \}/);
  for (const old of ["Doesn't repeat", "Every day", "Every week"]) assert.ok(!screen.includes(old), `${old} was renamed`);
  for (const text of ["Daily", "Weekly", "Ends on", "Never", "Show on the church website", "Cancel this date", "Delete event", "Keep it", "cannot be undone", "Restore", "This date only", "All future dates", "Changed", "This date was changed on its own, so series changes skip it."]) {
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
  assert.match(details, /<ProductionDatePicker label="Date"/);
  assert.match(details, /<ProductionTimePicker label="Start"/);
  assert.match(details, /<ProductionTimePicker label="End"/);
  assert.ok(details.includes("Ends on"));
  assert.match(details, /buildOccurrenceTimes\(/);
  const route = read("src", "app", "api", "events", "occurrences", "[id]", "route.ts");
  assert.match(route, /firstLocalDate/);
  assert.match(route, /repeatKind === "NONE"/);
});

test("the whole day cell selects the date, and an event chip inside it selects the event instead", () => {
  const grid = read("src", "features", "events", "event-month-grid.tsx");
  assert.match(grid, /<div key=\{cell\.date\} onClick=/);
  assert.match(grid, /event\.stopPropagation\(\)/);
});
