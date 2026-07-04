import type { PrismaClient } from "@prisma/client";

export const DEFAULT_WORKSPACE_SLUG = "default";

export const DEFAULT_SONG_TAG_PRESETS = [
  { label: "Title", token: "Title", color: "#DDECCB", isDefault: true },
  { label: "Verse", token: "Verse", color: "#F7E7B2", isDefault: true },
  { label: "Chorus", token: "Chorus", color: "#FFDCC8", isDefault: true },
  { label: "Bridge", token: "Bridge", color: "#CFE8F6", isDefault: true },
  { label: "Pre-Chorus", token: "Pre-Chorus", color: "#E8D7F1", isDefault: true },
  { label: "Outro", token: "Outro", color: "#F7D7DF", isDefault: true },
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
