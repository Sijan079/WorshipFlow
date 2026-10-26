import type { BlockType, PrismaClient } from "@prisma/client";
import { mapProgramTypeKeyToBlockType } from "./program-block-types.ts";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_CHECKLIST_NAME,
} from "./settings-presets";
import { DEFAULT_MINISTRIES } from "./ministries";

type SettingsClient = Pick<
  PrismaClient,
  "workspace" | "ministry" | "checklistPreset" | "serviceTemplatePreset" | "programBlockType" | "programBlockTypeVersion" | "serviceTemplateBlock"
> | Prisma.TransactionClient;

export async function seedMinistries(client: SettingsClient, workspaceId: string) {
  await client.ministry.createMany({
    data: DEFAULT_MINISTRIES.map((ministry) => ({ ...ministry, workspaceId })),
    skipDuplicates: true,
  });
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
    await client.workspace.update({
      where: { id: workspaceId },
      data: { serviceTemplatesInitialized: true },
    });
  }

  const presets = await client.serviceTemplatePreset.findMany({ where: { workspaceId } });
  await Promise.all(
    presets.map(async (preset) => {
      if (await client.serviceTemplateBlock.count({ where: { templateId: preset.id } })) return;
      if (Array.isArray(preset.blocks) && preset.blocks.length > 0) {
        const blocks = preset.blocks as Array<{ label: string; code?: string; blockType?: string; order?: number }>;
        const data = blocks.map((block, order) => ({
          templateId: preset.id,
          label: block.label,
          code: block.code ?? block.label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
          blockType: mapProgramTypeKeyToBlockType(block.blockType ?? "CUSTOM") as BlockType,
          order,
          fieldDefinition: { fields: [] },
          fieldDefaults: {},
        }));
        if (data.length > 0) await client.serviceTemplateBlock.createMany({ data });
        return;
      }

      return Promise.resolve();
    }),
  );
}
