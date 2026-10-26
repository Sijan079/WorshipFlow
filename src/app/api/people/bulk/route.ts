import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requirePeopleAction } from "@/features/people/people-access";

const BulkSchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(200),
    action: z.enum(["ARCHIVE", "ADD_TO_MINISTRY"]),
    ministryId: z.uuid().optional(),
  })
  .refine((value) => value.action !== "ADD_TO_MINISTRY" || Boolean(value.ministryId), "Choose a ministry.");

export async function POST(request: Request) {
  try {
    const { context } = await requirePeopleAction("EDIT");
    const parsed = BulkSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { ids, action, ministryId } = parsed.data;

    const people = await prisma.person.findMany({ where: { id: { in: ids }, workspaceId: context.workspaceId }, select: { id: true } });
    const personIds = people.map((person) => person.id);

    if (action === "ARCHIVE") {
      const result = await prisma.person.updateMany({
        where: { id: { in: personIds }, workspaceId: context.workspaceId },
        data: { status: "ARCHIVED", updatedByUserId: context.userId },
      });
      return NextResponse.json({ count: result.count });
    }

    const ministry = await prisma.ministry.findFirst({ where: { id: ministryId, workspaceId: context.workspaceId, serviceOnly: false }, select: { id: true } });
    if (!ministry) return NextResponse.json({ error: "Choose a ministry from this church." }, { status: 400 });
    const result = await prisma.personMinistry.createMany({
      data: personIds.map((personId) => ({ personId, ministryId: ministry.id })),
      skipDuplicates: true,
    });
    return NextResponse.json({ count: result.count });
  } catch (error: unknown) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    if (status === 500) reportRouteFailure(error, { route: "/api/people/bulk", method: "POST", status, request });
    return NextResponse.json({ error: status === 500 ? "Failed to update people." : (error as Error).message }, { status });
  }
}
