import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { ActivateChecklistPresetSchema, CreateChecklistPresetSchema } from "@/lib/settings-presets";
import { seedChecklistPresets } from "@/lib/settings-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    await seedChecklistPresets(prisma, workspaceId);
    const [workspace, records] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { activeChecklistId: true } }),
      prisma.checklistPreset.findMany({
        where: { workspaceId },
        include: { items: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      }),
    ]);
    return NextResponse.json(records.map((record) => ({
      ...record,
      isActive: record.id === workspace.activeChecklistId,
    })));
  } catch (error: unknown) {
    console.error("GET /api/settings/checklists error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load checklists") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    const parsed = CreateChecklistPresetSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

    const record = await prisma.checklistPreset.create({
      data: { workspaceId, name: parsed.data.name },
      include: { items: true },
    });
    return NextResponse.json({ ...record, isActive: false }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/settings/checklists error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create checklist") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    const parsed = ActivateChecklistPresetSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

    const preset = await prisma.checklistPreset.findFirst({
      where: { id: parsed.data.checklistId, workspaceId },
      select: { id: true },
    });
    if (!preset) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });

    await prisma.workspace.update({ where: { id: workspaceId }, data: { activeChecklistId: preset.id } });
    return NextResponse.json({ checklistId: preset.id });
  } catch (error: unknown) {
    console.error("PATCH /api/settings/checklists error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to activate checklist") }, { status: 500 });
  }
}
