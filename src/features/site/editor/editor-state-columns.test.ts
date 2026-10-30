import assert from "node:assert/strict";
import { test } from "node:test";
import { SITE_LIMITS } from "../blocks/block-validation.ts";
import { countEditorBlocks, editorReducer, initialEditorState, newBlock, newColumnsLayout, stripKeys, withKeys, type EditorBlock, type EditorState, type KeyedColumns } from "./editor-state.ts";

const empty = () => initialEditorState([]);
const asColumns = (block: EditorBlock): KeyedColumns => {
  assert.equal(block.type, "COLUMNS");
  return block as KeyedColumns;
};
const columnsOf = (state: EditorState, index = 0) => asColumns(state.blocks[index]).content.columns;

function withColumns(count = 2) {
  let state = editorReducer(empty(), { type: "add", block: newBlock("COLUMNS") });
  if (count !== 2) state = editorReducer(state, { type: "setColumns", key: state.blocks[0].key, count });
  return state;
}

test("new Columns start as two empty columns, side by side, without the card look", () => {
  const block = asColumns(newBlock("COLUMNS"));
  assert.equal(block.content.columns.length, 2);
  assert.deepEqual(block.content.columns.map((column) => column.blocks.length), [0, 0]);
  assert.equal(block.content.cards, false);
  assert.equal(block.content.valign, "top");
  assert.ok(block.content.columns.every((column) => column.key), "each column has its own key");
});

test("the ready-made layouts: picture and text on either side, three cards, two columns", () => {
  const left = asColumns(newColumnsLayout("picture-left"));
  assert.deepEqual(left.content.columns.map((column) => column.blocks.map((block) => block.type)), [["IMAGE"], ["HEADING", "PARAGRAPH"]]);
  assert.equal(left.content.valign, "center");
  const right = asColumns(newColumnsLayout("picture-right"));
  assert.deepEqual(right.content.columns.map((column) => column.blocks.map((block) => block.type)), [["HEADING", "PARAGRAPH"], ["IMAGE"]]);
  const cards = asColumns(newColumnsLayout("cards-3"));
  assert.equal(cards.content.columns.length, 3);
  assert.equal(cards.content.cards, true);
  assert.ok(cards.content.columns.every((column) => column.blocks.map((block) => block.type).join() === "HEADING,PARAGRAPH"));
  const two = asColumns(newColumnsLayout("two-columns"));
  assert.equal(two.content.columns.length, 2);
  assert.equal(two.content.cards, false);
});

test("a block is added into a column by that column's key, at the end or after another block", () => {
  let state = withColumns();
  const [first, second] = columnsOf(state).map((column) => column.key);
  state = editorReducer(state, { type: "add", block: newBlock("HEADING"), parentKey: first });
  state = editorReducer(state, { type: "add", block: newBlock("BUTTON"), parentKey: first });
  state = editorReducer(state, { type: "add", block: newBlock("PARAGRAPH"), parentKey: second });
  state = editorReducer(state, { type: "add", block: newBlock("QUOTE"), parentKey: first, afterKey: columnsOf(state)[0].blocks[0].key });
  assert.deepEqual(columnsOf(state)[0].blocks.map((block) => block.type), ["HEADING", "QUOTE", "BUTTON"]);
  assert.deepEqual(columnsOf(state)[1].blocks.map((block) => block.type), ["PARAGRAPH"]);
});

test("blocks in a column move only within it, are edited in place, and can be deleted", () => {
  let state = withColumns();
  const first = columnsOf(state)[0].key;
  for (const kind of ["HEADING", "PARAGRAPH", "QUOTE"] as const) state = editorReducer(state, { type: "add", block: newBlock(kind), parentKey: first });
  const [a, , c] = columnsOf(state)[0].blocks.map((block) => block.key);
  state = editorReducer(state, { type: "move", key: c, direction: "up" });
  assert.deepEqual(columnsOf(state)[0].blocks.map((block) => block.type), ["HEADING", "QUOTE", "PARAGRAPH"]);
  state = editorReducer(state, { type: "move", key: a, direction: "up" });
  assert.deepEqual(columnsOf(state)[0].blocks.map((block) => block.type), ["HEADING", "QUOTE", "PARAGRAPH"], "no leaving the column by moving up");
  state = editorReducer(state, { type: "update", key: a, content: { text: "Visit", level: 3, align: "left" } });
  const heading = columnsOf(state)[0].blocks[0];
  assert.equal(heading.type === "HEADING" ? heading.content.text : "", "Visit");
  state = editorReducer(state, { type: "remove", key: a });
  assert.deepEqual(columnsOf(state)[0].blocks.map((block) => block.type), ["QUOTE", "PARAGRAPH"]);
});

test("the settings of Columns can be changed without losing the blocks inside", () => {
  let state = withColumns();
  state = editorReducer(state, { type: "add", block: newBlock("PARAGRAPH"), parentKey: columnsOf(state)[0].key });
  const block = asColumns(state.blocks[0]);
  state = editorReducer(state, { type: "update", key: block.key, content: { ...block.content, cards: true, valign: "center" } });
  const after = asColumns(state.blocks[0]);
  assert.equal(after.content.cards, true);
  assert.equal(after.content.valign, "center");
  assert.equal(after.content.columns[0].blocks.length, 1);
});

test("Columns can be added inside a Section, and blocks can be added into those columns", () => {
  let state = editorReducer(empty(), { type: "add", block: newBlock("SECTION") });
  const sectionKey = state.blocks[0].key;
  state = editorReducer(state, { type: "add", block: newBlock("COLUMNS"), parentKey: sectionKey });
  const section = state.blocks[0];
  assert.equal(section.type, "SECTION");
  const inner = section.type === "SECTION" ? section.content.blocks[0] : null;
  assert.equal(inner?.type, "COLUMNS");
  const columnKey = (inner as KeyedColumns).content.columns[0].key;
  state = editorReducer(state, { type: "add", block: newBlock("PARAGRAPH"), parentKey: columnKey });
  const after = state.blocks[0];
  const columns = after.type === "SECTION" ? (after.content.blocks[0] as KeyedColumns).content.columns : [];
  assert.equal(columns[0].blocks.length, 1);
});

test("Columns cannot go inside a column, and a Section or Cover cannot either", () => {
  const state = withColumns();
  const columnKey = columnsOf(state)[0].key;
  for (const kind of ["COLUMNS", "SECTION", "COVER"] as const) {
    assert.equal(editorReducer(state, { type: "add", block: newBlock(kind), parentKey: columnKey }), state, kind);
  }
});

test("the number of columns can go up to four, and new columns start empty", () => {
  let state = withColumns();
  state = editorReducer(state, { type: "add", block: newBlock("PARAGRAPH"), parentKey: columnsOf(state)[0].key });
  state = editorReducer(state, { type: "setColumns", key: state.blocks[0].key, count: 4 });
  assert.deepEqual(columnsOf(state).map((column) => column.blocks.length), [1, 0, 0, 0]);
  assert.equal(new Set(columnsOf(state).map((column) => column.key)).size, 4, "every column has its own key");
});

test("fewer columns are allowed only when the ones that would go are empty, so nothing is lost", () => {
  let state = withColumns(3);
  state = editorReducer(state, { type: "add", block: newBlock("PARAGRAPH"), parentKey: columnsOf(state)[2].key });
  const blocked = editorReducer(state, { type: "setColumns", key: state.blocks[0].key, count: 2 });
  assert.equal(blocked, state, "the third column has a block in it");
  const emptied = editorReducer(state, { type: "remove", key: columnsOf(state)[2].blocks[0].key });
  const reduced = editorReducer(emptied, { type: "setColumns", key: emptied.blocks[0].key, count: 2 });
  assert.equal(columnsOf(reduced).length, 2);
  assert.equal(editorReducer(reduced, { type: "setColumns", key: reduced.blocks[0].key, count: 1 }), reduced, "never fewer than two");
  assert.equal(editorReducer(reduced, { type: "setColumns", key: reduced.blocks[0].key, count: 5 }), reduced, "never more than four");
});

test("undo and redo step through changes made inside columns, including changing the count", () => {
  let state = withColumns();
  state = editorReducer(state, { type: "add", block: newBlock("PARAGRAPH"), parentKey: columnsOf(state)[0].key });
  state = editorReducer(state, { type: "setColumns", key: state.blocks[0].key, count: 3 });
  state = editorReducer(state, { type: "undo" });
  assert.equal(columnsOf(state).length, 2);
  state = editorReducer(state, { type: "undo" });
  assert.equal(columnsOf(state)[0].blocks.length, 0);
  state = editorReducer(state, { type: "redo" });
  assert.equal(columnsOf(state)[0].blocks.length, 1);
});

test("a column holds at most 15 blocks, and the page at most 100 in all", () => {
  let state = withColumns();
  const columnKey = columnsOf(state)[0].key;
  for (let i = 0; i < 20; i += 1) state = editorReducer(state, { type: "add", block: newBlock("SPACER"), parentKey: columnKey });
  assert.equal(columnsOf(state)[0].blocks.length, SITE_LIMITS.columnBlocks);
  assert.equal(countEditorBlocks(state.blocks), 1 + 15, "Columns counts once and so does each block in it");
  for (let i = 0; i < 100; i += 1) state = editorReducer(state, { type: "add", block: newBlock("SPACER") });
  assert.equal(countEditorBlocks(state.blocks), SITE_LIMITS.blocksPerPage);
});

test("a ready-made layout is not added when it would not fit on the page", () => {
  let state = empty();
  for (let i = 0; i < 99; i += 1) state = editorReducer(state, { type: "add", block: newBlock("SPACER") });
  const before = state;
  assert.equal(editorReducer(state, { type: "add", block: newColumnsLayout("cards-3") }), before, "the layout holds 7 blocks, and only one fits");
});

test("keys are added at every level, including inside columns, and stripped again for saving", () => {
  const saved = [
    { type: "COLUMNS" as const, content: { valign: "top" as const, cards: true, width: "wide" as const, columns: [{ blocks: [{ type: "SPACER" as const, content: { size: "small" as const } }] }, { blocks: [] }] } },
    { type: "SECTION" as const, content: { background: "none" as const, overlay: "medium" as const, padding: "small" as const, inner: "wide" as const, width: "full" as const, blocks: [
      { type: "COLUMNS" as const, content: { valign: "center" as const, cards: false, width: "wide" as const, columns: [{ blocks: [{ type: "SPACER" as const, content: { size: "large" as const } }] }, { blocks: [] }] } },
    ] } },
  ];
  const keyed = withKeys(saved);
  const top = asColumns(keyed[0]);
  assert.ok(top.key && top.content.columns.every((column) => column.key));
  assert.ok(top.content.columns[0].blocks[0].key);
  const section = keyed[1];
  const innerColumns = section.type === "SECTION" ? (section.content.blocks[0] as KeyedColumns) : null;
  assert.ok(innerColumns?.key && innerColumns.content.columns[0].blocks[0].key);
  assert.deepEqual(stripKeys(keyed), saved);
});
