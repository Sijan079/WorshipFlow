import assert from "node:assert/strict";
import { test } from "node:test";
import { SITE_LIMITS } from "../blocks/block-validation.ts";
import { countEditorBlocks, editorReducer, initialEditorState, newBlock, newMinistriesShowcase, stripKeys, withKeys, type EditorBlock, type EditorState, type KeyedCarousel, type KeyedSection } from "./editor-state.ts";

const empty = () => initialEditorState([]);
const asCarousel = (block: EditorBlock): KeyedCarousel => {
  assert.equal(block.type, "CAROUSEL");
  return block as KeyedCarousel;
};
const types = (state: EditorState) => state.blocks.map((block) => block.type);

test("a new Carousel starts with three empty cards, three showing at once, and wide", () => {
  const block = asCarousel(newBlock("CAROUSEL"));
  assert.equal(block.content.slides.length, 3);
  assert.ok(block.content.slides.every((slide) => slide.title === ""));
  assert.equal(block.content.perView, 3);
  assert.equal(block.content.width, "wide");
});

test("a Carousel goes on the page, can be edited and moved, and counts its cards", () => {
  let state = editorReducer(empty(), { type: "add", block: newBlock("PARAGRAPH") });
  state = editorReducer(state, { type: "add", block: newBlock("CAROUSEL") });
  assert.deepEqual(types(state), ["PARAGRAPH", "CAROUSEL"]);
  assert.equal(countEditorBlocks(state.blocks), 1 + 1 + 3);
  const carousel = asCarousel(state.blocks[1]);
  state = editorReducer(state, { type: "update", key: carousel.key, content: { ...carousel.content, perView: 2 } });
  assert.equal(asCarousel(state.blocks[1]).content.perView, 2);
  state = editorReducer(state, { type: "move", key: carousel.key, direction: "up" });
  assert.deepEqual(types(state), ["CAROUSEL", "PARAGRAPH"]);
});

test("a Carousel can go inside a Section, but not inside a column", () => {
  let state = editorReducer(empty(), { type: "add", block: newBlock("SECTION") });
  const sectionKey = state.blocks[0].key;
  state = editorReducer(state, { type: "add", block: newBlock("CAROUSEL"), parentKey: sectionKey });
  const section = state.blocks[0] as KeyedSection;
  assert.equal(section.content.blocks[0].type, "CAROUSEL");
  let withColumns = editorReducer(empty(), { type: "add", block: newBlock("COLUMNS") });
  const columnKey = (withColumns.blocks[0] as { content: { columns: Array<{ key: string }> } }).content.columns[0].key;
  const before = withColumns;
  withColumns = editorReducer(withColumns, { type: "add", block: newBlock("CAROUSEL"), parentKey: columnKey });
  assert.equal(withColumns, before);
});

test("blocks are counted at every level, and a Carousel's cards use up room on the page", () => {
  let state = empty();
  for (let i = 0; i < 97; i += 1) state = editorReducer(state, { type: "add", block: newBlock("SPACER") });
  const before = state;
  assert.equal(editorReducer(state, { type: "add", block: newBlock("CAROUSEL") }), before, "the carousel and its three cards would make 101");
});

test("the Ministries showcase is a Section holding a heading, a line of words and a Carousel of cards", () => {
  const showcase = newMinistriesShowcase();
  assert.equal(showcase.type, "SECTION");
  const kinds = showcase.content.blocks.map((block) => block.type);
  assert.deepEqual(kinds, ["HEADING", "PARAGRAPH", "CAROUSEL"]);
  const carousel = showcase.content.blocks[2] as KeyedCarousel;
  assert.ok(carousel.content.slides.length >= 3);
  assert.ok(carousel.content.slides.every((slide) => slide.title.length > 0), "the starter cards have titles, ready to rename");
  assert.equal(showcase.content.inner, "wide");
});

test("the Ministries showcase is added only when all of it fits on the page", () => {
  let state = empty();
  for (let i = 0; i < 95; i += 1) state = editorReducer(state, { type: "add", block: newBlock("SPACER") });
  const showcase = newMinistriesShowcase();
  const size = countEditorBlocks([showcase]);
  assert.ok(size > 5);
  const before = state;
  assert.equal(editorReducer(state, { type: "add", block: showcase }), before);
  assert.ok(SITE_LIMITS.blocksPerPage - countEditorBlocks(state.blocks) < size);
});

test("keys are added to a Carousel on the page and in a Section, and stripped again for saving", () => {
  const carousel = { type: "CAROUSEL" as const, content: { slides: [{ title: "A" }, { title: "B", text: "x" }], perView: 3 as const, width: "wide" as const } };
  const saved = [carousel, { type: "SECTION" as const, content: { background: "none" as const, overlay: "medium" as const, padding: "small" as const, inner: "wide" as const, width: "full" as const, blocks: [carousel] } }];
  const keyed = withKeys(saved);
  assert.ok(keyed[0].key);
  const section = keyed[1] as KeyedSection;
  assert.ok(section.content.blocks[0].key);
  assert.deepEqual(stripKeys(keyed), saved);
});
