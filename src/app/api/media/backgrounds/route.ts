import { NextResponse } from "next/server";
import { OutputType } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { deleteExpiredBackgroundOutputs } from "@/features/media-generation/server/background-output-retention";

export async function GET() {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    await deleteExpiredBackgroundOutputs(prisma, workspaceId);
    const outputs = await prisma.generatedOutput.findMany({
      where: {
        workspaceId,
        type: OutputType.BACKGROUND_IMAGE,
      },
      include: {
        job: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
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
