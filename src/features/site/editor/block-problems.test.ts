import assert from "node:assert/strict";
import { test } from "node:test";
import { blockProblems } from "./block-problems.ts";
import { newBlock } from "./editor-state.ts";

test("a fresh button points nowhere yet, and says so in plain words", () => {
  const button = newBlock("BUTTON");
  const problems = blockProblems([button]);
  assert.match(problems.get(button.key) ?? "", /web address/i);
});

test("a valid page has no problems", () => {
  const heading = newBlock("HEADING");
  const paragraph = newBlock("PARAGRAPH");
  assert.equal(blockProblems([heading, paragraph]).size, 0);
});

test("an image without a description is a problem", () => {
  const image = { key: "k1", type: "IMAGE" as const, content: { path: "site/abc.webp", alt: "", align: "left" as const } };
  assert.match(blockProblems([image]).get("k1") ?? "", /describe/i);
});

test("a button with an empty label is a problem", () => {
  const button = { key: "k2", type: "BUTTON" as const, content: { label: "", link: { kind: "page" as const, slug: "visit" }, align: "left" as const } };
  assert.ok(blockProblems([button]).get(button.key));
});

test("a new picture block asks for a picture before anything else", () => {
  const image = newBlock("IMAGE");
  assert.match(blockProblems([image]).get(image.key) ?? "", /choose a picture/i);
});
