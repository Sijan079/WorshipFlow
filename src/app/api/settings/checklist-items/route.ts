import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { ChecklistItemPresetSchema } from "@/lib/settings-presets";
import { seedChecklistItemPresets } from "@/lib/settings-server";

export async function GET() {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    await seedChecklistItemPresets(prisma, workspaceId);

    const presets = await prisma.checklistItemPreset.findMany({
      where: { workspaceId },
      orderBy: [{ order: "asc" }, { label: "asc" }],
    });

    return NextResponse.json(presets);
  } catch (error: unknown) {
    console.error("GET /api/settings/checklist-items error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load checklist items") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    const parsed = ChecklistItemPresetSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const preset = await prisma.checklistItemPreset.create({
      data: { ...parsed.data, workspaceId, isDefault: false },
    });

    return NextResponse.json(preset, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/settings/checklist-items error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create checklist item") }, { status: 500 });
  }
}
