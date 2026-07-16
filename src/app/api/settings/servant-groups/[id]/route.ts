import prisma from "@/lib/prisma";
import { UpdateEditablePresetSchema } from "@/lib/settings-presets";
import { createSettingsCollectionHandlers, type SettingsListDelegate } from "@/lib/settings-routes";

export const { PUT, DELETE } = createSettingsCollectionHandlers({
  delegate: prisma.servantGroupPreset as unknown as SettingsListDelegate,
  seed: async () => undefined,
  createSchema: UpdateEditablePresetSchema,
  updateSchema: UpdateEditablePresetSchema,
  orderBy: [],
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
