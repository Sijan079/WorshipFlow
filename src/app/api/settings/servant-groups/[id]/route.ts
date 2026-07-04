import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { UpdateEditablePresetSchema } from "@/lib/settings-presets";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const parsed = UpdateEditablePresetSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const preset = await prisma.servantGroupPreset.update({
      where: { id, workspaceId },
      data: parsed.data,
    });

    return NextResponse.json(preset);
  } catch (error: unknown) {
    console.error("PUT /api/settings/servant-groups/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update servant group preset") }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const preset = await prisma.servantGroupPreset.findUnique({ where: { id, workspaceId } });

    if (!preset) {
      return NextResponse.json({ error: "Servant group preset not found" }, { status: 404 });
    }

    if (preset.isDefault) {
      return NextResponse.json({ error: "Default servant group presets cannot be deleted" }, { status: 400 });
    }

    await prisma.servantGroupPreset.delete({ where: { id, workspaceId } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/settings/servant-groups/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to delete servant group preset") }, { status: 500 });
  }
}
