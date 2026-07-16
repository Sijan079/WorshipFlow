import prisma from "@/lib/prisma";
import { AlwaysActiveUpdateServiceTemplatePresetSchema } from "@/lib/settings-presets";
import { createSettingsCollectionHandlers, type SettingsListDelegate } from "@/lib/settings-routes";

export const { PUT, DELETE } = createSettingsCollectionHandlers({
  delegate: prisma.serviceTemplatePreset as unknown as SettingsListDelegate,
  seed: async () => undefined,
  createSchema: AlwaysActiveUpdateServiceTemplatePresetSchema,
  updateSchema: AlwaysActiveUpdateServiceTemplatePresetSchema,
  orderBy: [],
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
