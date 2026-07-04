import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { UpdateServantSchema } from "@/lib/validation";
import { Prisma, type ServantGender, type ServantGroup } from "@prisma/client";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        workspaceId: string;
        name: string;
        gender: ServantGender | null;
        group: ServantGroup | null;
        groupCode: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT *
      FROM "Servant"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      LIMIT 1
    `);
    const servant = rows[0];

    if (!servant) {
      return NextResponse.json({ error: "Servant not found" }, { status: 404 });
    }

    return NextResponse.json(servant);
  } catch (error: unknown) {
    console.error("GET /api/servants/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load servant") }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const body = await request.json();
    const parsed = UpdateServantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const servantRows = await prisma.$queryRaw<
      Array<{
        id: string;
        workspaceId: string;
        name: string;
        gender: ServantGender | null;
        group: ServantGroup | null;
        groupCode: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT *
      FROM "Servant"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      LIMIT 1
    `);
    const servant = servantRows[0];

    if (!servant) {
      return NextResponse.json({ error: "Servant not found" }, { status: 404 });
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        workspaceId: string;
        name: string;
        gender: ServantGender | null;
        group: ServantGroup | null;
        groupCode: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      UPDATE "Servant"
      SET
        "name" = ${parsed.data.name ?? servant.name},
        "gender" = ${parsed.data.gender !== undefined ? parsed.data.gender : servant.gender},
        "group" = ${parsed.data.group !== undefined ? parsed.data.group : servant.group},
        "groupCode" = ${parsed.data.groupCode !== undefined ? parsed.data.groupCode : servant.groupCode},
        "updatedAt" = NOW()
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      RETURNING *
    `);

    const updatedServant = rows[0];

    return NextResponse.json(updatedServant);
  } catch (error: unknown) {
    console.error("PUT /api/servants/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update servant") }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const rows = await prisma.$queryRaw<
      Array<{ id: string }>
    >(Prisma.sql`
      SELECT "id"
      FROM "Servant"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      LIMIT 1
    `);
    const servant = rows[0];

    if (!servant) {
      return NextResponse.json({ error: "Servant not found" }, { status: 404 });
    }

    await prisma.$executeRaw(
      Prisma.sql`
        DELETE FROM "Servant"
        WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      `,
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/servants/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to delete servant") }, { status: 500 });
  }
}
