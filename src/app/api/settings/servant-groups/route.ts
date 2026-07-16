import { EditablePresetSchema, UpdateEditablePresetSchema } from "@/lib/settings-presets";
import { seedServantGroupPresets } from "@/lib/settings-server";
import prisma from "@/lib/prisma";
import { createSettingsCollectionHandlers, type SettingsListDelegate } from "@/lib/settings-routes";

export const { GET, POST } = createSettingsCollectionHandlers({
  delegate: prisma.servantGroupPreset as unknown as SettingsListDelegate,
  seed: (workspaceId) => seedServantGroupPresets(prisma, workspaceId),
  createSchema: EditablePresetSchema,
  updateSchema: UpdateEditablePresetSchema,
  orderBy: [{ label: "asc" }, { code: "asc" }],
  path: "/api/settings/servant-groups",
  messages: {
    load: "Failed to load servant group presets",
    create: "Failed to create servant group preset",
    notFound: "Servant group preset not found",
    defaultDelete: "Default servant group presets cannot be deleted",
    update: "Failed to update servant group preset",
    delete: "Failed to delete servant group preset",
  },
});
