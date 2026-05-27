import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { ServiceSongSchema } from "@/lib/validation";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId } = await params;
    const body = await request.json();
    const result = ServiceSongSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 });
    }

    const { songId, blockId, order, songRole, pageRef } = result.data;

    // Verify service exists
    const service = await prisma.worshipService.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    // Verify block exists and belongs to service
    const block = await prisma.worshipServiceBlock.findFirst({
      where: { id: blockId, serviceId },
    });
    if (!block) {
      return NextResponse.json({ error: "Service block not found for this service" }, { status: 404 });
    }

    // Verify song exists
    const song = await prisma.song.findUnique({
      where: { id: songId },
    });
    if (!song) {
      return NextResponse.json({ error: "Song not found in repository" }, { status: 404 });
    }

    const existingCount = await prisma.worshipServiceSong.count({
      where: {
        serviceId,
        blockId,
      },
    });

    const serviceSong = await prisma.worshipServiceSong.create({
      data: {
        serviceId,
        blockId,
        songId,
        order: order ?? existingCount,
        songRole,
        pageRef,
      },
      include: {
        song: true,
      },
    });

    return NextResponse.json(serviceSong, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/services/[id]/songs error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to add song to service") }, { status: 500 });
  }
}
