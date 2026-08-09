import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { serviceWorkspaceWhere } from "@/lib/security-context";
import { getActiveWorkspaceId } from "@/lib/security-context";
import {
  ProgramBlockValuesPayloadSchema,
  validateProgramBlockValues,
  type ProgramBlockDefinition,
} from "@/lib/program-block-types";

type RouteParams = { params: Promise<{ id: string; blockId: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  let serviceId = "";
  try {
    const { id, blockId } = await params;
    serviceId = id;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const parsed = ProgramBlockValuesPayloadSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

    const block = await prisma.worshipServiceBlock.findFirst({
      where: { id: blockId, service: serviceWorkspaceWhere(id, workspaceId) },
      include: { typeVersion: true },
    });
    if (!block) return NextResponse.json({ error: "Service block not found" }, { status: 404 });
    const definition = block.typeVersion?.definition as ProgramBlockDefinition | undefined;
    if (!definition) return NextResponse.json({ error: "This service block has no programmable definition" }, { status: 400 });

    const validation = validateProgramBlockValues(definition, parsed.data.values);
    if (!validation.valid) return NextResponse.json({ error: "Required block fields are missing", missingFields: validation.missingRequiredFields }, { status: 400 });

    for (const field of definition.fields) {
      const value = parsed.data.values[field.key];
      if (value === undefined || value === null || value === "") continue;
      if (field.type === "single_select" && (!field.options || !field.options.includes(String(value)))) {
        return NextResponse.json({ error: `${field.label} must be one of the configured options` }, { status: 400 });
      }
      if (field.type === "person" && !(await prisma.servant.findFirst({ where: { id: String(value), workspaceId }, select: { id: true } }))) {
        return NextResponse.json({ error: `${field.label} references an unavailable person` }, { status: 400 });
      }
      if (field.type === "song" && !(await prisma.song.findFirst({ where: { id: String(value), workspaceId }, select: { id: true } }))) {
        return NextResponse.json({ error: `${field.label} references an unavailable song` }, { status: 400 });
      }
    }

    const updated = await prisma.worshipServiceBlock.update({ where: { id: blockId }, data: { fieldValues: parsed.data.values as Prisma.InputJsonObject } });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error(`PUT /api/services/${serviceId || "[id]"}/blocks/[blockId]/values error:`, error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to save service block values") }, { status: 500 });
  }
}
