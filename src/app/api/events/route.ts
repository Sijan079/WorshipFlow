import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requireEventAction } from "@/lib/event-access";
import { CreateEventSchema, EventRangeSchema } from "@/features/events/event-validation";
import type { EventOccurrenceSummary } from "@/features/events/event-types";
import { initialOccurrences, seriesShapeFromTimes } from "@/features/events/event-series";
import { localDateInZone } from "@/features/events/recurrence";
import { resolveModuleAction } from "@/lib/module-access";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof WorkspaceAuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const context = await requireEventAction("EVENTS", "VIEW");
    const url = new URL(request.url);
    const range = EventRangeSchema.safeParse({ from: url.searchParams.get("from"), to: url.searchParams.get("to") });
    if (!range.success) return NextResponse.json({ error: "Select a valid date range of up to 93 days." }, { status: 400 });

    const [occurrences, createGrant, createDefault] = await Promise.all([
      prisma.churchEventOccurrence.findMany({
        where: {
          localDate: { gte: range.data.from, lte: range.data.to },
          event: { workspaceId: context.workspaceId },
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        include: { event: { select: { title: true, description: true, venue: true, timezone: true, isPublic: true, repeatKind: true } } },
      }),
      context.role === "MEMBER"
        ? prisma.workspaceActionGrant.findUnique({
            where: {
              workspaceId_userId_module_action: {
                workspaceId: context.workspaceId,
                userId: context.userId,
                module: "EVENTS",
                action: "CREATE",
              },
            },
            select: { allowed: true },
          })
        : Promise.resolve(null),
      context.role === "MEMBER"
        ? prisma.workspaceRoleActionDefault.findUnique({
            where: { workspaceId_role_module_action: { workspaceId: context.workspaceId, role: "MEMBER", module: "EVENTS", action: "CREATE" } },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    const items: EventOccurrenceSummary[] = occurrences.map((occurrence) => ({
      id: occurrence.id,
      eventId: occurrence.eventId,
      title: occurrence.event.title,
      description: occurrence.event.description,
      venue: occurrence.event.venue,
      timezone: occurrence.event.timezone,
      isPublic: occurrence.event.isPublic,
      repeats: occurrence.event.repeatKind !== "NONE",
      edited: occurrence.edited,
      localDate: occurrence.localDate,
      startsAt: occurrence.startsAt.toISOString(),
      endsAt: occurrence.endsAt.toISOString(),
      registrationUrl: occurrence.registrationUrl,
      responseCount: occurrence.responseCount,
      yesCount: occurrence.yesCount,
      noCount: occurrence.noCount,
      attendanceCount: occurrence.attendanceCount,
      status: occurrence.status,
      conflict: occurrences.some((other) => other.id !== occurrence.id && other.status === "SCHEDULED" && occurrence.status === "SCHEDULED" && other.startsAt < occurrence.endsAt && other.endsAt > occurrence.startsAt),
    }));

    return NextResponse.json({ items, canCreate: resolveModuleAction(context.role, Boolean(createDefault), createGrant?.allowed ?? null) });
  } catch (error: unknown) {
    return errorResponse(error, "Failed to load events.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireEventAction("EVENTS", "CREATE");
    const parsed = CreateEventSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const input = parsed.data;
    const repeat = input.repeat ?? { kind: "NONE" as const, weekdays: [], until: null };
    const shape = seriesShapeFromTimes(input.startsAt, input.endsAt, input.timezone);
    const rule = {
      repeatKind: repeat.kind,
      repeatWeekdays: repeat.kind === "WEEKLY" ? repeat.weekdays : [],
      repeatUntil: repeat.kind === "NONE" ? null : repeat.until,
      ...shape,
      timezone: input.timezone,
    };
    // A one-off keeps the exact times it was entered with. A repeating series builds every date from the
    // local times, so each date stays at the same wall-clock time through daylight saving.
    const rows = repeat.kind === "NONE"
      ? [{ localDate: input.localDate, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) }]
      : initialOccurrences(rule, localDateInZone(new Date(), input.timezone));
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.churchEvent.create({
        data: {
          workspaceId: context.workspaceId,
          title: input.title,
          description: input.description || null,
          venue: input.venue || null,
          timezone: input.timezone,
          status: "CONFIRMED",
          isPublic: input.isPublic,
          repeatKind: rule.repeatKind,
          repeatWeekdays: rule.repeatWeekdays,
          repeatUntil: rule.repeatUntil,
          firstLocalDate: shape.firstLocalDate,
          startLocal: shape.startLocal,
          endLocal: shape.endLocal,
          spanDays: shape.spanDays,
        },
        select: { id: true },
      });
      await tx.churchEventOccurrence.createMany({
        data: rows.map((row) => ({
          eventId: created.id,
          localDate: row.localDate,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          registrationUrl: input.registrationUrl || null,
          registrationProvider: input.registrationUrl ? ("OTHER" as const) : null,
        })),
      });
      return created;
    });
    return NextResponse.json({ ...event, occurrences: rows.length }, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error, "Failed to create event.");
  }
}
