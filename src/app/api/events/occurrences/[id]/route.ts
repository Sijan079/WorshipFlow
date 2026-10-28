import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requireEventsEdit } from "@/features/events/event-access";
import { UpdateOccurrenceSchema } from "@/features/events/event-validation";
import { eventSpanDays, localDateInZone, localTimeInZone } from "@/features/events/recurrence";

type RouteParams = { params: Promise<{ id: string }> };

function errorResponse(error: unknown, request: Request, fallback: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/events/occurrences/[id]", method: "PATCH", status, request });
  return NextResponse.json({ error: status === 500 ? fallback : (error as Error).message }, { status });
}

// Changes, cancels or restores one date of an event. The date is marked as edited, so a later change to the
// whole series leaves it exactly as it is.
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const context = await requireEventsEdit();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Event date not found." }, { status: 404 });
    const parsed = UpdateOccurrenceSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    const occurrence = await prisma.churchEventOccurrence.findFirst({
      where: { id, event: { workspaceId: context.workspaceId } },
      select: { id: true, eventId: true, status: true, doneAt: true, startsAt: true, event: { select: { timezone: true, repeatKind: true } } },
    });
    if (!occurrence) return NextResponse.json({ error: "Event date not found." }, { status: 404 });

    // Done is for one-time events that have started and are still scheduled; a date is never both done and
    // cancelled, so one is undone before the other is set.
    if (input.done === true) {
      if (occurrence.event.repeatKind !== "NONE") return NextResponse.json({ error: "Only one-time events can be marked done." }, { status: 409 });
      if (occurrence.status === "CANCELLED") return NextResponse.json({ error: "This event is cancelled. Restore it first." }, { status: 409 });
      if (occurrence.startsAt > new Date()) return NextResponse.json({ error: "This event has not started yet." }, { status: 409 });
    }
    if (input.status === "CANCELLED" && occurrence.doneAt && input.done !== false) {
      return NextResponse.json({ error: "Mark it not done first." }, { status: 409 });
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : undefined;
    // Marking done or recording attendance does not count as changing the date, so it gets no "Changed" tag.
    const touchesSchedule = input.startsAt !== undefined || input.endsAt !== undefined || input.status !== undefined || input.changeNote !== undefined || input.registrationUrl !== undefined;
    const updated = await prisma.churchEventOccurrence.update({
      where: { id },
      data: {
        startsAt,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
        localDate: startsAt ? localDateInZone(startsAt, occurrence.event.timezone) : undefined,
        status: input.status,
        changeNote: input.changeNote === undefined ? undefined : input.changeNote || null,
        registrationUrl: input.registrationUrl === undefined ? undefined : input.registrationUrl,
        registrationProvider: input.registrationUrl === undefined ? undefined : input.registrationUrl ? "OTHER" : null,
        attendanceCount: input.attendanceCount,
        doneAt: input.done === undefined ? undefined : input.done ? new Date() : null,
        edited: touchesSchedule ? true : undefined,
      },
      select: { id: true, eventId: true, localDate: true, startsAt: true, endsAt: true, status: true, doneAt: true, changeNote: true, registrationUrl: true, attendanceCount: true, edited: true },
    });
    // A one-time event keeps its saved first date, times and length next to the date itself, so they follow it.
    if (occurrence.event.repeatKind === "NONE" && input.startsAt && input.endsAt) {
      const zone = occurrence.event.timezone;
      await prisma.churchEvent.update({
        where: { id: occurrence.eventId },
        data: {
          firstLocalDate: updated.localDate,
          startLocal: localTimeInZone(updated.startsAt, zone),
          endLocal: localTimeInZone(updated.endsAt, zone),
          spanDays: eventSpanDays(updated.startsAt, updated.endsAt, zone),
        },
      });
    }
    return NextResponse.json({ ...updated, startsAt: updated.startsAt.toISOString(), endsAt: updated.endsAt.toISOString(), doneAt: updated.doneAt?.toISOString() ?? null });
  } catch (error: unknown) {
    return errorResponse(error, request, "Failed to save the event date.");
  }
}
