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

test("a problem inside a Section is reported on the block inside, and a picture background asks for a picture", () => {
  const button = { key: "child-button", type: "BUTTON" as const, content: { label: "", link: { kind: "page" as const, slug: "visit" }, align: "left" as const } };
  const section = { key: "section-1", type: "SECTION" as const, content: { background: "tinted" as const, overlay: "medium" as const, padding: "medium" as const, inner: "content" as const, width: "full" as const, blocks: [button] } };
  const problems = blockProblems([section]);
  assert.ok(problems.get("child-button"), "the block inside is named");
  assert.equal(problems.has("section-1"), false, "the Section itself is fine");
  const noPicture = { ...section, key: "section-2", content: { ...section.content, background: "picture" as const, blocks: [] } };
  assert.match(blockProblems([noPicture]).get("section-2") ?? "", /picture/i);
});

test("a Cover asks for a headline, and names a button that has no words or a bad link", () => {
  const cover = { key: "cover-1", type: "COVER" as const, content: { headline: "", overlay: "medium" as const, height: "tall" as const, align: "center" as const, focus: "center" as const, width: "full" as const, buttons: [] } };
  assert.match(blockProblems([cover]).get("cover-1") ?? "", /headline/i);
  const badLink = { ...cover, key: "cover-2", content: { ...cover.content, headline: "Hi", buttons: [{ label: "Go", link: { kind: "url" as const, url: "https://" }, style: "filled" as const }] } };
  assert.match(blockProblems([badLink]).get("cover-2") ?? "", /web address/i);
  const fine = { ...cover, key: "cover-3", content: { ...cover.content, headline: "Welcome" } };
  assert.equal(blockProblems([fine]).size, 0);
});

test("a problem inside a column is reported on the block inside it, also when the Columns sit in a Section", () => {
  const bad = { key: "bad-button", type: "BUTTON" as const, content: { label: "", link: { kind: "page" as const, slug: "visit" }, align: "left" as const } };
  const columns = { key: "columns-1", type: "COLUMNS" as const, content: { valign: "top" as const, cards: false, width: "wide" as const, columns: [{ key: "col-1", blocks: [bad] }, { key: "col-2", blocks: [] }] } };
  const problems = blockProblems([columns]);
  assert.ok(problems.get("bad-button"));
  assert.equal(problems.has("columns-1"), false);
  const section = { key: "section-3", type: "SECTION" as const, content: { background: "none" as const, overlay: "medium" as const, padding: "small" as const, inner: "wide" as const, width: "full" as const, blocks: [columns] } };
  assert.ok(blockProblems([section]).get("bad-button"));
});

test("a new picture block asks for a picture before anything else", () => {
  const image = newBlock("IMAGE");
  assert.match(blockProblems([image]).get(image.key) ?? "", /choose a picture/i);
});

test("a card without a title is named, and the Carousel itself is not blamed", () => {
  const carousel = newBlock("CAROUSEL");
  assert.match(blockProblems([carousel]).get(carousel.key) ?? "", /title/i);
  const section = { key: "s", type: "SECTION" as const, content: { background: "none" as const, overlay: "medium" as const, padding: "small" as const, inner: "wide" as const, width: "full" as const, blocks: [carousel as never] } };
  assert.match(blockProblems([section]).get(carousel.key) ?? "", /title/i);
});
