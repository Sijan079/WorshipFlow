import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requirePeopleAction } from "@/features/people/people-access";
import { UpdateMinistrySchema } from "@/features/ministries/ministry-validation";
import { MINISTRY_SELECT, toMinistryRecord } from "@/features/ministries/ministry-record";

type RouteParams = { params: Promise<{ id: string }> };

function errorResponse(error: unknown, request: Request, fallback: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/ministries/[id]", method: "PATCH", status, request });
  return NextResponse.json({ error: status === 500 ? fallback : (error as Error).message }, { status });
}

// Ministries are archived (active: false), never deleted, so services keep their label.
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { context } = await requirePeopleAction("EDIT");
    const { id } = await params;
    const parsed = UpdateMinistrySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    const existing = await prisma.ministry.findFirst({ where: { id, workspaceId: context.workspaceId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Ministry not found." }, { status: 404 });

    if (input.leaderId) {
      const membership = await prisma.personMinistry.findFirst({
        where: { ministryId: id, personId: input.leaderId, person: { workspaceId: context.workspaceId } },
        select: { personId: true },
      });
      if (!membership) return NextResponse.json({ error: "The leader must be a member of this ministry." }, { status: 400 });
    }

    const updated = await prisma.ministry.update({
      where: { id },
      data: { label: input.label, active: input.active, leaderId: input.leaderId },
      select: MINISTRY_SELECT,
    });
    return NextResponse.json(toMinistryRecord(updated));
  } catch (error: unknown) {
    return errorResponse(error, request, "Failed to save the ministry.");
  }
}
