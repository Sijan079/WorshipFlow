import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { SongSchema } from "@/lib/validation";

export async function GET() {
  try {
    const songs = await prisma.song.findMany({
      orderBy: {
        title: "asc",
      },
      include: {
        files: true,
      },
    });
    return NextResponse.json(songs);
  } catch (error: unknown) {
    console.error("GET /api/songs error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch songs") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = SongSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 });
    }

    const newSong = await prisma.song.create({
      data: result.data,
    });

    return NextResponse.json(newSong, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/songs error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create song") }, { status: 500 });
  }
}
