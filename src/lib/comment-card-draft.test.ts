import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMENT_CARD_EMPTY_DRAFT,
  commentCardDraftKey,
  readCommentCardDraft,
  resolveCommentCardInitialDraft,
  writeCommentCardDraft,
  type CommentCardDraft,
} from "./comment-card-draft.ts";

test("comment card drafts are scoped to a user and workspace", () => {
  assert.notEqual(commentCardDraftKey("user-a", "church"), commentCardDraftKey("user-b", "church"));
  assert.notEqual(commentCardDraftKey("user-a", "church"), commentCardDraftKey("user-a", "other"));
});

test("comment card draft round trips all editable fields", () => {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  };
  const key = commentCardDraftKey("user-a", "church");
  const draft: CommentCardDraft = {
    ...COMMENT_CARD_EMPTY_DRAFT,
    name: "Ada",
    comment: "A worship service comment",
    presetId: "phone",
    filename: "Sunday welcome",
    fit: "fill",
    fontSize: 64,
    lineSpacing: 28,
    showSender: false,
  };
  writeCommentCardDraft(storage, key, draft);
  assert.deepEqual(readCommentCardDraft(storage, key), draft);
});

test("older comment card drafts keep their original line height", () => {
  const legacy = { ...COMMENT_CARD_EMPTY_DRAFT, fontSize: 100, version: 1 };
  delete (legacy as { lineSpacing?: number }).lineSpacing;
  assert.equal(readCommentCardDraft({ getItem: () => JSON.stringify(legacy) }, "legacy")?.lineSpacing, 38);
});

test("invalid or oversized comment card drafts are ignored", () => {
  const key = commentCardDraftKey("user-a", "church");
  assert.equal(readCommentCardDraft({ getItem: () => JSON.stringify({ version: 1, name: "Ada" }) }, key), null);
  assert.equal(readCommentCardDraft({ getItem: () => "x".repeat(33_000) }, key), null);
});

test("active name template is loaded each time the comment card opens", () => {
  assert.equal(resolveCommentCardInitialDraft(null, "Sunday comments").filename, "Sunday comments");
  assert.equal(resolveCommentCardInitialDraft(null, null).filename, "comment-card");
  const saved = { ...COMMENT_CARD_EMPTY_DRAFT, name: "Ada", comment: "Thank you", filename: "Manually named" };
  assert.deepEqual(resolveCommentCardInitialDraft(saved, "Sunday comments"), { ...saved, filename: "Sunday comments" });
  assert.deepEqual(resolveCommentCardInitialDraft(saved, null), saved);
});
