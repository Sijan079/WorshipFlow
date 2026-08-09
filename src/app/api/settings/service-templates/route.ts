import {
  AlwaysActiveServiceTemplatePresetSchema,
  AlwaysActiveUpdateServiceTemplatePresetSchema,
} from "@/lib/settings-presets";
import type { Prisma } from "@prisma/client";
import { seedServiceTemplatePresets } from "@/lib/settings-server";
import prisma from "@/lib/prisma";
import { createSettingsCollectionHandlers, type SettingsListDelegate } from "@/lib/settings-routes";
import { mapProgramTypeKeyToBlockType, validateProgramBlockDefaults } from "@/lib/program-block-types";
import type { ProgramBlockDefinition } from "@/lib/program-block-types";

export async function syncTemplateBlocks(record: unknown, workspaceId: string, payload: unknown) {
  const templateId = (record as { id: string }).id;
  const blocks = (payload as { blocks?: Array<{ label: string; blockType?: string; typeVersionId?: string; fieldDefaults?: Record<string, unknown>; order?: number }> }).blocks;
  if (!blocks) return;

  const resolved: Array<{ templateId: string; typeId: string; typeVersionId: string; label: string; order: number; fieldDefaults: Record<string, unknown> }> = [];
  for (const [order, block] of blocks.entries()) {
    const version = block.typeVersionId
      ? await prisma.programBlockTypeVersion.findFirst({ where: { id: block.typeVersionId, type: { workspaceId } }, include: { type: true } })
      : await prisma.programBlockTypeVersion.findFirst({
          where: {
            status: "PUBLISHED",
            type: { workspaceId, key: block.blockType === "CUSTOM" ? "PROGRAM_ITEM" : mapProgramTypeKeyToBlockType(block.blockType ?? "CUSTOM") },
          },
          orderBy: { version: "desc" },
          include: { type: true },
        });
    if (!version) throw new Error(`No published program block type version for ${block.label}`);
    const fieldDefaults = block.fieldDefaults ?? {};
    const validation = validateProgramBlockDefaults(version.definition as ProgramBlockDefinition, fieldDefaults);
    if (!validation.valid) throw new Error(`Invalid field defaults for ${block.label}`);
    resolved.push({
      templateId,
      typeId: version.typeId,
      typeVersionId: version.id,
      label: block.label.trim(),
      order,
      fieldDefaults,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceTemplateBlock.deleteMany({ where: { templateId } });
    if (resolved.length > 0) await tx.serviceTemplateBlock.createMany({ data: resolved.map((item) => ({ ...item, fieldDefaults: item.fieldDefaults as Prisma.InputJsonObject })) });
  });
}

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
  afterWrite: syncTemplateBlocks,
  writeData: (payload) => Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "blocks")),
  findMany: async (workspaceId) => {
    const records = await prisma.serviceTemplatePreset.findMany({
      where: { workspaceId },
      orderBy: [{ label: "asc" }, { code: "asc" }],
      include: { templateBlocks: { orderBy: { order: "asc" }, include: { type: true } } },
    });
    return records.map(({ templateBlocks, ...record }) => ({
      ...record,
      blocks: templateBlocks.map((block) => ({
        label: block.label ?? block.type.label,
        code: block.type.key,
        blockType: block.type.key === "PROGRAM_ITEM" ? "CUSTOM" : mapProgramTypeKeyToBlockType(block.type.key),
        order: block.order,
        typeVersionId: block.typeVersionId,
        fieldDefaults: block.fieldDefaults,
      })),
    }));
  },
});
