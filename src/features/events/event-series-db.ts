import type { PrismaClient } from "@prisma/client";
import { buildSeriesPlan, type SeriesEvent } from "./event-series";
import { localDateInZone, type RepeatKind } from "./recurrence";

type EventRow = {
  id: string;
  repeatKind: RepeatKind;
  repeatWeekdays: number[];
  repeatUntil: string | null;
  firstLocalDate: string | null;
  startLocal: string | null;
  endLocal: string | null;
  spanDays: number;
  timezone: string;
};

export function seriesEventFrom(event: EventRow): SeriesEvent {
  return {
    repeatKind: event.repeatKind,
    repeatWeekdays: event.repeatWeekdays,
    repeatUntil: event.repeatUntil,
    firstLocalDate: event.firstLocalDate,
    startLocal: event.startLocal,
    endLocal: event.endLocal,
    spanDays: event.spanDays,
    timezone: event.timezone,
  };
}

// Adds the missing dates of every open-ended repeating event, so each keeps four months ahead. It only
// creates occurrences: nothing that exists is changed or removed. Safe to run twice.
export async function extendOpenEndedSeries(prisma: PrismaClient, now: Date) {
  const events = await prisma.churchEvent.findMany({
    where: { repeatKind: { not: "NONE" }, repeatUntil: null, firstLocalDate: { not: null }, status: { not: "CANCELLED" } },
    select: {
      id: true, repeatKind: true, repeatWeekdays: true, repeatUntil: true, firstLocalDate: true,
      startLocal: true, endLocal: true, spanDays: true, timezone: true,
      occurrences: { select: { id: true, localDate: true, edited: true } },
    },
  });
  let created = 0;
  for (const event of events) {
    const today = localDateInZone(now, event.timezone);
    const plan = buildSeriesPlan(seriesEventFrom(event), event.occurrences, today, { reshape: false });
    if (plan.create.length === 0) continue;
    const result = await prisma.churchEventOccurrence.createMany({
      data: plan.create.map((row) => ({ eventId: event.id, localDate: row.localDate, startsAt: row.startsAt, endsAt: row.endsAt })),
    });
    created += result.count;
  }
  return created;
}
