import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { UpdateChecklistPresetSchema } from "@/lib/settings-presets";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const parsed = UpdateChecklistPresetSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

    const preset = await prisma.checklistPreset.findFirst({
      where: { id, workspaceId },
      include: { items: { select: { id: true } } },
    });
    if (!preset) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });

    const existingIds = new Set(preset.items.map((item) => item.id));
    if (parsed.data.items.some((item) => item.id && !existingIds.has(item.id))) {
      return NextResponse.json({ error: "A checklist item does not belong to this checklist" }, { status: 400 });
    }

    const record = await prisma.$transaction(async (tx) => {
      const retainedIds = parsed.data.items.flatMap((item) => item.id ? [item.id] : []);
      await tx.checklistItemPreset.deleteMany({
        where: { checklistId: id, ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}) },
      });
      await Promise.all(parsed.data.items.map((item, order) => item.id
        ? tx.checklistItemPreset.update({
            where: { id: item.id, checklistId: id },
            data: { label: item.label, active: item.active, order },
          })
        : tx.checklistItemPreset.create({
            data: { checklistId: id, label: item.label, active: item.active, order },
          })));
      return tx.checklistPreset.update({
        where: { id, workspaceId },
        data: { name: parsed.data.name },
        include: { items: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
      });
    });
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { activeChecklistId: true } });
    return NextResponse.json({ ...record, isActive: record.id === workspace.activeChecklistId });
  } catch (error: unknown) {
    console.error("PUT /api/settings/checklists/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update checklist") }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const [preset, workspace] = await Promise.all([
      prisma.checklistPreset.findFirst({ where: { id, workspaceId }, select: { isDefault: true } }),
      prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { activeChecklistId: true } }),
    ]);
    if (!preset) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    if (preset.isDefault) return NextResponse.json({ error: "The default checklist cannot be deleted" }, { status: 400 });
    if (workspace.activeChecklistId === id) {
      return NextResponse.json({ error: "Show another checklist on the dashboard before deleting this one" }, { status: 400 });
    }
    await prisma.checklistPreset.delete({ where: { id, workspaceId } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/settings/checklists/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to delete checklist") }, { status: 500 });
  }
}
