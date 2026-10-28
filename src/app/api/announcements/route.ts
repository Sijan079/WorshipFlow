import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hasModuleAction } from "@/lib/event-access";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { canPublishAnnouncements, requireAnnouncementAction } from "@/features/posts/post-access";
import { announcementSelect, serializeAnnouncement } from "@/features/posts/post-db";
import type { AnnouncementListResponse } from "@/features/posts/post-types";
import { CreateAnnouncementSchema } from "@/features/posts/post-validation";

function errorResponse(error: unknown, request: Request, method: string, fallback: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/announcements", method, status, request });
  return NextResponse.json({ error: status === 500 ? fallback : (error as Error).message }, { status });
}

const noStore = { "Cache-Control": "no-store" };

// Everyone with View sees every announcement of the church, drafts included: this list is internal. The
// public site will read through isPubliclyVisible and nothing else.
export async function GET(request: Request) {
  try {
    const context = await requireAnnouncementAction("VIEW");
    const now = new Date();
    const [rows, canCreate, canEdit, canDelete, canPublish, canViewEvents] = await Promise.all([
      prisma.post.findMany({
        where: { workspaceId: context.workspaceId, kind: "ANNOUNCEMENT" },
        orderBy: { createdAt: "desc" },
        select: announcementSelect(now),
      }),
      hasModuleAction(context, "ANNOUNCEMENTS", "CREATE"),
      hasModuleAction(context, "ANNOUNCEMENTS", "EDIT"),
      hasModuleAction(context, "ANNOUNCEMENTS", "DELETE"),
      canPublishAnnouncements(context),
      hasModuleAction(context, "EVENTS", "VIEW"),
    ]);
    const events = canViewEvents
      ? await prisma.churchEvent.findMany({ where: { workspaceId: context.workspaceId }, orderBy: { title: "asc" }, take: 300, select: { id: true, title: true } })
      : null;
    const body: AnnouncementListResponse = {
      items: rows.map((row) => serializeAnnouncement(row, canViewEvents)),
      canCreate, canEdit, canDelete, canPublish, events,
    };
    return NextResponse.json(body, { headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "GET", "Failed to load announcements.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAnnouncementAction("CREATE");
    const parsed = CreateAnnouncementSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    // Writing a draft needs Create. Publishing, or turning on the website switch, needs Publish as well.
    const canPublish = await canPublishAnnouncements(context);
    if (!canPublish && (input.status === "PUBLISHED" || input.isPublic)) {
      return NextResponse.json({ error: "Only people who can publish can publish or change the website setting." }, { status: 403 });
    }

    // A linked event must be one of this church's, and the person must be able to see events.
    if (input.eventId) {
      if (!(await hasModuleAction(context, "EVENTS", "VIEW"))) return NextResponse.json({ error: "You cannot link events." }, { status: 403 });
      const event = await prisma.churchEvent.findFirst({ where: { id: input.eventId, workspaceId: context.workspaceId }, select: { id: true } });
      if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const now = new Date();
    const created = await prisma.post.create({
      data: {
        workspaceId: context.workspaceId,
        kind: "ANNOUNCEMENT",
        title: input.title,
        body: input.body,
        status: input.status,
        isPublic: input.isPublic,
        timezone: input.timezone,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        eventId: input.eventId ?? null,
        facebookText: input.facebookText ?? null,
        instagramText: input.instagramText ?? null,
        createdById: context.userId,
        updatedById: context.userId,
      },
      select: announcementSelect(now),
    });
    return NextResponse.json(serializeAnnouncement(created, true), { status: 201, headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "POST", "Failed to save the announcement.");
  }
}
