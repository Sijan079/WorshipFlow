import test from "node:test";
import assert from "node:assert/strict";
import { draftDeadline, draftExpired, DRAFT_TTL_MS, CONNECTION_GRACE_MS, mayWriteDraft } from "./draft-lifecycle.ts";

test("released drafts expire at the exact one-hour boundary", () => {
  const draft = { expiresAt: 1000 + DRAFT_TTL_MS, lastSeenAt: 1000, sessionId: null, revision: 2 };
  assert.equal(draftExpired(draft, draft.expiresAt - 1), false);
  assert.equal(draftExpired(draft, draft.expiresAt), true);
});
test("lost sessions have five minutes grace before their hour begins", () => {
  const draft = { expiresAt: null, lastSeenAt: 1000, sessionId: "first", revision: 2 };
  assert.equal(draftDeadline(draft), 1000 + CONNECTION_GRACE_MS + DRAFT_TTL_MS);
  assert.equal(draftExpired(draft, 1000 + CONNECTION_GRACE_MS), false);
});
test("stale sessions and revisions cannot overwrite or revive a draft", () => {
  const draft = { expiresAt: null, lastSeenAt: 1000, sessionId: "second", revision: 3 };
  assert.equal(mayWriteDraft(draft, "first", 3, 1001), false);
  assert.equal(mayWriteDraft(draft, "second", 2, 1001), false);
  assert.equal(mayWriteDraft(draft, "second", 3, 1001), true);
  assert.equal(mayWriteDraft(draft, "second", 3, draftDeadline(draft)), false);
});
