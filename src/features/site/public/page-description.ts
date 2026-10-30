import type { SiteBlockInput } from "../blocks/block-validation.ts";

const MAX_LENGTH = 160;

// What search engines show under the page title: the page's own description, or else its first paragraph, cut
// at a word.
export function pageDescription({ description, blocks }: { description: string | null; blocks: SiteBlockInput[] }) {
  const own = description?.trim();
  if (own) return own;
  for (const block of blocks) {
    if (block.type !== "PARAGRAPH") continue;
    const text = block.content.runs.map((run) => run.text).join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (text.length <= MAX_LENGTH) return text;
    return `${text.slice(0, MAX_LENGTH).replace(/\s+\S*$/, "").replace(/[\s,.;:]+$/, "")}…`;
  }
  return null;
}
