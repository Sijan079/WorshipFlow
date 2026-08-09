import type { BlockType } from "@prisma/client";
import { normalizePresetCode } from "./settings-presets.ts";

export type ServiceBlockInput = {
  id?: string;
  label: string;
  code?: string;
  blockType: BlockType;
  order?: number;
};

export function normalizeServiceBlockInputs(blocks: ServiceBlockInput[]) {
  return blocks.map((block, order) => ({
    ...(block.id ? { id: block.id } : {}),
    label: block.label.trim(),
    code: normalizePresetCode(block.code || block.label),
    blockType: block.blockType,
    order,
  }));
}
