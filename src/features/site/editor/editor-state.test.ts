import assert from "node:assert/strict";
import { test } from "node:test";
import { SITE_LIMITS } from "../blocks/block-validation.ts";
import { canRedo, canUndo, editorReducer, initialEditorState, newBlock, type EditorState } from "./editor-state.ts";

const spacer = () => newBlock("SPACER");
const types = (state: EditorState) => state.blocks.map((block) => block.type);

function start(...kinds: Array<Parameters<typeof newBlock>[0]>) {
  return kinds.reduce((state, kind) => editorReducer(state, { type: "add", block: newBlock(kind) }), initialEditorState([]));
}

test("every block kind can be created with valid, empty-ish content", () => {
  for (const kind of ["PARAGRAPH", "HEADING", "LIST", "QUOTE", "BUTTON", "SPACER", "SERVICE_TIMES", "ANNOUNCEMENTS_LIST", "EVENTS_LIST", "CONTACT"] as const) {
    assert.equal(newBlock(kind).type, kind);
  }
});

test("adding puts a block at the end, or right after the chosen one", () => {
  let state = start("HEADING", "PARAGRAPH");
  assert.deepEqual(types(state), ["HEADING", "PARAGRAPH"]);
  state = editorReducer(state, { type: "add", block: spacer(), afterKey: state.blocks[0].key });
  assert.deepEqual(types(state), ["HEADING", "SPACER", "PARAGRAPH"]);
});

test("a page cannot grow past 60 blocks", () => {
  let state = initialEditorState([]);
  for (let i = 0; i < SITE_LIMITS.blocksPerPage + 5; i += 1) state = editorReducer(state, { type: "add", block: spacer() });
  assert.equal(state.blocks.length, SITE_LIMITS.blocksPerPage);
});

test("blocks move up and down, and stop at the ends", () => {
  let state = start("HEADING", "PARAGRAPH", "QUOTE");
  const [first, , last] = state.blocks.map((block) => block.key);
  state = editorReducer(state, { type: "move", key: last, direction: "up" });
  assert.deepEqual(types(state), ["HEADING", "QUOTE", "PARAGRAPH"]);
  state = editorReducer(state, { type: "move", key: first, direction: "up" });
  assert.deepEqual(types(state), ["HEADING", "QUOTE", "PARAGRAPH"], "the first block cannot go higher");
  state = editorReducer(state, { type: "move", key: first, direction: "down" });
  assert.deepEqual(types(state), ["QUOTE", "HEADING", "PARAGRAPH"]);
});

test("deleting removes only that block", () => {
  let state = start("HEADING", "PARAGRAPH");
  state = editorReducer(state, { type: "remove", key: state.blocks[0].key });
  assert.deepEqual(types(state), ["PARAGRAPH"]);
});

test("undo and redo step through changes", () => {
  let state = start("HEADING", "PARAGRAPH");
  assert.equal(canUndo(state), true);
  state = editorReducer(state, { type: "undo" });
  assert.deepEqual(types(state), ["HEADING"]);
  assert.equal(canRedo(state), true);
  state = editorReducer(state, { type: "redo" });
  assert.deepEqual(types(state), ["HEADING", "PARAGRAPH"]);
  assert.equal(canRedo(state), false);
});

test("a new change after an undo drops the redo history", () => {
  let state = start("HEADING", "PARAGRAPH");
  state = editorReducer(state, { type: "undo" });
  state = editorReducer(state, { type: "add", block: spacer() });
  assert.equal(canRedo(state), false);
});

test("typing in one block is one undo step, not one per letter", () => {
  let state = start("HEADING");
  const key = state.blocks[0].key;
  const before = state.past.length;
  for (const text of ["W", "We", "Wel", "Welc"]) {
    state = editorReducer(state, { type: "update", key, content: { text, level: 2, align: "left" }, coalesce: true });
  }
  assert.equal(state.past.length, before + 1);
  state = editorReducer(state, { type: "undo" });
  assert.equal((state.blocks[0].content as { text: string }).text, "", "one undo takes back all the typing");
});

test("typing in a different block starts a new undo step", () => {
  let state = start("HEADING", "HEADING");
  const [a, b] = state.blocks.map((block) => block.key);
  state = editorReducer(state, { type: "update", key: a, content: { text: "A", level: 2, align: "left" }, coalesce: true });
  const afterA = state.past.length;
  state = editorReducer(state, { type: "update", key: b, content: { text: "B", level: 2, align: "left" }, coalesce: true });
  assert.equal(state.past.length, afterA + 1);
});

test("undo history is limited so a long session stays light", () => {
  let state = initialEditorState([]);
  for (let i = 0; i < 150; i += 1) {
    state = editorReducer(state, { type: "add", block: spacer() });
    state = editorReducer(state, { type: "remove", key: state.blocks[0].key });
  }
  assert.ok(state.past.length <= 100);
});

test("loading a saved page starts with a clean history", () => {
  const state = initialEditorState([spacer()]);
  assert.equal(canUndo(state), false);
  assert.equal(canRedo(state), false);
  assert.equal(state.blocks.length, 1);
});
