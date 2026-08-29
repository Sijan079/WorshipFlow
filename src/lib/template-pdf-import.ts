import { normalizePresetCode } from "./settings-presets.ts";
import { mapProgramTypeKeyToBlockType } from "./program-block-types.ts";

export type ImportedTemplateBlock = {
  label: string;
  code: string;
  blockType: string;
  order: number;
};

export type ImportedTemplateDraft = {
  label: string;
  code: string;
  blocks: ImportedTemplateBlock[];
};

const PROGRAM_LINE = /^\s*(?:[IVXLCDM]+|\d+)\.\s*(.+?)\s*(?:_{2,}.*)?$/i;
const IGNORED_LINES = new Set(["NOTES", "DATE"]);

export function extractTemplateDraftFromPdfText(text: string): ImportedTemplateDraft {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.find((line) => /sunday|worship service|service program/i.test(line) && !/^worship service program$/i.test(line));
  const label = title ? toTitleCase(title) : "Imported service";
  const blocks = lines.flatMap((line) => {
    const match = line.match(PROGRAM_LINE);
    if (!match) return [];
    const blockLabel = match[1].replace(/\s*_+\s*$/, "").trim();
    if (!blockLabel || IGNORED_LINES.has(blockLabel.toUpperCase())) return [];
    const code = normalizePresetCode(blockLabel.replace(/&/g, "and"));
    return [{
      label: blockLabel,
      code,
      blockType: mapProgramTypeKeyToBlockType(code),
      order: 0,
    }];
  }).map((block, order) => ({ ...block, order }));

  if (blocks.length === 0) {
    throw new Error("No ordered program blocks were found in this PDF.");
  }

  return { label, code: normalizePresetCode(label), blocks };
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
