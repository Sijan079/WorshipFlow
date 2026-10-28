import type { Prisma } from "@prisma/client";
import type { AnnouncementItem } from "./post-types";

// What an announcement needs from the database, including the next date of a linked event.
export function announcementSelect(now: Date) {
  return {
    id: true, title: true, body: true, status: true, isPublic: true, timezone: true, startDate: true, endDate: true,
    eventId: true, facebookText: true, instagramText: true, createdAt: true, updatedAt: true,
    createdBy: { select: { displayName: true, email: true } },
    updatedBy: { select: { displayName: true, email: true } },
    event: {
      select: {
        id: true, title: true, timezone: true,
        occurrences: {
          where: { status: "SCHEDULED" as const, endsAt: { gte: now } },
          orderBy: { startsAt: "asc" as const },
          take: 1,
          select: { localDate: true, startsAt: true, endsAt: true },
        },
        _count: { select: { occurrences: { where: { status: "SCHEDULED" as const } } } },
      },
    },
  } satisfies Prisma.PostSelect;
}

type Row = Prisma.PostGetPayload<{ select: ReturnType<typeof announcementSelect> }>;

const person = (user: { displayName: string | null; email: string } | null) => (user ? user.displayName || user.email : null);

// Linked event details are shown only to people who may also view events.
export function serializeAnnouncement(row: Row, canViewEvents: boolean): AnnouncementItem {
  const next = row.event?.occurrences[0];
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    isPublic: row.isPublic,
    timezone: row.timezone,
    startDate: row.startDate,
    endDate: row.endDate,
    eventId: row.eventId,
    event: row.event && canViewEvents
      ? {
        id: row.event.id,
        title: row.event.title,
        next: next ? { localDate: next.localDate, startsAt: next.startsAt.toISOString(), endsAt: next.endsAt.toISOString(), timezone: row.event.timezone } : null,
        cancelled: !next && row.event._count.occurrences === 0,
      }
      : null,
    facebookText: row.facebookText,
    instagramText: row.instagramText,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: person(row.createdBy),
    updatedBy: person(row.updatedBy),
  };
}
