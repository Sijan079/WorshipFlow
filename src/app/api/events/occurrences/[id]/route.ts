import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requireEventsEdit } from "@/features/events/event-access";
import { UpdateOccurrenceSchema } from "@/features/events/event-validation";
import { localDateInZone } from "@/features/events/recurrence";

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
      select: { id: true, event: { select: { timezone: true } } },
    });
    if (!occurrence) return NextResponse.json({ error: "Event date not found." }, { status: 404 });

    const startsAt = input.startsAt ? new Date(input.startsAt) : undefined;
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
        edited: true,
      },
      select: { id: true, eventId: true, localDate: true, startsAt: true, endsAt: true, status: true, changeNote: true, registrationUrl: true, attendanceCount: true, edited: true },
    });
    return NextResponse.json({ ...updated, startsAt: updated.startsAt.toISOString(), endsAt: updated.endsAt.toISOString() });
  } catch (error: unknown) {
    return errorResponse(error, request, "Failed to save the event date.");
  }
}
