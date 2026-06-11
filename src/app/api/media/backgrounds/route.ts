import { NextResponse } from "next/server";
import { OutputType } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/security-context";

export async function GET() {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    const outputs = await prisma.generatedOutput.findMany({
      where: {
        type: { in: [OutputType.BACKGROUND_IMAGE, OutputType.BACKGROUND_VIDEO] },
        service: { workspaceId },
      },
      include: {
        job: true,
        service: {
          select: {
            id: true,
            ministryName: true,
            serviceDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(outputs);
  } catch (error: unknown) {
    console.error("GET /api/media/backgrounds error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to fetch generated backgrounds") },
      { status: 500 }
    );
  }
}
