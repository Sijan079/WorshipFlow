import assert from "node:assert/strict";
import test from "node:test";
import { draftStorageKey, readDraft, writeDraft } from "./recovery.ts";

test("draft recovery is scoped to both user and workspace and omits credentials", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const key = draftStorageKey("user-1", "church-a");
  assert.notEqual(key, draftStorageKey("user-2", "church-a"));
  assert.notEqual(key, draftStorageKey("user-1", "church-b"));
  writeDraft(storage, key, { text: "[Verse]\nHello", songTitle: "Song", warningCodes: [], warningsDismissed: false, directAiReformatUsed: true, retryToken: "secret" });
  assert.equal(readDraft(storage, key)?.text, "[Verse]\nHello");
  assert.ok(!values.get(key)?.includes("secret"));
  assert.equal(readDraft(storage, draftStorageKey("user-2", "church-a")), null);
});

test("malformed, future-version and oversized drafts are rejected", () => {
  for (const value of ["{", '{"version":99}', JSON.stringify({ version: 1, text: "x".repeat(1_000_001) })]) {
    assert.equal(readDraft({ getItem: () => value }, "draft"), null);
  }
});
