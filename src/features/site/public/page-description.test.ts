import assert from "node:assert/strict";
import { test } from "node:test";
import { pageDescription } from "./page-description.ts";

const paragraph = (text: string) => ({ type: "PARAGRAPH" as const, content: { runs: [{ text }], align: "left" as const, size: "normal" as const } });

test("the page's own description wins", () => {
  assert.equal(pageDescription({ description: "Plan your visit.", blocks: [paragraph("Something else")] }), "Plan your visit.");
});

test("without one, the first paragraph is used", () => {
  assert.equal(pageDescription({ description: null, blocks: [{ type: "SPACER", content: { size: "small" } }, paragraph("You are welcome here.")] }), "You are welcome here.");
});

test("a long first paragraph is cut at a word, with an ellipsis, at about 160 characters", () => {
  const text = "word ".repeat(100).trim();
  const result = pageDescription({ description: null, blocks: [paragraph(text)] }) ?? "";
  assert.ok(result.length <= 161, String(result.length));
  assert.ok(result.endsWith("…"));
  assert.ok(!result.slice(0, -1).endsWith(" "));
});

test("the first paragraph inside a Section counts too", () => {
  const section = { type: "SECTION" as const, content: { background: "tinted" as const, overlay: "medium" as const, padding: "medium" as const, inner: "content" as const, width: "full" as const, blocks: [paragraph("Come as you are.")] } };
  assert.equal(pageDescription({ description: null, blocks: [section] }), "Come as you are.");
});

test("a Cover's line of text can supply the description, when it comes first", () => {
  const cover = { type: "COVER" as const, content: { headline: "Welcome", text: "A place to belong.", overlay: "medium" as const, height: "tall" as const, align: "center" as const, focus: "center" as const, width: "full" as const, buttons: [] } };
  assert.equal(pageDescription({ description: null, blocks: [cover, paragraph("Later paragraph")] }), "A place to belong.");
});

test("an empty paragraph is skipped, and no text at all gives nothing", () => {
  assert.equal(pageDescription({ description: "  ", blocks: [paragraph("   "), paragraph("Hello")] }), "Hello");
  assert.equal(pageDescription({ description: null, blocks: [] }), null);
});
