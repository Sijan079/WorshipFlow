import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { BlockPersonSchema } from "@/lib/validation";

type RouteParams = {
  params: Promise<{ id: string; blockId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId, blockId } = await params;
    const body = await request.json();
    const result = BlockPersonSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 });
    }

    const { personName, personTitle, order } = result.data;

    // Verify block exists
    const block = await prisma.worshipServiceBlock.findFirst({
      where: { id: blockId, serviceId },
    });

    if (!block) {
      return NextResponse.json({ error: "Service block not found for this service" }, { status: 404 });
    }

    const newPerson = await prisma.blockPerson.create({
      data: {
        blockId,
        personName,
        personTitle,
        order,
      },
    });

    return NextResponse.json(newPerson, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/services/[id]/blocks/[blockId]/people error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to add participant") }, { status: 500 });
  }
}
