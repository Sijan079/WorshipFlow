import type { PrismaClient } from "@prisma/client";

export const DEFAULT_SONG_TAG_PRESETS = [
  { label: "Title", token: "Title", color: "#DDECCB", order: 0, isDefault: true },
  { label: "Verse", token: "Verse", color: "#F7E7B2", order: 1, isDefault: true },
  { label: "Chorus", token: "Chorus", color: "#FFDCC8", order: 2, isDefault: true },
  { label: "Bridge", token: "Bridge", color: "#CFE8F6", order: 3, isDefault: true },
  { label: "Pre-Chorus", token: "Pre-Chorus", color: "#E8D7F1", order: 4, isDefault: true },
  { label: "Outro", token: "Outro", color: "#F7D7DF", order: 5, isDefault: true },
] as const;

export async function upsertDefaultSongTagPresets(prisma: PrismaClient) {
  for (const tag of DEFAULT_SONG_TAG_PRESETS) {
    await prisma.songTagPreset.upsert({
      where: { token: tag.token },
      update: tag,
      create: tag,
    });
  }
}
