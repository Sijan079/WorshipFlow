import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requirePeopleAction } from "@/features/people/people-access";
import { serializePerson, parseDateOnly } from "@/features/people/person-serialization";
import { CreatePersonSchema, PERSON_STATUSES, comparePeople } from "@/features/people/person-validation";
import type { PeopleListResponse } from "@/features/people/person-types";

const PERSON_INCLUDE = { ministries: { select: { ministry: { select: { id: true, label: true } } } } } as const;

function errorResponse(error: unknown, request: Request, method: string, fallback: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/people", method, status, request });
  return NextResponse.json({ error: status === 500 ? fallback : (error as Error).message }, { status });
}

async function userNameMap(userIds: Array<string | null>) {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return new Map<string, string>();
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, email: true } });
  return new Map(users.map((user) => [user.id, user.displayName || user.email]));
}

export async function GET(request: Request) {
  try {
    const { context, permissions } = await requirePeopleAction("VIEW");
    const params = new URL(request.url).searchParams;
    const search = params.get("search")?.trim() ?? "";
    const status = params.get("status") ?? "active";
    const ministryId = params.get("ministryId") ?? "";

    const where: Prisma.PersonWhereInput = { workspaceId: context.workspaceId };
    if (status === "active") where.status = { not: "ARCHIVED" };
    else if ((PERSON_STATUSES as readonly string[]).includes(status)) where.status = status as (typeof PERSON_STATUSES)[number];
    if (ministryId) where.ministries = { some: { ministryId } };
    if (search) {
      where.AND = search.split(" ").filter(Boolean).slice(0, 5).map((token) => ({
        OR: [
          { firstName: { contains: token, mode: "insensitive" } },
          { lastName: { contains: token, mode: "insensitive" } },
        ],
      }));
    }

    const rows = await prisma.person.findMany({ where, include: PERSON_INCLUDE });
    const names = await userNameMap(rows.flatMap((row) => [row.createdByUserId, row.updatedByUserId]));
    const items = rows.map((row) => serializePerson(row, names)).sort(comparePeople);
    const body: PeopleListResponse = { items, permissions };
    return NextResponse.json(body);
  } catch (error: unknown) {
    return errorResponse(error, request, "GET", "Failed to load people.");
  }
}

export async function POST(request: Request) {
  try {
    const { context } = await requirePeopleAction("CREATE");
    const parsed = CreatePersonSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    const ministries = await prisma.ministry.findMany({ where: { id: { in: input.ministryIds }, workspaceId: context.workspaceId }, select: { id: true } });
    if (ministries.length !== input.ministryIds.length) {
      return NextResponse.json({ error: "Choose ministries from this church." }, { status: 400 });
    }

    const created = await prisma.person.create({
      data: {
        workspaceId: context.workspaceId,
        firstName: input.firstName,
        lastName: input.lastName,
        status: input.status,
        gender: input.gender ?? null,
        birthdate: parseDateOnly(input.birthdate),
        baptismStatus: input.baptismStatus,
        baptismDate: parseDateOnly(input.baptismDate),
        createdByUserId: context.userId,
        updatedByUserId: context.userId,
        ministries: { create: input.ministryIds.map((ministryId) => ({ ministryId })) },
      },
      include: PERSON_INCLUDE,
    });
    const names = await userNameMap([created.createdByUserId, created.updatedByUserId]);
    return NextResponse.json(serializePerson(created, names), { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error, request, "POST", "Failed to add the person.");
  }
}
