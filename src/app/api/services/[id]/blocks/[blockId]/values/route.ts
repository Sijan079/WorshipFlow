import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { serviceWorkspaceWhere } from "@/lib/security-context";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { z } from "zod";
import { validateTemplateBlockValues } from "@/lib/template-block-kinds";

type RouteParams = { params: Promise<{ id: string; blockId: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  let serviceId = "";
  try {
    const { id, blockId } = await params;
    serviceId = id;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const parsed = z.object({ values: z.record(z.string(), z.unknown()) }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

    const block = await prisma.worshipServiceBlock.findFirst({
      where: { id: blockId, service: serviceWorkspaceWhere(id, workspaceId) },
      include: { service: { select: { status: true } } },
    });
    if (!block) return NextResponse.json({ error: "Service block not found" }, { status: 404 });
    const validation = validateTemplateBlockValues(block.kind, parsed.data.values);
    if (!validation.valid) return NextResponse.json({ error: "Block values do not match this block category" }, { status: 400 });
    if (block.kind === "PERSON") {
      const personIds = (validation.values as { personIds: string[] }).personIds;
      if (personIds.length > 0) {
        const count = await prisma.servant.count({ where: { workspaceId, id: { in: personIds } } });
        if (count !== personIds.length) return NextResponse.json({ error: "A selected person is unavailable in this workspace" }, { status: 400 });
      }
    }

    const updated = await prisma.worshipServiceBlock.update({ where: { id: blockId }, data: { fieldValues: validation.values as Prisma.InputJsonObject } });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error(`PUT /api/services/${serviceId || "[id]"}/blocks/[blockId]/values error:`, error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to save service block values") }, { status: 500 });
  }
}
