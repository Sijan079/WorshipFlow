import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { ServiceDetailSchema } from "@/lib/validation";
import { getActiveWorkspaceId, serviceWorkspaceWhere } from "@/lib/security-context";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const body = await request.json();
    const result = ServiceDetailSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 });
    }

    const { key, value, blockId } = result.data;

    // Verify service exists
    const service = await prisma.worshipService.findUnique({
      where: serviceWorkspaceWhere(serviceId, workspaceId),
    });
    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    if (blockId) {
      const block = await prisma.worshipServiceBlock.findFirst({
        where: {
          id: blockId,
          serviceId,
        },
      });

      if (!block) {
        return NextResponse.json({ error: "Service block not found for this service" }, { status: 404 });
      }
    }

    // Upsert key-value detail (unique constraint is not directly on key, but we want to avoid duplicates for the same block/service key)
    // Find if detail exists for this service and block
    const existingDetail = await prisma.worshipServiceDetail.findFirst({
      where: {
        serviceId,
        blockId: blockId || null,
        key,
      },
    });

    let detail;
    if (existingDetail) {
      detail = await prisma.worshipServiceDetail.update({
        where: { id: existingDetail.id },
        data: { value },
      });
    } else {
      detail = await prisma.worshipServiceDetail.create({
        data: {
          serviceId,
          blockId: blockId || null,
          key,
          value,
        },
      });
    }

    return NextResponse.json(detail, { status: existingDetail ? 200 : 201 });
  } catch (error: unknown) {
    console.error("POST /api/services/[id]/details error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to set detail") }, { status: 500 });
  }
}
