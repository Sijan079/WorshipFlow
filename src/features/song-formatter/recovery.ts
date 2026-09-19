import { z } from "zod";
import { EXTRACTOR_WARNING_CODES } from "../../lib/extractor-types.ts";

export const DraftSchema = z.object({
  version: z.literal(1),
  text: z.string().max(1_000_000),
  songTitle: z.string().max(500),
  warningCodes: z.array(z.enum(EXTRACTOR_WARNING_CODES)).max(30),
  warningsDismissed: z.boolean(),
  directAiReformatUsed: z.boolean(),
});
export type RecoverableDraft = Omit<z.infer<typeof DraftSchema>, "version">;
type DraftStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function draftStorageKey(userId: string, workspaceSlug: string) {
  return `worship-flow:song-draft:v1:${encodeURIComponent(userId)}:${encodeURIComponent(workspaceSlug)}`;
}
export function readDraft(storage: Pick<DraftStore, "getItem">, key: string): RecoverableDraft | null {
  const raw = storage.getItem(key);
  if (!raw || raw.length > 6_100_000) return null;
  try {
    const parsed = DraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
export function writeDraft(storage: DraftStore, key: string, draft: unknown) {
  const value = DraftSchema.parse({ ...(draft as RecoverableDraft), version: 1 });
  if (!value.text) storage.removeItem(key);
  else storage.setItem(key, JSON.stringify(value));
}
