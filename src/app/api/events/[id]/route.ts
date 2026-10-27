import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requireEventsEdit } from "@/features/events/event-access";
import { UpdateEventSchema, shortestRepeatGap } from "@/features/events/event-validation";
import { buildSeriesPlan, seriesShapeFromTimes } from "@/features/events/event-series";
import { applySeriesPlan } from "@/features/events/event-series-apply";
import { addDays, localDateInZone } from "@/features/events/recurrence";

type RouteParams = { params: Promise<{ id: string }> };

function errorResponse(error: unknown, request: Request, fallback: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/events/[id]", method: "PATCH", status, request });
  return NextResponse.json({ error: status === 500 ? fallback : (error as Error).message }, { status });
}

// Changes the whole series: its details, public flag, repeat rule and times. Dates in the past, and dates
// that were changed by hand, are left alone; the rest of the future follows the new rule.
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const context = await requireEventsEdit();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const parsed = UpdateEventSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    const event = await prisma.churchEvent.findFirst({
      where: { id, workspaceId: context.workspaceId },
      include: { occurrences: { select: { id: true, localDate: true, edited: true, startsAt: true, endsAt: true }, orderBy: { startsAt: "asc" } } },
    });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    const changesSchedule = input.repeat !== undefined || input.firstLocalDate !== undefined || input.startLocal !== undefined || input.endLocal !== undefined || input.spanDays !== undefined;
    let schedule: ReturnType<typeof mergedSchedule> | null = null;
    if (changesSchedule) {
      schedule = mergedSchedule(event, input);
      if (!schedule) return NextResponse.json({ error: "Set the start and end time first." }, { status: 400 });
      const problem = scheduleProblem(schedule);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.churchEvent.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description === undefined ? undefined : input.description || null,
          venue: input.venue === undefined ? undefined : input.venue || null,
          isPublic: input.isPublic,
          ...(schedule ? {
            repeatKind: schedule.repeatKind,
            repeatWeekdays: schedule.repeatWeekdays,
            repeatUntil: schedule.repeatUntil,
            firstLocalDate: schedule.firstLocalDate,
            startLocal: schedule.startLocal,
            endLocal: schedule.endLocal,
            spanDays: schedule.spanDays,
          } : {}),
        },
      });
      if (schedule) {
        const today = localDateInZone(new Date(), event.timezone);
        const plan = buildSeriesPlan({ ...schedule, timezone: event.timezone }, event.occurrences, today, { reshape: true });
        await applySeriesPlan(tx, id, plan);
        return { id, created: plan.create.length, updated: plan.update.length, removed: plan.remove.length };
      }
      return { id, created: 0, updated: 0, removed: 0 };
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return errorResponse(error, request, "Failed to save the event.");
  }
}

type StoredEvent = {
  repeatKind: "NONE" | "DAILY" | "WEEKLY";
  repeatWeekdays: number[];
  repeatUntil: string | null;
  firstLocalDate: string | null;
  startLocal: string | null;
  endLocal: string | null;
  spanDays: number;
  timezone: string;
  occurrences: Array<{ startsAt: Date; endsAt: Date }>;
};

// The rule after the change. An event made before repeat rules existed has no stored times, so they are read
// from its first date; if there is nothing to read from, the change cannot be made.
function mergedSchedule(event: StoredEvent, input: z.infer<typeof UpdateEventSchema>) {
  const first = event.occurrences[0];
  const derived = event.startLocal && event.endLocal && event.firstLocalDate
    ? { firstLocalDate: event.firstLocalDate, startLocal: event.startLocal, endLocal: event.endLocal, spanDays: event.spanDays }
    : first ? seriesShapeFromTimes(first.startsAt.toISOString(), first.endsAt.toISOString(), event.timezone) : null;
  if (!derived) return null;
  const repeat = input.repeat;
  return {
    repeatKind: repeat ? repeat.kind : event.repeatKind,
    repeatWeekdays: repeat ? (repeat.kind === "WEEKLY" ? repeat.weekdays : []) : event.repeatWeekdays,
    repeatUntil: repeat ? (repeat.kind === "NONE" ? null : repeat.until) : event.repeatUntil,
    firstLocalDate: input.firstLocalDate ?? derived.firstLocalDate,
    startLocal: input.startLocal ?? derived.startLocal,
    endLocal: input.endLocal ?? derived.endLocal,
    spanDays: input.spanDays ?? derived.spanDays,
  };
}

function scheduleProblem(schedule: NonNullable<ReturnType<typeof mergedSchedule>>) {
  if (schedule.repeatKind === "NONE") return null;
  if (schedule.repeatUntil && schedule.repeatUntil < schedule.firstLocalDate) return "The last date must not be before the first.";
  if (schedule.repeatUntil && schedule.repeatUntil > addDays(schedule.firstLocalDate, 731)) return "A repeating event can run for up to two years. Leave the end empty for no end.";
  if (schedule.spanDays >= shortestRepeatGap({ kind: schedule.repeatKind, weekdays: schedule.repeatWeekdays })) return "The event is longer than the time between repeats.";
  return null;
}
