import test from "node:test";
import assert from "node:assert/strict";
import { DraftRequestSchema } from "./draft-contract.ts";

const content = { text: "[Verse]\nA lyric", songTitle: "Way Maker", warningCodes: [], warningsDismissed: false, directAiReformatUsed: false };
const identity = { conversionId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222" };
test("draft commands validate identities, actions, revision and payload bounds", () => {
  for (const action of ["resume", "takeover", "heartbeat", "release", "clear"]) assert.equal(DraftRequestSchema.safeParse({ action, ...identity }).success, true);
  assert.equal(DraftRequestSchema.safeParse({ action: "publish", ...identity }).success, false);
  assert.equal(DraftRequestSchema.safeParse({ action: "resume", ...identity, conversionId: "someone else's document" }).success, false);
  assert.equal(DraftRequestSchema.safeParse({ action: "save", ...identity, revision: -1, content }).success, false);
  assert.equal(DraftRequestSchema.safeParse({ action: "save", ...identity, revision: 0, content: { ...content, text: "a".repeat(1_000_001) } }).success, false);
  const result = DraftRequestSchema.parse({ action: "save", ...identity, revision: 0, userId: "injected", content: { ...content, retryToken: "do-not-store" } });
  assert.equal("userId" in result, false);
  assert.equal("content" in result && "retryToken" in result.content, false);
});
