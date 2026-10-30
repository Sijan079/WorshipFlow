import type { SiteBlockInput } from "../blocks/block-validation.ts";

const MAX_LENGTH = 160;

type Block = SiteBlockInput | Extract<SiteBlockInput, { type: "SECTION" }>["content"]["blocks"][number];

// Every block in reading order, looking inside Sections and inside the columns of a Columns block.
function inReadingOrder(blocks: Block[]): Block[] {
  return blocks.flatMap((block): Block[] => {
    if (block.type === "SECTION") return inReadingOrder(block.content.blocks);
    if (block.type === "COLUMNS") return block.content.columns.flatMap((column) => inReadingOrder(column.blocks));
    return [block];
  });
}

// What search engines show under the page title: the page's own description, or else its first paragraph, cut
// at a word.
export function pageDescription({ description, blocks }: { description: string | null; blocks: SiteBlockInput[] }) {
  const own = description?.trim();
  if (own) return own;
  // The first paragraph anywhere on the page, including inside a Section or a column. A Cover's line counts too.
  for (const block of inReadingOrder(blocks)) {
    if (block.type !== "PARAGRAPH" && block.type !== "COVER") continue;
    const text = (block.type === "COVER" ? (block.content.text ?? "") : block.content.runs.map((run) => run.text).join("")).replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (text.length <= MAX_LENGTH) return text;
    return `${text.slice(0, MAX_LENGTH).replace(/\s+\S*$/, "").replace(/[\s,.;:]+$/, "")}…`;
  }
  return null;
}
