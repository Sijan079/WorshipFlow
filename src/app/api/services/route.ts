import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { WorshipServiceSchema } from "@/lib/validation";
import { STRICT_BLOCK_ORDER, serviceDetailInclude } from "@/lib/service-data";

export async function GET() {
  try {
    const services = await prisma.worshipService.findMany({
      orderBy: {
        serviceDate: "desc",
      },
      include: serviceDetailInclude,
    });
    return NextResponse.json(services);
  } catch (error: unknown) {
    console.error("GET /api/services error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch services") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = WorshipServiceSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 });
    }

    const { serviceDate, ministryName, theme, status } = result.data;

    const newService = await prisma.$transaction(async (tx) => {
      const service = await tx.worshipService.create({
        data: {
          serviceDate,
          ministryName,
          theme,
          status,
        },
      });

      // Create all 10 blocks in strict order
      await Promise.all(
        STRICT_BLOCK_ORDER.map((blockType, index) =>
          tx.worshipServiceBlock.create({
            data: {
              serviceId: service.id,
              blockType,
              order: index,
            },
          })
        )
      );

      return service;
    });

    const completeService = await prisma.worshipService.findUnique({
      where: { id: newService.id },
      include: serviceDetailInclude,
    });

    return NextResponse.json(completeService, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/services error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create service") }, { status: 500 });
  }
}
