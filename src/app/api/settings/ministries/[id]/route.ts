import prisma from "@/lib/prisma";
import { UpdateEditablePresetSchema } from "@/lib/settings-presets";
import { createSettingsCollectionHandlers, type SettingsListDelegate } from "@/lib/settings-routes";

export const { PUT, DELETE } = createSettingsCollectionHandlers({
  delegate: prisma.ministryPreset as unknown as SettingsListDelegate,
  seed: async () => undefined,
  createSchema: UpdateEditablePresetSchema,
  updateSchema: UpdateEditablePresetSchema,
  orderBy: [],
  path: "/api/settings/ministries",
  messages: {
    load: "Failed to load ministry presets",
    create: "Failed to create ministry preset",
    notFound: "Ministry preset not found",
    defaultDelete: "Default ministry presets cannot be deleted",
    update: "Failed to update ministry preset",
    delete: "Failed to delete ministry preset",
  },
});
