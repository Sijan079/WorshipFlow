import { inferTemplateBlockType } from "./settings-presets.ts";

export type LegacyTemplateBlock = {
  label: string;
  blockType?: string;
  order?: number;
  typeVersionId?: string;
  fieldDefaults?: Record<string, unknown>;
};

export function normalizeLegacyTemplateBlocks(blocks: LegacyTemplateBlock[]) {
  return blocks
    .map((block, index) => ({ ...block, index }))
    .sort((left, right) => (left.order ?? left.index) - (right.order ?? right.index) || left.index - right.index)
    .map((block, order) => ({
      label: block.label.trim(),
      ...(block.typeVersionId ? { typeVersionId: block.typeVersionId } : {}),
      ...(block.fieldDefaults ? { fieldDefaults: block.fieldDefaults } : {}),
      blockType: block.blockType || inferTemplateBlockType(block.label),
      order,
    }));
}
