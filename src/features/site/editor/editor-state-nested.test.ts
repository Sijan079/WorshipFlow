import assert from "node:assert/strict";
import { test } from "node:test";
import { countEditorBlocks, editorReducer, initialEditorState, newBlock, stripKeys, withKeys, type EditorState } from "./editor-state.ts";

const types = (state: EditorState) => state.blocks.map((block) => block.type);

function start(...kinds: Array<Parameters<typeof newBlock>[0]>) {
  return kinds.reduce((state, kind) => editorReducer(state, { type: "add", block: newBlock(kind) }), initialEditorState([]));
}

const inside = (state: EditorState, index = 0) => {
  const section = state.blocks[index];
  assert.equal(section.type, "SECTION");
  return section.type === "SECTION" ? section.content.blocks : [];
};

function withSection() {
  return editorReducer(start("HEADING"), { type: "add", block: newBlock("SECTION") });
}

test("a new Section starts empty, as a full-width tinted band", () => {
  const section = newBlock("SECTION");
  assert.equal(section.type, "SECTION");
  if (section.type === "SECTION") {
    assert.deepEqual(section.content.blocks, []);
    assert.equal(section.content.width, "full");
    assert.equal(section.content.background, "tinted");
  }
});

test("a block can be added inside a Section, at the end or after another block inside it", () => {
  let state = withSection();
  const sectionKey = state.blocks[1].key;
  state = editorReducer(state, { type: "add", block: newBlock("PARAGRAPH"), parentKey: sectionKey });
  state = editorReducer(state, { type: "add", block: newBlock("BUTTON"), parentKey: sectionKey });
  assert.deepEqual(inside(state, 1).map((block) => block.type), ["PARAGRAPH", "BUTTON"]);
  state = editorReducer(state, { type: "add", block: newBlock("QUOTE"), parentKey: sectionKey, afterKey: inside(state, 1)[0].key });
  assert.deepEqual(inside(state, 1).map((block) => block.type), ["PARAGRAPH", "QUOTE", "BUTTON"]);
  assert.deepEqual(types(state), ["HEADING", "SECTION"], "the page level is untouched");
});

test("a Section cannot be added inside a Section", () => {
  const state = withSection();
  const after = editorReducer(state, { type: "add", block: newBlock("SECTION"), parentKey: state.blocks[1].key });
  assert.equal(after, state);
});

test("blocks inside a Section move only within it, are edited in place, and can be deleted", () => {
  let state = withSection();
  const sectionKey = state.blocks[1].key;
  for (const kind of ["HEADING", "PARAGRAPH", "QUOTE"] as const) state = editorReducer(state, { type: "add", block: newBlock(kind), parentKey: sectionKey });
  const [first, , last] = inside(state, 1).map((block) => block.key);
  state = editorReducer(state, { type: "move", key: last, direction: "up" });
  assert.deepEqual(inside(state, 1).map((block) => block.type), ["HEADING", "QUOTE", "PARAGRAPH"]);
  state = editorReducer(state, { type: "move", key: first, direction: "up" });
  assert.deepEqual(inside(state, 1).map((block) => block.type), ["HEADING", "QUOTE", "PARAGRAPH"], "no leaving the Section by moving up");
  state = editorReducer(state, { type: "update", key: first, content: { text: "Welcome", level: 2, align: "center" } });
  const heading = inside(state, 1)[0];
  assert.equal(heading.type === "HEADING" ? heading.content.text : "", "Welcome");
  state = editorReducer(state, { type: "remove", key: first });
  assert.deepEqual(inside(state, 1).map((block) => block.type), ["QUOTE", "PARAGRAPH"]);
});

test("a Section's own settings can be changed, and its blocks are kept", () => {
  let state = withSection();
  state = editorReducer(state, { type: "add", block: newBlock("PARAGRAPH"), parentKey: state.blocks[1].key });
  const current = state.blocks[1];
  if (current.type !== "SECTION") throw new Error("expected a Section");
  state = editorReducer(state, { type: "update", key: current.key, content: { ...current.content, background: "dark" } });
  const after = state.blocks[1];
  assert.equal(after.type === "SECTION" ? after.content.background : "", "dark");
  assert.equal(after.type === "SECTION" ? after.content.blocks.length : 0, 1);
});

test("undo and redo step through changes made inside a Section", () => {
  let state = withSection();
  state = editorReducer(state, { type: "add", block: newBlock("PARAGRAPH"), parentKey: state.blocks[1].key });
  state = editorReducer(state, { type: "undo" });
  assert.equal(inside(state, 1).length, 0);
  state = editorReducer(state, { type: "redo" });
  assert.equal(inside(state, 1).length, 1);
});

test("typing in a block inside a Section is one undo step", () => {
  let state = withSection();
  state = editorReducer(state, { type: "add", block: newBlock("HEADING"), parentKey: state.blocks[1].key });
  const key = inside(state, 1)[0].key;
  const before = state.past.length;
  for (const text of ["W", "We", "Wel"]) state = editorReducer(state, { type: "update", key, content: { text, level: 2, align: "left" }, coalesce: true });
  assert.equal(state.past.length, before + 1);
});

test("blocks are counted at every level, and nothing is added past 100 in all or past 30 inside a Section", () => {
  let state = withSection();
  const sectionKey = state.blocks[1].key;
  for (let i = 0; i < 40; i += 1) state = editorReducer(state, { type: "add", block: newBlock("SPACER"), parentKey: sectionKey });
  assert.equal(inside(state, 1).length, 30, "a Section holds at most 30");
  assert.equal(countEditorBlocks(state.blocks), 2 + 30);
  for (let i = 0; i < 100; i += 1) state = editorReducer(state, { type: "add", block: newBlock("SPACER") });
  assert.equal(countEditorBlocks(state.blocks), 100, "a page holds at most 100 in all");
});

test("keys are added at every level when a saved page is loaded, and stripped again for saving", () => {
  const saved = [{ type: "SECTION" as const, content: { background: "dark" as const, overlay: "medium" as const, padding: "large" as const, inner: "wide" as const, width: "full" as const, blocks: [{ type: "SPACER" as const, content: { size: "small" as const } }] } }];
  const keyed = withKeys(saved);
  const section = keyed[0];
  assert.ok(section.key);
  assert.ok(section.type === "SECTION" && section.content.blocks[0].key, "the block inside has a key too");
  assert.deepEqual(stripKeys(keyed), saved);
});
