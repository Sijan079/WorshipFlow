import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requirePeopleAction } from "@/features/people/people-access";
import { CreateMinistrySchema, ministryCodeFromLabel } from "@/features/ministries/ministry-validation";
import type { MinistryListResponse } from "@/features/ministries/ministry-types";
import { MINISTRY_SELECT, toMinistryRecord } from "@/features/ministries/ministry-record";

function errorResponse(error: unknown, request: Request, method: string, fallback: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/ministries", method, status, request });
  return NextResponse.json({ error: status === 500 ? fallback : (error as Error).message }, { status });
}

export async function GET(request: Request) {
  try {
    const { context, permissions } = await requirePeopleAction("VIEW");
    const rows = await prisma.ministry.findMany({
      where: { workspaceId: context.workspaceId },
      select: MINISTRY_SELECT,
      orderBy: { label: "asc" },
    });
    const body: MinistryListResponse = { items: rows.map(toMinistryRecord), permissions: { canEdit: permissions.canEdit } };
    return NextResponse.json(body);
  } catch (error: unknown) {
    return errorResponse(error, request, "GET", "Failed to load ministries.");
  }
}

export async function POST(request: Request) {
  try {
    const { context } = await requirePeopleAction("EDIT");
    const parsed = CreateMinistrySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const existing = await prisma.ministry.findMany({ where: { workspaceId: context.workspaceId }, select: { code: true } });
    const code = ministryCodeFromLabel(parsed.data.label, existing.map((ministry) => ministry.code));
    const created = await prisma.ministry.create({
      data: { workspaceId: context.workspaceId, code, label: parsed.data.label },
      select: MINISTRY_SELECT,
    });
    return NextResponse.json(toMinistryRecord(created), { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error, request, "POST", "Failed to add the ministry.");
  }
}
