import { EditablePresetSchema, UpdateEditablePresetSchema } from "@/lib/settings-presets";
import { seedMinistryPresets } from "@/lib/settings-server";
import prisma from "@/lib/prisma";
import { createSettingsCollectionHandlers, type SettingsListDelegate } from "@/lib/settings-routes";

export const { GET, POST } = createSettingsCollectionHandlers({
  delegate: prisma.ministryPreset as unknown as SettingsListDelegate,
  seed: (workspaceId) => seedMinistryPresets(prisma, workspaceId),
  createSchema: EditablePresetSchema,
  updateSchema: UpdateEditablePresetSchema,
  orderBy: [{ label: "asc" }, { code: "asc" }],
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
