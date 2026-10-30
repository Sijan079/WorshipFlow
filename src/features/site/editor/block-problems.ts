import { SiteBlockSchema } from "../blocks/block-validation.ts";
import type { EditorBlock } from "./editor-state.ts";

// What is wrong with a block, in plain words, by block key. A page with any problem is not saved, because the
// server refuses it, so the editor says which block to fix instead of failing quietly. A Section is checked on its
// own settings, and each block inside it is checked and named separately.
export function blockProblems(blocks: EditorBlock[]) {
  const problems = new Map<string, string>();

  const report = (key: string, result: ReturnType<typeof SiteBlockSchema.safeParse>) => {
    if (result.success) return;
    const path = result.error.issues[0]?.path.join(".") ?? "";
    if (path.includes("headline")) problems.set(key, "Write a headline for the cover.");
    else if (path.includes("picture")) problems.set(key, "Choose a picture for the background.");
    else if (path.includes("path")) problems.set(key, "Choose a picture.");
    else if (path.includes("alt")) problems.set(key, "Describe the image so screen readers can read it.");
    else if (path.includes("url")) problems.set(key, "Enter a web address that starts with https://, a phone number, or an email address.");
    else if (path.includes("label")) problems.set(key, "Write what the button says.");
    else problems.set(key, result.error.issues[0]?.message ?? "Check this block.");
  };

  const check = (block: EditorBlock) => {
    const { key, ...plain } = block;
    if (plain.type === "SECTION") {
      report(key, SiteBlockSchema.safeParse({ ...plain, content: { ...plain.content, blocks: [] } }));
      for (const child of plain.content.blocks) check(child);
      return;
    }
    report(key, SiteBlockSchema.safeParse(plain));
  };

  for (const block of blocks) check(block);
  return problems;
}
