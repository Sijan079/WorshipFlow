import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { SongTagPresetSchema } from "@/lib/validation";

export async function GET() {
  try {
    const tags = await prisma.songTagPreset.findMany({
      orderBy: [{ order: "asc" }, { label: "asc" }],
    });

    return NextResponse.json(tags);
  } catch (error: unknown) {
    console.error("GET /api/song-tags error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to load song tags") },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = SongTagPresetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const tag = await prisma.songTagPreset.create({
      data: {
        ...parsed.data,
        isDefault: false,
      },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/song-tags error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to create song tag") },
      { status: 500 }
    );
  }
}
