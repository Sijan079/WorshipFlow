import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { AssetType } from "@prisma/client";
import { savePublicFile } from "@/lib/file-storage";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId } = await params;
    const assets = await prisma.serviceAsset.findMany({
      where: { serviceId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(assets);
  } catch (error: unknown) {
    console.error("GET /api/services/[id]/assets error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch assets") }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId } = await params;

    // Verify service exists
    const service = await prisma.worshipService.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") || "";

    let type: AssetType = AssetType.OTHER;
    let fileName = "";
    let filePath = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const typeInput = formData.get("type") as string;

      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      if (typeInput && Object.values(AssetType).includes(typeInput as AssetType)) {
        type = typeInput as AssetType;
      } else {
        // Guess type based on file extension
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "pdf") type = AssetType.PDF;
        else if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) type = AssetType.IMAGE;
        else if (["mp4", "mov", "avi", "mkv"].includes(ext || "")) type = AssetType.VIDEO;
        else if (["docx", "doc"].includes(ext || "")) type = AssetType.DOCX;
      }

      fileName = file.name;
      const bytes = await file.arrayBuffer();
      const savedFile = await savePublicFile("uploads", file.name, new Uint8Array(bytes));
      filePath = savedFile.publicPath;
    } else {
      // Handle JSON body payload for metadata registration
      const body = await request.json();
      type = body.type || AssetType.OTHER;
      fileName = body.fileName;
      filePath = body.filePath;

      if (!fileName || !filePath) {
        return NextResponse.json({ error: "fileName and filePath are required" }, { status: 400 });
      }
    }

    const asset = await prisma.serviceAsset.create({
      data: {
        serviceId,
        type,
        fileName,
        filePath,
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/services/[id]/assets error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to save asset") }, { status: 500 });
  }
}
