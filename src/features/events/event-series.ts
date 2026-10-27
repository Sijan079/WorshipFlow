// Turns an event's repeat rule into the occurrence rows it should have. Pure: the routes load the rows,
// ask for a plan here, and apply it, so the rules can be tested without a database.

import {
  eventSpanDays,
  localDateInZone,
  localTimeInZone,
  occurrenceTimes,
  openEndedHorizon,
  planSeriesChange,
  seriesDates,
  type RepeatKind,
  type StoredOccurrence,
} from "./recurrence.ts";

export type SeriesEvent = {
  repeatKind: RepeatKind;
  repeatWeekdays: number[];
  repeatUntil: string | null;
  firstLocalDate: string | null;
  startLocal: string | null;
  endLocal: string | null;
  spanDays: number;
  timezone: string;
};

export type PlannedOccurrence = { localDate: string; startsAt: Date; endsAt: Date };
export type PlannedUpdate = PlannedOccurrence & { id: string };
export type SeriesPlan = { create: PlannedOccurrence[]; update: PlannedUpdate[]; remove: string[] };

// The dates the rule covers. A bounded series covers all of them; an open-ended one only the next four
// months from today (but always at least its first date). Events made before the rule existed have no times
// to repeat, so they return null.
function wantedDates(event: SeriesEvent, today: string) {
  if (!event.firstLocalDate || !event.startLocal || !event.endLocal) return null;
  const horizon = openEndedHorizon(today);
  const last = event.repeatKind === "NONE" ? event.firstLocalDate : event.repeatUntil ?? (horizon < event.firstLocalDate ? event.firstLocalDate : horizon);
  return seriesDates(
    { kind: event.repeatKind, weekdays: event.repeatWeekdays, firstLocalDate: event.firstLocalDate, until: event.repeatUntil },
    { from: event.firstLocalDate, to: last },
  );
}

function plannedFor(event: SeriesEvent, localDate: string): PlannedOccurrence {
  const times = occurrenceTimes(localDate, { startLocal: event.startLocal!, endLocal: event.endLocal!, spanDays: event.spanDays, timezone: event.timezone });
  return { localDate, ...times };
}

// Every occurrence of a brand new event.
export function initialOccurrences(event: SeriesEvent, today: string): PlannedOccurrence[] {
  return (wantedDates(event, today) ?? []).map((date) => plannedFor(event, date));
}

// What to do to the stored rows. With `reshape` the future follows the rule (times updated, dropped dates
// removed); without it, only missing dates are added, which is how an open-ended series is extended.
export function buildSeriesPlan(event: SeriesEvent, existing: StoredOccurrence[], today: string, options: { reshape: boolean }): SeriesPlan {
  const dates = wantedDates(event, today);
  if (!dates) return { create: [], update: [], remove: [] };
  const plan = planSeriesChange({ existing, desiredDates: dates, today });
  const byId = new Map(existing.map((occurrence) => [occurrence.id, occurrence]));
  return {
    create: plan.create.map((date) => plannedFor(event, date)),
    update: options.reshape ? plan.update.map((id) => ({ id, ...plannedFor(event, byId.get(id)!.localDate) })) : [],
    remove: options.reshape ? plan.remove : [],
  };
}

// The first occurrence's start and end, read back as local times in the event's zone.
export function seriesShapeFromTimes(startsAtIso: string, endsAtIso: string, timezone: string) {
  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(endsAtIso);
  return {
    firstLocalDate: localDateInZone(startsAt, timezone),
    startLocal: localTimeInZone(startsAt, timezone),
    endLocal: localTimeInZone(endsAt, timezone),
    spanDays: eventSpanDays(startsAt, endsAt, timezone),
  };
}
