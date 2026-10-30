import { SiteBlockSchema } from "../blocks/block-validation.ts";
import type { EditorBlock } from "./editor-state.ts";

// What is wrong with a block, in plain words, by block key. A page with any problem is not saved, because the
// server refuses it, so the editor says which block to fix instead of failing quietly.
export function blockProblems(blocks: EditorBlock[]) {
  const problems = new Map<string, string>();
  for (const { key, ...block } of blocks) {
    const result = SiteBlockSchema.safeParse(block);
    if (result.success) continue;
    const path = result.error.issues[0]?.path.join(".") ?? "";
    if (path.includes("path")) problems.set(key, "Choose a picture.");
    else if (path.includes("alt")) problems.set(key, "Describe the image so screen readers can read it.");
    else if (path.includes("url")) problems.set(key, "Enter a web address that starts with https://, a phone number, or an email address.");
    else if (path.includes("label")) problems.set(key, "Write what the button says.");
    else problems.set(key, result.error.issues[0]?.message ?? "Check this block.");
  }
  return problems;
}
