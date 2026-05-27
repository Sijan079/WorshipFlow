import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { UpdateSongTagPresetSchema } from "@/lib/validation";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateSongTagPresetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const tag = await prisma.songTagPreset.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(tag);
  } catch (error: unknown) {
    console.error("PUT /api/song-tags/[id] error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to update song tag") },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tag = await prisma.songTagPreset.findUnique({
      where: { id },
    });

    if (!tag) {
      return NextResponse.json({ error: "Song tag not found" }, { status: 404 });
    }

    if (tag.isDefault) {
      return NextResponse.json({ error: "Default song tags cannot be deleted" }, { status: 400 });
    }

    await prisma.songTagPreset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/song-tags/[id] error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to delete song tag") },
      { status: 500 }
    );
  }
}
