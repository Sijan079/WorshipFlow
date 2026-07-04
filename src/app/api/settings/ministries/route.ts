import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { EditablePresetSchema } from "@/lib/settings-presets";
import { seedMinistryPresets } from "@/lib/settings-server";

export async function GET() {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    await seedMinistryPresets(prisma, workspaceId);

    const presets = await prisma.ministryPreset.findMany({
      where: { workspaceId },
      orderBy: [{ label: "asc" }, { code: "asc" }],
    });

    return NextResponse.json(presets);
  } catch (error: unknown) {
    console.error("GET /api/settings/ministries error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load ministry presets") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    const parsed = EditablePresetSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const preset = await prisma.ministryPreset.create({
      data: { ...parsed.data, workspaceId, isDefault: false },
    });

    return NextResponse.json(preset, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/settings/ministries error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create ministry preset") }, { status: 500 });
  }
}
