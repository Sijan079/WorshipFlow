import type { PrismaClient } from "@prisma/client";

export const DEFAULT_WORKSPACE_SLUG = "default";

export const DEFAULT_SONG_TAG_PRESETS = [
  { label: "Title", token: "Title", color: "#DDECCB", order: 0, isDefault: true },
  { label: "Verse", token: "Verse", color: "#F7E7B2", order: 1, isDefault: true },
  { label: "Chorus", token: "Chorus", color: "#FFDCC8", order: 2, isDefault: true },
  { label: "Bridge", token: "Bridge", color: "#CFE8F6", order: 3, isDefault: true },
  { label: "Pre-Chorus", token: "Pre-Chorus", color: "#E8D7F1", order: 4, isDefault: true },
  { label: "Outro", token: "Outro", color: "#F7D7DF", order: 5, isDefault: true },
] as const;

export async function upsertDefaultSongTagPresets(prisma: PrismaClient) {
  const workspace = await prisma.workspace.upsert({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
    update: {},
    create: {
      slug: DEFAULT_WORKSPACE_SLUG,
      name: "Default Workspace",
    },
    select: { id: true },
  });

  for (const tag of DEFAULT_SONG_TAG_PRESETS) {
    await prisma.songTagPreset.upsert({
      where: { workspaceId_token: { workspaceId: workspace.id, token: tag.token } },
      update: tag,
      create: { ...tag, workspaceId: workspace.id },
    });
  }

  return workspace;
}
