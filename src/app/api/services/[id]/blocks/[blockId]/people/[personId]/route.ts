import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { BlockPersonSchema } from "@/lib/validation";

type RouteParams = {
  params: Promise<{ id: string; blockId: string; personId: string }>;
};

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId, blockId, personId } = await params;
    const body = await request.json();
    const result = BlockPersonSchema.partial().safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 });
    }

    const person = await prisma.blockPerson.findFirst({
      where: {
        id: personId,
        blockId,
        block: {
          serviceId,
        },
      },
    });

    if (!person) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    const updatedPerson = await prisma.blockPerson.update({
      where: { id: personId },
      data: result.data,
    });

    return NextResponse.json(updatedPerson);
  } catch (error: unknown) {
    console.error("PUT /api/services/[id]/blocks/[blockId]/people/[personId] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update participant") }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId, blockId, personId } = await params;

    const person = await prisma.blockPerson.findFirst({
      where: {
        id: personId,
        blockId,
        block: {
          serviceId,
        },
      },
    });

    if (!person) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    await prisma.blockPerson.delete({
      where: { id: personId },
    });

    return NextResponse.json({ message: "Participant removed successfully" });
  } catch (error: unknown) {
    console.error("DELETE /api/services/[id]/blocks/[blockId]/people/[personId] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to delete participant") }, { status: 500 });
  }
}
