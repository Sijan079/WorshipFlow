import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { hasModuleAction } from "@/lib/event-access";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { canPublishAnnouncements, requireAnnouncementAction } from "@/features/posts/post-access";
import { announcementSelect, serializeAnnouncement } from "@/features/posts/post-db";
import { decideAnnouncementUpdate } from "@/features/posts/post-rules";
import { UpdateAnnouncementSchema } from "@/features/posts/post-validation";

type RouteParams = { params: Promise<{ id: string }> };

function errorResponse(error: unknown, request: Request, method: string, fallback: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/announcements/[id]", method, status, request });
  return NextResponse.json({ error: status === 500 ? fallback : (error as Error).message }, { status });
}

const noStore = { "Cache-Control": "no-store" };

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const context = await requireAnnouncementAction("EDIT");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    const parsed = UpdateAnnouncementSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    const existing = await prisma.post.findFirst({
      where: { id, workspaceId: context.workspaceId, kind: "ANNOUNCEMENT" },
      select: { status: true, isPublic: true, startDate: true, endDate: true },
    });
    if (!existing) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });

    // The dates are checked as they will be after the change, not just as sent.
    const startDate = input.startDate === undefined ? existing.startDate : input.startDate;
    const endDate = input.endDate === undefined ? existing.endDate : input.endDate;
    if (startDate && endDate && endDate < startDate) return NextResponse.json({ error: "The end date cannot be before the start date." }, { status: 400 });

    const decision = decideAnnouncementUpdate({ existing, input, canPublish: await canPublishAnnouncements(context) });
    if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: 403 });

    const canViewEvents = await hasModuleAction(context, "EVENTS", "VIEW");
    if (input.eventId) {
      if (!canViewEvents) return NextResponse.json({ error: "You cannot link events." }, { status: 403 });
      const event = await prisma.churchEvent.findFirst({ where: { id: input.eventId, workspaceId: context.workspaceId }, select: { id: true } });
      if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const updated = await prisma.post.updateMany({
      where: { id, workspaceId: context.workspaceId, kind: "ANNOUNCEMENT" },
      data: {
        title: input.title,
        body: input.body,
        startDate: input.startDate,
        endDate: input.endDate,
        eventId: input.eventId,
        facebookText: input.facebookText,
        instagramText: input.instagramText,
        isPublic: input.isPublic,
        status: decision.status ?? input.status,
        updatedById: context.userId,
      },
    });
    if (updated.count === 0) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    const row = await prisma.post.findFirstOrThrow({
      where: { id, workspaceId: context.workspaceId, kind: "ANNOUNCEMENT" },
      select: announcementSelect(new Date()),
    });
    return NextResponse.json({ ...serializeAnnouncement(row, canViewEvents), sentBackToDraft: decision.sentBackToDraft }, { headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "PATCH", "Failed to save the announcement.");
  }
}

// Only a draft can be deleted. The rule is part of the delete itself, so it holds even if someone publishes
// the announcement a moment earlier. A published one is set back to Draft first.
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const context = await requireAnnouncementAction("DELETE");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    const removed = await prisma.post.deleteMany({ where: { id, workspaceId: context.workspaceId, kind: "ANNOUNCEMENT", status: "DRAFT" } });
    if (removed.count === 0) {
      const exists = await prisma.post.findFirst({ where: { id, workspaceId: context.workspaceId, kind: "ANNOUNCEMENT" }, select: { id: true } });
      if (!exists) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
      return NextResponse.json({ error: "Set the announcement back to Draft before deleting it." }, { status: 409 });
    }
    return NextResponse.json({ deleted: true }, { headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "DELETE", "Failed to delete the announcement.");
  }
}
