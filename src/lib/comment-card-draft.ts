import { z } from "zod";

const CommentCardDraftSchema = z.object({
  version: z.literal(1),
  name: z.string().max(120),
  comment: z.string().max(10_000),
  presetId: z.enum(["presentation", "phone", "portrait", "square", "wide"]),
  filename: z.string().max(72),
  fit: z.enum(["contain", "fill", "stretch"]),
  fontSize: z.number().int().min(18).max(300),
  lineSpacing: z.number().int().min(0).max(200).optional(),
  showSender: z.boolean(),
});

export type CommentCardDraft = Omit<z.infer<typeof CommentCardDraftSchema>, "version" | "lineSpacing"> & { lineSpacing: number };

export const COMMENT_CARD_EMPTY_DRAFT: CommentCardDraft = {
  name: "",
  comment: "",
  presetId: "presentation",
  filename: "comment-card",
  fit: "contain",
  fontSize: 52,
  lineSpacing: 20,
  showSender: true,
};

export function resolveCommentCardInitialDraft(saved: CommentCardDraft | null, activeName: string | null): CommentCardDraft {
  const draft = saved ?? COMMENT_CARD_EMPTY_DRAFT;
  return { ...draft, filename: activeName?.trim() || draft.filename };
}

export function commentCardDraftKey(userId: string, workspaceSlug: string) {
  return `worship-flow:comment-card-draft:v1:${encodeURIComponent(userId)}:${encodeURIComponent(workspaceSlug)}`;
}

export function readCommentCardDraft(storage: Pick<Storage, "getItem">, key: string): CommentCardDraft | null {
  const raw = storage.getItem(key);
  if (!raw || raw.length > 32_000) return null;
  try {
    const parsed = CommentCardDraftSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return {
      name: parsed.data.name,
      comment: parsed.data.comment,
      presetId: parsed.data.presetId,
      filename: parsed.data.filename,
      fit: parsed.data.fit,
      fontSize: parsed.data.fontSize,
      lineSpacing: parsed.data.lineSpacing ?? Math.round(parsed.data.fontSize * 0.38),
      showSender: parsed.data.showSender,
    };
  } catch {
    return null;
  }
}

export function writeCommentCardDraft(storage: Pick<Storage, "setItem">, key: string, draft: CommentCardDraft) {
  const value = CommentCardDraftSchema.parse({ ...draft, version: 1 });
  storage.setItem(key, JSON.stringify(value));
}
