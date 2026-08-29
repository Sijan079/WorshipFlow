import {
  AlwaysActiveServiceTemplatePresetSchema,
  AlwaysActiveUpdateServiceTemplatePresetSchema,
} from "@/lib/settings-presets";
import type { Prisma, PrismaClient } from "@prisma/client";
import { seedServiceTemplatePresets } from "@/lib/settings-server";
import prisma from "@/lib/prisma";
import { createSettingsCollectionHandlers, type SettingsListDelegate } from "@/lib/settings-routes";
import { TemplateBlockKindSchema, type TemplateBlockKind } from "@/lib/template-block-kinds";

type TemplateBlockClient = Pick<PrismaClient, "serviceTemplateBlock">;
type TemplateBlockPayload = {
  label: string;
  code?: string;
  kind?: TemplateBlockKind;
  order?: number;
};
type ResolvedTemplateBlock = {
  templateId: string;
  label: string;
  code: string;
  kind: TemplateBlockKind;
  order: number;
};

async function resolveTemplateBlocks(templateId: string, payload: unknown) {
  const blocks = (payload as { blocks?: TemplateBlockPayload[] }).blocks;
  if (!blocks) return [];

  const resolved: ResolvedTemplateBlock[] = [];
  for (const [order, block] of blocks.entries()) {
    resolved.push({
      templateId,
      label: block.label.trim(),
      code: block.code?.trim() || block.label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
      kind: TemplateBlockKindSchema.parse(block.kind ?? "TEXT"),
      order,
    });
  }
  return resolved;
}

async function replaceTemplateBlocks(client: TemplateBlockClient, templateId: string, blocks: ResolvedTemplateBlock[]) {
  await client.serviceTemplateBlock.deleteMany({ where: { templateId } });
  if (blocks.length > 0) {
    await client.serviceTemplateBlock.createMany({
      data: blocks.map((item) => ({
        ...item,
        fieldDefinition: { fields: [] } as Prisma.InputJsonObject,
        fieldDefaults: {} as Prisma.InputJsonObject,
      })),
    });
  }
}

export async function syncTemplateBlocks(record: unknown, workspaceId: string, payload: unknown) {
  const templateId = (record as { id: string }).id;
  await prisma.$transaction(async (tx) => {
    const blocks = await resolveTemplateBlocks(templateId, payload);
    await replaceTemplateBlocks(tx, templateId, blocks);
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
  create: async (workspaceId, payload) => prisma.$transaction(async (tx) => {
    const record = await tx.serviceTemplatePreset.create({
      data: {
        label: payload.label,
        code: payload.code,
        active: payload.active,
        templateType: payload.templateType,
        optionalBlocks: payload.optionalBlocks,
        workspaceId,
        isDefault: false,
      },
    });
    const blocks = await resolveTemplateBlocks(record.id, payload);
    await replaceTemplateBlocks(tx, record.id, blocks);
    return record;
  }),
  afterWrite: syncTemplateBlocks,
  writeData: (payload) => Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "blocks")),
  findMany: async (workspaceId) => {
    const records = await prisma.serviceTemplatePreset.findMany({
      where: { workspaceId },
      orderBy: [{ label: "asc" }, { code: "asc" }],
      include: { templateBlocks: { orderBy: { order: "asc" } } },
    });
    return records.map(({ templateBlocks, ...record }) => ({
      ...record,
      blocks: templateBlocks.map((block) => ({
        id: block.id,
        label: block.label ?? "Program item",
        code: block.code ?? "PROGRAM_ITEM",
        kind: block.kind,
        order: block.order,
        fieldDefinition: { fields: [] },
        fieldDefaults: {},
      })),
    }));
  },
});
