import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { createTemporaryAutomationBatch } from "@/lib/temporary-automation-store";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId } = await params;

    const service = await prisma.worshipService.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "At least one upload file is required" }, { status: 400 });
    }

    for (const file of files) {
      const lowerType = file.type.toLowerCase();
      const lowerName = file.name.toLowerCase();
      const isDocx = lowerType.includes("wordprocessingml.document") || lowerName.endsWith(".docx");
      const isPdf = lowerType.includes("pdf") || lowerName.endsWith(".pdf");

      if (!isDocx && !isPdf) {
        return NextResponse.json(
          { error: "Only DOCX and PDF uploads are supported for transpose automation" },
          { status: 400 }
        );
      }
    }

    const batch = await createTemporaryAutomationBatch(serviceId, files);
    return NextResponse.json(batch, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/services/[id]/automation-batches error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to stage automation files") },
      { status: 500 }
    );
  }
}
