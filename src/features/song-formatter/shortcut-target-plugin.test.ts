import assert from "node:assert/strict";
import test from "node:test";
import { EditorState, TextSelection } from "prosemirror-state";
import { documentFromText } from "./document.ts";
import { shortcutTargetLine, shortcutTargetPlugin, shortcutTargetTransaction } from "./shortcut-target-plugin.ts";

test("shortcut target decorates the caret line only while shortcut mode is active", () => {
  let state = EditorState.create({ doc: documentFromText("[Verse]\nFirst\nSecond"), plugins: [shortcutTargetPlugin()] });
  const secondLine = state.doc.resolve(state.doc.content.size - 2).start(2);
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, secondLine + 1)));
  assert.equal(shortcutTargetLine(state)?.node.textContent, "Second");
  assert.equal(shortcutTargetLine(state)?.active, false);
  state = state.apply(shortcutTargetTransaction(state.tr, true));
  assert.equal(shortcutTargetLine(state)?.active, true);
  state = state.apply(shortcutTargetTransaction(state.tr, false));
  assert.equal(shortcutTargetLine(state)?.active, false);
});
