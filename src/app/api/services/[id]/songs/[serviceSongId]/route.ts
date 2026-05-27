import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string; serviceSongId: string }>;
};

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId, serviceSongId } = await params;

    const serviceSong = await prisma.worshipServiceSong.findFirst({
      where: { id: serviceSongId, serviceId },
    });

    if (!serviceSong) {
      return NextResponse.json({ error: "Service song association not found" }, { status: 404 });
    }

    await prisma.worshipServiceSong.delete({
      where: { id: serviceSongId },
    });

    return NextResponse.json({ message: "Song association removed successfully" });
  } catch (error: unknown) {
    console.error("DELETE /api/services/[id]/songs/[serviceSongId] error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to remove song from service") }, { status: 500 });
  }
}
