import type { BlockType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { serviceDetailInclude } from "@/lib/service-data";
import { normalizeServiceBlockInputs } from "@/lib/service-blocks";
import { getActiveWorkspaceId, serviceWorkspaceWhere } from "@/lib/security-context";
import { UpdateServiceBlocksSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  let serviceId = "";

  try {
    const { id } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    serviceId = id;
    const parsed = UpdateServiceBlocksSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const service = await prisma.worshipService.findUnique({
      where: serviceWorkspaceWhere(id, workspaceId),
      select: { id: true },
    });
    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    const blocks = normalizeServiceBlockInputs(parsed.data.blocks as Array<{
      id?: string;
      label: string;
      code?: string;
      blockType: BlockType;
      order?: number;
    }>);
    const ids = blocks.flatMap((block) => block.id ? [block.id] : []);
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: "Service block IDs must be unique" }, { status: 400 });
    }

    const updatedService = await prisma.$transaction(async (tx) => {
      const currentBlocks = await tx.worshipServiceBlock.findMany({
        where: { serviceId: id },
        select: { id: true, blockType: true },
      });
      const currentById = new Map(currentBlocks.map((block) => [block.id, block]));
      const currentIds = new Set(currentById.keys());
      if (ids.some((blockId) => !currentIds.has(blockId))) {
        throw new Error("A service block does not belong to this service");
      }
      for (const block of blocks) {
        if (block.id && currentById.get(block.id)?.blockType !== block.blockType) {
          throw new Error("Existing service block behavior cannot be changed");
        }
        if (!block.id && block.blockType !== "CUSTOM") {
          throw new Error("New service blocks must use the custom behavior");
        }
      }

      const retainedIds = new Set(ids);
      const removedIds = currentBlocks.map((block) => block.id).filter((blockId) => !retainedIds.has(blockId));
      if (removedIds.length > 0) {
        await tx.worshipServiceBlock.deleteMany({ where: { serviceId: id, id: { in: removedIds } } });
      }

      for (const block of blocks) {
        const data = {
          blockType: block.blockType,
          label: block.label,
          code: block.code,
          order: block.order,
        };
        if (block.id) {
          await tx.worshipServiceBlock.update({ where: { id: block.id }, data });
        } else {
          await tx.worshipServiceBlock.create({ data: { ...data, serviceId: id } });
        }
      }

      return tx.worshipService.findUnique({
        where: serviceWorkspaceWhere(id, workspaceId),
        include: serviceDetailInclude,
      });
    });

    return NextResponse.json(updatedService);
  } catch (error: unknown) {
    console.error(`PUT /api/services/${serviceId || "[id]"}/blocks error:`, error);
    const message = getErrorMessage(error, "Failed to update service blocks");
    return NextResponse.json({ error: message }, { status: /does not belong|cannot be changed|must use/.test(message) ? 400 : 500 });
  }
}
