import {
  AlwaysActiveServiceTemplatePresetSchema,
  AlwaysActiveUpdateServiceTemplatePresetSchema,
} from "@/lib/settings-presets";
import { seedServiceTemplatePresets } from "@/lib/settings-server";
import prisma from "@/lib/prisma";
import { createSettingsCollectionHandlers, type SettingsListDelegate } from "@/lib/settings-routes";

export const { GET, POST } = createSettingsCollectionHandlers({
  delegate: prisma.serviceTemplatePreset as unknown as SettingsListDelegate,
  seed: (workspaceId) => seedServiceTemplatePresets(prisma, workspaceId),
  createSchema: AlwaysActiveServiceTemplatePresetSchema,
  updateSchema: AlwaysActiveUpdateServiceTemplatePresetSchema,
  orderBy: [{ label: "asc" }, { code: "asc" }],
  path: "/api/settings/service-templates",
  messages: {
    load: "Failed to load service template presets",
    create: "Failed to create service template preset",
    notFound: "Service template preset not found",
    defaultDelete: "Default service template presets cannot be deleted",
    update: "Failed to update service template preset",
    delete: "Failed to delete service template preset",
  },
});
