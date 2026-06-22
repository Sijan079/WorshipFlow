import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { UpdateServantSchema } from "@/lib/validation";
import type { ServantGender, ServantGroup } from "@prisma/client";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const servant = await prisma.servant.findUnique({
      where: { id, workspaceId },
    });

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

    const servant = await prisma.servant.findUnique({
      where: { id, workspaceId },
    });

    if (!servant) {
      return NextResponse.json({ error: "Servant not found" }, { status: 404 });
    }

    const updatedServant = await prisma.servant.update({
      where: { id, workspaceId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.gender !== undefined ? { gender: parsed.data.gender as ServantGender } : {}),
        ...(parsed.data.group !== undefined ? { group: parsed.data.group as ServantGroup } : {}),
      },
    });

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
    const servant = await prisma.servant.findUnique({
      where: { id, workspaceId },
    });

    if (!servant) {
      return NextResponse.json({ error: "Servant not found" }, { status: 404 });
    }

    await prisma.servant.delete({
      where: { id, workspaceId },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/servants/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to delete servant") }, { status: 500 });
  }
}
