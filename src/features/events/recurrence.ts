// The repeat rule for church events, as plain functions on local dates ("YYYY-MM-DD") so they can be tested
// without a database. A series is stored as one real occurrence row per date; these functions say which
// dates a rule covers, when each starts and ends, and how a change to the rule reshapes the stored rows.

export type RepeatKind = "NONE" | "DAILY" | "WEEKLY";

export type RepeatRule = {
  kind: RepeatKind;
  // 0 is Sunday through 6 is Saturday. Only used by WEEKLY.
  weekdays: number[];
  firstLocalDate: string;
  // The last local date of the series, or null for "never".
  until: string | null;
};

export type DateWindow = { from: string; to: string };

const DAY_MS = 86_400_000;

function parseDate(localDate: string) {
  return new Date(`${localDate}T00:00:00Z`);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(localDate: string, days: number) {
  return formatDate(new Date(parseDate(localDate).getTime() + days * DAY_MS));
}

// Open-ended series keep only the next four months of occurrences. A month that is too short clamps to its
// last day (31 October plus four months is 28 February).
export function openEndedHorizon(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + 4, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return formatDate(target);
}

// Every local date the rule covers inside the window, in order.
export function seriesDates(rule: RepeatRule, window: DateWindow) {
  const start = rule.firstLocalDate > window.from ? rule.firstLocalDate : window.from;
  const end = rule.until && rule.until < window.to ? rule.until : window.to;
  if (start > end) return [];
  if (rule.kind === "NONE") return rule.firstLocalDate >= window.from && rule.firstLocalDate <= window.to ? [rule.firstLocalDate] : [];
  if (rule.kind === "WEEKLY" && rule.weekdays.length === 0) return [];
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (rule.kind === "DAILY" || rule.weekdays.includes(parseDate(date).getUTCDay())) dates.push(date);
  }
  return dates;
}

function zoneParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

// How far the zone is ahead of UTC at that instant, in milliseconds.
function zoneOffsetMs(instant: Date, timeZone: string) {
  const p = zoneParts(instant, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant.getTime() / 1000) * 1000;
}

// The instant at which the wall clock in `timeZone` shows this date and time.
export function zonedLocalToUtc(localDate: string, time: string, timeZone: string) {
  const [hour, minute] = time.split(":").map(Number);
  const [year, month, day] = localDate.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let instant = new Date(wall - zoneOffsetMs(new Date(wall), timeZone));
  // Near a daylight-saving change the first guess can use the wrong offset, so check it once more.
  const corrected = new Date(wall - zoneOffsetMs(instant, timeZone));
  if (corrected.getTime() !== instant.getTime()) instant = corrected;
  return instant;
}

export function localTimeInZone(instant: Date, timeZone: string) {
  const p = zoneParts(instant, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function localDateInZone(instant: Date, timeZone: string) {
  const p = zoneParts(instant, timeZone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// How many calendar days after the start day the event ends (0 for a same-day event).
export function eventSpanDays(startsAt: Date, endsAt: Date, timeZone: string) {
  return Math.round((parseDate(localDateInZone(endsAt, timeZone)).getTime() - parseDate(localDateInZone(startsAt, timeZone)).getTime()) / DAY_MS);
}

export type OccurrenceShape = { startLocal: string; endLocal: string; spanDays: number; timezone: string };

export function occurrenceTimes(localDate: string, shape: OccurrenceShape) {
  return {
    startsAt: zonedLocalToUtc(localDate, shape.startLocal, shape.timezone),
    endsAt: zonedLocalToUtc(addDays(localDate, shape.spanDays), shape.endLocal, shape.timezone),
  };
}

export type StoredOccurrence = { id: string; localDate: string; edited: boolean };

// What to do to the stored rows when a series changes. Occurrences before today are history and are left
// alone. One that was edited by hand is never changed or removed by a series change. Everything else in the
// future follows the new rule: it is updated when its date is still wanted and removed when it is not.
export function planSeriesChange({ existing, desiredDates, today }: { existing: StoredOccurrence[]; desiredDates: string[]; today: string }) {
  const desired = new Set(desiredDates);
  const held = new Set(existing.map((occurrence) => occurrence.localDate));
  const future = existing.filter((occurrence) => occurrence.localDate >= today && !occurrence.edited);
  return {
    create: desiredDates.filter((date) => date >= today && !held.has(date)),
    update: future.filter((occurrence) => desired.has(occurrence.localDate)).map((occurrence) => occurrence.id),
    remove: future.filter((occurrence) => !desired.has(occurrence.localDate)).map((occurrence) => occurrence.id),
  };
}
