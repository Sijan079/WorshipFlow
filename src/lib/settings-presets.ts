import { z } from "zod";
import type { BlockType, ServiceTemplateType } from "@prisma/client";
import { ASSIGNED_MINISTRY_OPTIONS } from "./service-records.ts";
import { SERVANT_GROUP_OPTIONS } from "./servants.ts";
import { BLOCK_LABELS, EXTENDED_BLOCK_ORDER, STANDARD_BLOCK_ORDER } from "./service-display.ts";

export const APPROVED_TEMPLATE_OPTIONAL_BLOCKS = ["AWIT_NG_HIMNO", "TIPAN_PAHAYAG"] as const satisfies BlockType[];
const BLOCK_TYPE_VALUES = [
  "CALL_TO_WORSHIP",
  "PRAISE_AND_WORSHIP",
  "MC",
  "AWIT_NG_HIMNO",
  "TIPAN_PAHAYAG",
  "AWIT_NG_PAKIKINIG",
  "SCRIPTURE_READING",
  "SERMON",
  "AWIT_NG_PAGTUGON",
  "OFFERING",
  "FLOWERS_FOR_THE_LORD",
  "DETAILS",
] as const satisfies readonly BlockType[];

export type ApprovedTemplateOptionalBlock = (typeof APPROVED_TEMPLATE_OPTIONAL_BLOCKS)[number];

export type TemplateBlockPreset = {
  label: string;
  code: string;
  blockType: BlockType;
  order: number;
};

export const DEFAULT_MINISTRY_PRESETS = ASSIGNED_MINISTRY_OPTIONS.map((option) => ({
  label: option.label,
  code: option.value,
  active: true,
  isDefault: true,
}));

export const DEFAULT_SERVANT_GROUP_PRESETS = SERVANT_GROUP_OPTIONS.map((option) => ({
  label: option.label,
  code: option.value,
  active: true,
  isDefault: true,
}));

function createDefaultTemplateBlocks(blockTypes: readonly BlockType[]) {
  return blockTypes.map((blockType, order) => ({
    label: BLOCK_LABELS[blockType],
    code: blockType,
    blockType,
    order,
  }));
}

export const DEFAULT_SERVICE_TEMPLATE_PRESETS = [
  {
    label: "Regular",
    code: "REGULAR",
    templateType: "REGULAR" as ServiceTemplateType,
    optionalBlocks: [],
    blocks: createDefaultTemplateBlocks(STANDARD_BLOCK_ORDER),
    active: true,
    isDefault: false,
  },
  {
    label: "1st Sunday",
    code: "FIRST_SUNDAY",
    templateType: "FIRST_SUNDAY" as ServiceTemplateType,
    optionalBlocks: [...APPROVED_TEMPLATE_OPTIONAL_BLOCKS],
    blocks: createDefaultTemplateBlocks(EXTENDED_BLOCK_ORDER),
    active: true,
    isDefault: false,
  },
];

export const DEFAULT_CHECKLIST_ITEMS = [
  { label: "Confirm sermon verse", order: 0, active: true },
  { label: "Assign service servants", order: 1, active: true },
  { label: "Prepare worship songs", order: 2, active: true },
  { label: "Stage booth media", order: 3, active: true },
];

export const DEFAULT_CHECKLIST_NAME = "Before every worship service";

export function normalizePresetCode(value: string) {
  const code = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return code || "PRESET";
}

export function sortSettingsByLabel<T extends { label: string }>(items: T[]) {
  return [...items].sort((left, right) => left.label.localeCompare(right.label));
}

export function moveTemplateBlock<T>(blocks: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function inferTemplateBlockType(label: string): BlockType {
  const value = label.trim().toLowerCase();
  if (/praise|worship/.test(value)) return "PRAISE_AND_WORSHIP";
  if (/scripture|reading/.test(value)) return "SCRIPTURE_READING";
  if (/sermon|message|preach/.test(value)) return "SERMON";
  if (/offering|tithe/.test(value)) return "OFFERING";
  if (/announcement|flower/.test(value)) return "FLOWERS_FOR_THE_LORD";
  if (/call/.test(value)) return "CALL_TO_WORSHIP";
  if (/hymn|himno/.test(value)) return "AWIT_NG_HIMNO";
  if (/response|pagtugon/.test(value)) return "AWIT_NG_PAGTUGON";
  if (/pakikinig|listening/.test(value)) return "AWIT_NG_PAKIKINIG";
  if (/mc|emcee|papuri|pasasalamat/.test(value)) return "MC";
  return "DETAILS";
}

export function validateTemplateBlocks(blocks: Array<{ label: string; code?: string; blockType?: string; order?: number }>) {
  if (blocks.length === 0) {
    throw new Error("At least one service block is required.");
  }

  return blocks.map((block, index) => {
    const label = block.label.trim();
    if (!label) {
      throw new Error("Service block label is required.");
    }

    return {
      label,
      code: normalizePresetCode(block.code || label),
      blockType: (block.blockType || inferTemplateBlockType(label)) as BlockType,
      order: Number.isInteger(block.order) ? Number(block.order) : index,
    };
  });
}

export function validateTemplateOptionalBlocks(blocks: string[]) {
  const approved = new Set<string>(APPROVED_TEMPLATE_OPTIONAL_BLOCKS);
  const uniqueBlocks = [...new Set(blocks)];

  for (const block of uniqueBlocks) {
    if (!approved.has(block)) {
      throw new Error(`Unsupported optional template block: ${block}`);
    }
  }

  return uniqueBlocks as ApprovedTemplateOptionalBlock[];
}

export const PresetCodeSchema = z
  .string()
  .trim()
  .min(1, "Code is required")
  .max(48, "Code is too long")
  .regex(/^[A-Z][A-Z0-9_]*$/, "Use uppercase letters, numbers, and underscores");

export const EditablePresetSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(80, "Label is too long"),
  code: PresetCodeSchema,
  active: z.boolean().default(true),
});

export const ChecklistPresetItemPayloadSchema = z.object({
  id: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1, "Label is required").max(120, "Label is too long"),
  active: z.boolean().default(true),
});

export const CreateChecklistPresetSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
});

export const UpdateChecklistPresetSchema = CreateChecklistPresetSchema.extend({
  items: z.array(ChecklistPresetItemPayloadSchema).max(100, "Too many checklist items"),
}).superRefine((value, context) => {
  const ids = value.items.flatMap((item) => item.id ? [item.id] : []);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "Checklist item IDs must be unique" });
  }
});

export const ActivateChecklistPresetSchema = z.object({
  checklistId: z.string().trim().min(1, "Checklist is required"),
});

export const ServiceTemplatePresetSchema = EditablePresetSchema.extend({
  templateType: z.enum(["REGULAR", "FIRST_SUNDAY"]),
  optionalBlocks: z.array(z.enum(APPROVED_TEMPLATE_OPTIONAL_BLOCKS)).default([]),
  blocks: z
    .array(z.object({
      label: z.string().trim().min(1, "Block label is required").max(80, "Block label is too long"),
      code: PresetCodeSchema.optional(),
      blockType: z.enum(BLOCK_TYPE_VALUES).optional(),
      order: z.number().int().min(0).optional(),
    }))
    .min(1, "At least one service block is required")
    .transform(validateTemplateBlocks),
});

export const UpdateEditablePresetSchema = EditablePresetSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export const UpdateServiceTemplatePresetSchema = ServiceTemplatePresetSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export const AlwaysActiveServiceTemplatePresetSchema = ServiceTemplatePresetSchema.transform((value) => ({
  ...value,
  active: true,
}));

export const AlwaysActiveUpdateServiceTemplatePresetSchema = UpdateServiceTemplatePresetSchema.transform((value) => ({
  ...value,
  active: true,
}));
