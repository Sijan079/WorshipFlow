import assert from "node:assert/strict";
import test from "node:test";
import { parseCopiedComment } from "./comment-card-clipboard.ts";

test("reads a copied commenter and multiline comment", () => {
  assert.deepEqual(parseCopiedComment("Maria Santos\nThank you for the service.\nWe were encouraged!"), {
    name: "Maria Santos",
    comment: "Thank you for the service.\nWe were encouraged!",
  });
});

test("drops common Facebook timestamp and action lines", () => {
  assert.deepEqual(parseCopiedComment("Maria Santos\n2d\nThank you, team!\nLike\nReply"), {
    name: "Maria Santos",
    comment: "Thank you, team!",
  });
});

test("accepts a name and comment on one line", () => {
  assert.deepEqual(parseCopiedComment("Maria Santos: Thank you, team!"), {
    name: "Maria Santos",
    comment: "Thank you, team!",
  });
});

test("does not guess a commenter from comment-only or oversized text", () => {
  assert.equal(parseCopiedComment("Thank you, team!"), null);
  assert.equal(parseCopiedComment(`Maria Santos\n${"x".repeat(10_001)}`), null);
});
