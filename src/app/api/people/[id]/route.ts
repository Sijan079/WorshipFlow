import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requirePeopleAction } from "@/features/people/people-access";
import { serializePerson, parseDateOnly } from "@/features/people/person-serialization";
import { UpdatePersonSchema, resolveBaptism } from "@/features/people/person-validation";

type RouteParams = { params: Promise<{ id: string }> };

const PERSON_INCLUDE = { ministries: { select: { ministry: { select: { id: true, label: true } } } } } as const;

function errorResponse(error: unknown, request: Request, method: string, fallback: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/people/[id]", method, status, request });
  return NextResponse.json({ error: status === 500 ? fallback : (error as Error).message }, { status });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { context } = await requirePeopleAction("EDIT");
    const { id } = await params;
    const parsed = UpdatePersonSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    const existing = await prisma.person.findFirst({ where: { id, workspaceId: context.workspaceId }, select: { baptismStatus: true } });
    if (!existing) return NextResponse.json({ error: "Person not found." }, { status: 404 });

    const baptism = resolveBaptism(existing.baptismStatus, { baptismStatus: input.baptismStatus, baptismDate: input.baptismDate });
    if (!baptism.ok) return NextResponse.json({ error: { fieldErrors: { baptismDate: [baptism.error] } } }, { status: 400 });

    if (input.ministryIds) {
      const ministries = await prisma.ministry.findMany({ where: { id: { in: input.ministryIds }, workspaceId: context.workspaceId }, select: { id: true } });
      if (ministries.length !== input.ministryIds.length) {
        return NextResponse.json({ error: "Choose ministries from this church." }, { status: 400 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.ministryIds) {
        await tx.personMinistry.deleteMany({ where: { personId: id } });
        await tx.personMinistry.createMany({ data: input.ministryIds.map((ministryId) => ({ personId: id, ministryId })) });
      }
      return tx.person.update({
        where: { id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          status: input.status,
          gender: input.gender,
          birthdate: input.birthdate === undefined ? undefined : parseDateOnly(input.birthdate),
          baptismStatus: baptism.baptismStatus,
          baptismDate: baptism.baptismDate === undefined ? undefined : parseDateOnly(baptism.baptismDate),
          updatedByUserId: context.userId,
        },
        include: PERSON_INCLUDE,
      });
    });
    const users = await prisma.user.findMany({
      where: { id: { in: [updated.createdByUserId, updated.updatedByUserId].filter((value): value is string => Boolean(value)) } },
      select: { id: true, displayName: true, email: true },
    });
    return NextResponse.json(serializePerson(updated, new Map(users.map((user) => [user.id, user.displayName || user.email]))));
  } catch (error: unknown) {
    return errorResponse(error, request, "PATCH", "Failed to save the person.");
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { context } = await requirePeopleAction("DELETE");
    const { id } = await params;
    const existing = await prisma.person.findFirst({ where: { id, workspaceId: context.workspaceId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Person not found." }, { status: 404 });
    await prisma.person.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return errorResponse(error, request, "DELETE", "Failed to delete the person.");
  }
}
