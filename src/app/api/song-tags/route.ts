import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { SongTagPresetSchema } from "@/lib/validation";
import { getActiveWorkspaceId } from "@/lib/security-context";

const DEFAULT_SONG_TAG_PRESETS = [
  { label: "Title", token: "Title", color: "#DDECCB", isDefault: true },
  { label: "Verse", token: "Verse", color: "#F7E7B2", isDefault: true },
  { label: "Chorus", token: "Chorus", color: "#FFDCC8", isDefault: true },
  { label: "Bridge", token: "Bridge", color: "#CFE8F6", isDefault: true },
  { label: "Pre-Chorus", token: "Pre-Chorus", color: "#E8D7F1", isDefault: true },
  { label: "Outro", token: "Outro", color: "#F7D7DF", isDefault: true },
];

export async function GET() {
  try {
    const workspaceId = await getActiveWorkspaceId(prisma);
    const tagCount = await prisma.songTagPreset.count({ where: { workspaceId } });
    if (tagCount === 0) {
      await prisma.songTagPreset.createMany({
        data: DEFAULT_SONG_TAG_PRESETS.map((preset) => ({ ...preset, workspaceId })),
        skipDuplicates: true,
      });
    }

    const tags = await prisma.songTagPreset.findMany({
      where: { workspaceId },
      orderBy: [{ label: "asc" }, { token: "asc" }],
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
    const workspaceId = await getActiveWorkspaceId(prisma);
    const body = await request.json();
    const parsed = SongTagPresetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const tag = await prisma.songTagPreset.create({
      data: {
        ...parsed.data,
        workspaceId,
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
