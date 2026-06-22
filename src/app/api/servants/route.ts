import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { ServantSchema } from "@/lib/validation";
import type { ServantGender, ServantGroup } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const group = searchParams.get("group")?.trim() ?? "";

    const servants = await prisma.servant.findMany({
      where: {
        workspaceId,
        ...(group ? { group: group as ServantGroup } : {}),
        ...(search
          ? {
              name: {
                contains: search,
                mode: "insensitive",
              },
            }
          : {}),
      },
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    });

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
    const parsed = ServantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const servant = await prisma.servant.create({
      data: {
        workspaceId,
        name: parsed.data.name,
        gender: parsed.data.gender as ServantGender,
        group: parsed.data.group as ServantGroup,
      },
    });

    return NextResponse.json(servant, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/servants error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create servant") }, { status: 500 });
  }
}
