import type { UsagePoint } from "./caption-usage";

// One bar of a usage chart (an hour or a day), with what to print under it and in its tooltip. `text` is
// the tooltip's value line when it says more than the bar's number.
// `key` names the bar across views (the same day has the same key in the week and the month), and `parent`
// is the bar that holds it in a coarser view (an hour is held by its day), so the chart can zoom between them.
export type UsageBucket = { key: string; parent?: string; axis: string; tooltip: string; value: number | null; text?: string; future: boolean };
export type UsageView = "day" | "week" | "month";

// One Deepgram stream: when it started (ms), how long it ran (seconds), and what it cost (USD).
export type DeepgramRequest = [startedMs: number, seconds: number, usd: number];

const DAY_MS = 86_400_000;
const keyOf = (time: number) => new Date(time).toISOString().slice(0, 10);
const pad = (value: number) => String(value).padStart(2, "0");
const localDayKey = (date: Date) => `d:${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function dayLabel(key: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: "UTC", ...options });
}

// Every day of the UTC month that `monthStart` falls in (the Azure chart). With `quietIsZero`, a day with no
// row is 0; without it the bar is empty.
export function dayBuckets(monthStart: string, points: UsagePoint[], today: string, quietIsZero: boolean): UsageBucket[] {
  const first = new Date(monthStart);
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const byDay = new Map(points.map((point) => [point.day, point.value]));
  const shown = new Set([1, 5, 10, 15, 20, 25, count]);
  return Array.from({ length: count }, (_, index) => {
    const key = keyOf(first.getTime() + index * DAY_MS);
    return { key: `d:${key}`, axis: shown.has(index + 1) ? String(index + 1) : "", tooltip: dayLabel(key, { month: "long", day: "numeric", year: "numeric" }), value: byDay.get(key) ?? (quietIsZero ? 0 : null), future: key > today };
  });
}

type Frame = { key: string; parent?: string; axis: string; tooltip: string; startMs: number; endMs: number };

// Local midnight of the day `offset` calendar days from `at`, so a clock change cannot skip a day.
const localDay = (at: Date, offset: number) => new Date(at.getFullYear(), at.getMonth(), at.getDate() + offset);

function frames(view: UsageView, now: Date): Frame[] {
  if (view === "day") {
    const midnight = localDay(now, 0);
    return Array.from({ length: 24 }, (_, hour) => {
      const start = new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate(), hour);
      const end = new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate(), hour + 1);
      const clock = (value: Date) => value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return { key: `h:${localDayKey(start).slice(2)}T${pad(hour)}`, parent: localDayKey(start), axis: hour % 6 === 0 ? start.toLocaleTimeString([], { hour: "numeric" }).replace(/\s/g, "").toLowerCase() : "", tooltip: `${start.toLocaleDateString([], { month: "long", day: "numeric" })}, ${clock(start)} to ${clock(end)}`, startMs: start.getTime(), endMs: end.getTime() };
    });
  }
  if (view === "week") {
    const sunday = localDay(now, -now.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const start = localDay(sunday, index);
      return { key: localDayKey(start), axis: start.toLocaleDateString([], { weekday: "short" }), tooltip: start.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }), startMs: start.getTime(), endMs: localDay(sunday, index + 1).getTime() };
    });
  }
  const count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const shown = new Set([1, 5, 10, 15, 20, 25, count]);
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth(), index + 1);
    return { key: localDayKey(start), axis: shown.has(index + 1) ? String(index + 1) : "", tooltip: start.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }), startMs: start.getTime(), endMs: new Date(now.getFullYear(), now.getMonth(), index + 2).getTime() };
  });
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Deepgram consumption in local time: a day by the hour (12am to midnight), a week by the day (Sunday to
// Saturday), a month by the day. A stream that runs across several hours or days is shared out in
// proportion, so a three-hour service does not land all in the hour it began. The value is minutes of
// audio, and the tooltip also gives the cost.
// What the streams (or records) in `requests` add up to within one stretch of time, each shared out by how
// much of it falls inside.
function shareOut(requests: DeepgramRequest[], startMs: number, endMs: number) {
  let seconds = 0;
  let amount = 0;
  for (const [startedMs, length, cost] of requests) {
    const endedMs = startedMs + length * 1000;
    const overlap = Math.min(endedMs, endMs) - Math.max(startedMs, startMs);
    if (overlap <= 0 || endedMs <= startedMs) continue;
    const share = overlap / (endedMs - startedMs);
    seconds += length * share;
    amount += cost * share;
  }
  return { seconds, amount };
}

export function deepgramBuckets(view: UsageView, requests: DeepgramRequest[], now = new Date()): UsageBucket[] {
  return frames(view, now).map(({ startMs, endMs, ...frame }) => {
    const { seconds, amount: usd } = shareOut(requests, startMs, endMs);
    const minutes = seconds / 60;
    const future = startMs > now.getTime();
    return { ...frame, value: future ? null : minutes, text: future ? undefined : `${minutes > 0 && minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)} min · ${money.format(usd)}`, future };
  });
}

export function viewRangeLabel(view: UsageView, now = new Date()) {
  if (view === "day") return now.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
  if (view === "month") return now.toLocaleDateString([], { month: "long", year: "numeric" });
  const sunday = localDay(now, -now.getDay());
  return `${sunday.toLocaleDateString([], { month: "short", day: "numeric" })} to ${localDay(sunday, 6).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
}

// Translated characters for each hour of today in local time, from per-hour records (UTC hours). An hour that
// straddles two local hours (a half-hour time zone) is shared out between them. Same keys as the Deepgram
// day view, so the two behave alike.
export function azureHourBuckets(hourly: Array<[hourMs: number, characters: number]>, now = new Date()): UsageBucket[] {
  const records = hourly.map(([hourMs, characters]) => [hourMs, 3600, characters] as DeepgramRequest);
  return frames("day", now).map(({ startMs, endMs, ...frame }) => {
    const future = startMs > now.getTime();
    return { ...frame, value: future ? null : shareOut(records, startMs, endMs).amount, future };
  });
}

// The week (Sunday to Saturday, UTC) that `today` falls in, from per-day rows. Its days have the same keys as
// the month view's, so the chart can zoom between them.
export function utcWeekBuckets(points: UsagePoint[], today: string): UsageBucket[] {
  const now = new Date(`${today}T00:00:00Z`).getTime();
  const sunday = now - new Date(now).getUTCDay() * DAY_MS;
  const byDay = new Map(points.map((point) => [point.day, point.value]));
  return Array.from({ length: 7 }, (_, index) => {
    const key = keyOf(sunday + index * DAY_MS);
    return { key: `d:${key}`, axis: dayLabel(key, { weekday: "short" }), tooltip: dayLabel(key, { weekday: "long", month: "long", day: "numeric", year: "numeric" }), value: byDay.get(key) ?? 0, future: key > today };
  });
}

export function utcWeekRangeLabel(today: string) {
  const now = new Date(`${today}T00:00:00Z`).getTime();
  const sunday = now - new Date(now).getUTCDay() * DAY_MS;
  return `${dayLabel(keyOf(sunday), { month: "short", day: "numeric" })} to ${dayLabel(keyOf(sunday + 6 * DAY_MS), { month: "short", day: "numeric", year: "numeric" })} (UTC)`;
}

// 1,950,000 becomes 1.9M (cut, not rounded up, so a "left" figure is never overstated); smaller numbers keep
// their commas.
export function shortCount(value: number) {
  if (value < 1_000_000) return new Intl.NumberFormat("en-US").format(value);
  return `${(Math.floor(value / 100_000) / 10).toFixed(1)}M`;
}
