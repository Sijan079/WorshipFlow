import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { ServantSchema } from "@/lib/validation";
import { Prisma, type ServantGender, type ServantGroup } from "@prisma/client";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const group = searchParams.get("group")?.trim() ?? "";

    const servants = await prisma.$queryRaw<
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
      WHERE "workspaceId" = ${workspaceId}
        ${group ? Prisma.sql`AND ("group" = ${group as ServantGroup} OR "groupCode" = ${group})` : Prisma.empty}
        ${search ? Prisma.sql`AND "name" ILIKE ${`%${search}%`}` : Prisma.empty}
      ORDER BY "name" ASC, "createdAt" DESC
    `);

    return NextResponse.json(servants);
  } catch (error: unknown) {
    console.error("GET /api/servants error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load servants") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    const body = await request.json();
    const parsed = z.union([ServantSchema, z.array(ServantSchema)]).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const payloads = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
    const servants = await Promise.all(
      payloads.map((entry) =>
        prisma.$queryRaw<
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
          INSERT INTO "Servant" ("id", "workspaceId", "name", "gender", "group", "groupCode", "createdAt", "updatedAt")
          VALUES (${crypto.randomUUID()}, ${workspaceId}, ${entry.name}, ${entry.gender ?? null}, ${entry.group ?? null}, ${entry.groupCode ?? entry.group ?? null}, NOW(), NOW())
          RETURNING *
        `).then((rows) => rows[0]),
      ),
    );

    return NextResponse.json(Array.isArray(parsed.data) ? servants : servants[0], { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/servants error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create servant") }, { status: 500 });
  }
}
