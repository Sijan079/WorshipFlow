import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_CHECKLIST_NAME,
  DEFAULT_MINISTRY_PRESETS,
  DEFAULT_SERVICE_TEMPLATE_PRESETS,
  DEFAULT_SERVANT_GROUP_PRESETS,
} from "./settings-presets";

type SettingsClient = Pick<
  PrismaClient,
  "workspace" | "ministryPreset" | "servantGroupPreset" | "checklistPreset" | "serviceTemplatePreset"
> | Prisma.TransactionClient;

async function seedDefaults<T extends { workspaceId: string }>(
  delegate: {
    count(args: { where: { workspaceId: string } }): Promise<number>;
    createMany(args: { data: T[]; skipDuplicates: true }): Promise<unknown>;
  },
  workspaceId: string,
  defaults: Omit<T, "workspaceId">[],
) {
  if (await delegate.count({ where: { workspaceId } })) return false;

  await delegate.createMany({
    data: defaults.map((preset) => ({ ...preset, workspaceId } as T)),
    skipDuplicates: true,
  });
  return true;
}

export async function seedMinistryPresets(client: SettingsClient, workspaceId: string) {
  await seedDefaults(client.ministryPreset, workspaceId, DEFAULT_MINISTRY_PRESETS);
}

export async function seedServantGroupPresets(client: SettingsClient, workspaceId: string) {
  await seedDefaults(client.servantGroupPreset, workspaceId, DEFAULT_SERVANT_GROUP_PRESETS);
}

export async function seedChecklistPresets(client: SettingsClient, workspaceId: string) {
  const workspace = await client.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { activeChecklistId: true },
  });
  let preset = await client.checklistPreset.findFirst({
    where: { workspaceId, isDefault: true },
    select: { id: true },
  });

  if (!preset) {
    preset = await client.checklistPreset.create({
      data: {
        workspaceId,
        name: DEFAULT_CHECKLIST_NAME,
        isDefault: true,
        items: { create: DEFAULT_CHECKLIST_ITEMS },
      },
      select: { id: true },
    });
  }

  const activeChecklist = workspace.activeChecklistId
    ? await client.checklistPreset.findFirst({
        where: { id: workspace.activeChecklistId, workspaceId },
        select: { id: true },
      })
    : null;
  if (!activeChecklist) {
    await client.workspace.update({ where: { id: workspaceId }, data: { activeChecklistId: preset.id } });
  }
}

export async function seedServiceTemplatePresets(client: SettingsClient, workspaceId: string) {
  const workspace = await client.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { serviceTemplatesInitialized: true },
  });

  if (!workspace.serviceTemplatesInitialized) {
    await seedDefaults(client.serviceTemplatePreset, workspaceId, DEFAULT_SERVICE_TEMPLATE_PRESETS);
    await client.workspace.update({
      where: { id: workspaceId },
      data: { serviceTemplatesInitialized: true },
    });
  }

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
}
