import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_MINISTRY_PRESETS,
  DEFAULT_SERVICE_TEMPLATE_PRESETS,
  DEFAULT_SERVANT_GROUP_PRESETS,
} from "./settings-presets";

type SettingsClient = Pick<
  PrismaClient,
  "ministryPreset" | "servantGroupPreset" | "checklistItemPreset" | "serviceTemplatePreset"
> | Prisma.TransactionClient;

export async function seedMinistryPresets(client: SettingsClient, workspaceId: string) {
  const count = await client.ministryPreset.count({ where: { workspaceId } });
  if (count > 0) return;

  await client.ministryPreset.createMany({
    data: DEFAULT_MINISTRY_PRESETS.map((preset) => ({ ...preset, workspaceId })),
    skipDuplicates: true,
  });
}

export async function seedServantGroupPresets(client: SettingsClient, workspaceId: string) {
  const count = await client.servantGroupPreset.count({ where: { workspaceId } });
  if (count > 0) return;

  await client.servantGroupPreset.createMany({
    data: DEFAULT_SERVANT_GROUP_PRESETS.map((preset) => ({ ...preset, workspaceId })),
    skipDuplicates: true,
  });
}

export async function seedChecklistItemPresets(client: SettingsClient, workspaceId: string) {
  const count = await client.checklistItemPreset.count({ where: { workspaceId } });
  if (count > 0) return;

  await client.checklistItemPreset.createMany({
    data: DEFAULT_CHECKLIST_ITEMS.map((preset) => ({ ...preset, workspaceId })),
    skipDuplicates: true,
  });
}

export async function seedServiceTemplatePresets(client: SettingsClient, workspaceId: string) {
  const count = await client.serviceTemplatePreset.count({ where: { workspaceId } });
  if (count > 0) {
    const presets = await client.serviceTemplatePreset.findMany({ where: { workspaceId } });
    await Promise.all(
      presets.map((preset) => {
        if (Array.isArray(preset.blocks) && preset.blocks.length > 0) {
          return Promise.resolve();
        }

        const defaultPreset = DEFAULT_SERVICE_TEMPLATE_PRESETS.find((item) => item.code === preset.code);
        if (!defaultPreset) {
          return Promise.resolve();
        }

        return client.serviceTemplatePreset.update({
          where: { id: preset.id, workspaceId },
          data: { blocks: defaultPreset.blocks },
        });
      }),
    );
    return;
  }

  await client.serviceTemplatePreset.createMany({
    data: DEFAULT_SERVICE_TEMPLATE_PRESETS.map((preset) => ({ ...preset, workspaceId })),
    skipDuplicates: true,
  });
}
