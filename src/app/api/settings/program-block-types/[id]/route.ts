import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { requireExplicitWorkspaceRole } from "@/lib/security-context";
import {
  ProgramBlockTypePayloadSchema,
  ProgramBlockVersionPayloadSchema,
  getProgramBlockTypeDeleteError,
  normalizeProgramBlockDefinition,
} from "@/lib/program-block-types";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = (await requireExplicitWorkspaceRole("MEMBER")).workspaceId;
    const type = await prisma.programBlockType.findFirst({
      where: { id, workspaceId },
      include: { versions: { orderBy: { version: "desc" } } },
    });
    if (!type) return NextResponse.json({ error: "Program block type not found" }, { status: 404 });
    return NextResponse.json(type);
  } catch (error: unknown) {
    console.error("GET /api/settings/program-block-types/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load program block type") }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = (await requireExplicitWorkspaceRole("ADMIN")).workspaceId;
    const parsed = ProgramBlockTypePayloadSchema.partial().safeParse(await request.json());
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: parsed.success ? "At least one field is required" : parsed.error.format() }, { status: 400 });
    }
    const type = await prisma.programBlockType.findFirst({ where: { id, workspaceId } });
    if (!type) return NextResponse.json({ error: "Program block type not found" }, { status: 404 });
    const updated = await prisma.$transaction(async (tx) => {
      const data: { key?: string; label?: string; description?: string | null } = {
        key: parsed.data.key,
        label: parsed.data.label,
        description: parsed.data.description,
      };
      await tx.programBlockType.update({ where: { id }, data });
      if (parsed.data.definition) {
        const latest = await tx.programBlockTypeVersion.findFirst({ where: { typeId: id }, orderBy: { version: "desc" } });
        await tx.programBlockTypeVersion.create({
          data: {
            typeId: id,
            version: (latest?.version ?? 0) + 1,
            definition: normalizeProgramBlockDefinition(parsed.data.definition),
            status: "DRAFT",
          },
        });
      }
      return tx.programBlockType.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" } } } });
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("PUT /api/settings/program-block-types/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update program block type") }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = (await requireExplicitWorkspaceRole("ADMIN")).workspaceId;
    const type = await prisma.programBlockType.findFirst({ where: { id, workspaceId } });
    if (!type) return NextResponse.json({ error: "Program block type not found" }, { status: 404 });
    const [templateBlockCount, serviceBlockCount] = await Promise.all([
      prisma.serviceTemplateBlock.count({ where: { typeId: id } }),
      prisma.worshipServiceBlock.count({ where: { typeVersion: { typeId: id } } }),
    ]);
    const deleteError = getProgramBlockTypeDeleteError({ templateBlockCount, serviceBlockCount });
    if (deleteError) return NextResponse.json({ error: deleteError }, { status: 409 });
    await prisma.programBlockType.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/settings/program-block-types/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to delete program block type") }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = (await requireExplicitWorkspaceRole("ADMIN")).workspaceId;
    const parsed = ProgramBlockVersionPayloadSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    const type = await prisma.programBlockType.findFirst({ where: { id, workspaceId } });
    if (!type) return NextResponse.json({ error: "Program block type not found" }, { status: 404 });
    const latest = await prisma.programBlockTypeVersion.findFirst({ where: { typeId: id }, orderBy: { version: "desc" } });
    const version = await prisma.programBlockTypeVersion.create({
      data: {
        typeId: id,
        version: (latest?.version ?? 0) + 1,
        definition: normalizeProgramBlockDefinition(parsed.data.definition),
        status: "DRAFT",
      },
    });
    return NextResponse.json(version, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/settings/program-block-types/[id] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create program block type version") }, { status: 500 });
  }
}
