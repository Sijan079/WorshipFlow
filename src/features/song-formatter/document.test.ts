import assert from "node:assert/strict";
import test from "node:test";
import { EditorState, TextSelection } from "prosemirror-state";
import { undo } from "prosemirror-history";
import { joinBackward } from "prosemirror-commands";
import {
  copyActiveSection, documentFromText, documentToText, tagSelection, sectionCommand, groupSections,
  pasteSection, sectionPosition, shortcutFallbackSelection,
} from "./document.ts";
import { paginateGroups, pageOrigin, pageColumns } from "./pagination.ts";
import { songHistory } from "./editor-history.ts";
import { clipboardSection, copiedText, plainTextSlice, sectionClipboardText } from "./clipboard.ts";

function state(text: string) {
  return EditorState.create({ doc: documentFromText(text), plugins: songHistory() });
}

test("tagged lyrics round trip including Unicode, blank lines and unknown tags", () => {
  const text = "[Title]\nAwit\n\n[Verse 2]\nPurihin Siya\nIkaw & ako\n\n[Custom]\n終わり\n";
  assert.equal(documentToText(documentFromText(text)), text);
});

test("tagging a partial lyric selection uses whole lines and is undoable", () => {
  let current = state("[Verse]\nFirst line\nSecond line\nThird line");
  current = current.apply(current.tr.setSelection(TextSelection.create(current.doc, 4, 17)));
  tagSelection("Chorus")(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Chorus]\nFirst line\nSecond line\n[Verse]\nThird line");
  undo(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Verse]\nFirst line\nSecond line\nThird line");
});

test("Backspace cannot merge sections but explicit merge can, with undo", () => {
  let current = state("[Verse]\nOne\n[Chorus]\nTwo");
  const second = current.doc.child(0).nodeSize;
  current = current.apply(current.tr.setSelection(TextSelection.create(current.doc, second + 2)));
  assert.equal(joinBackward(current, () => assert.fail("must not merge")), false);
  sectionCommand("merge")(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Verse]\nOne\nTwo");
  undo(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Verse]\nOne\n[Chorus]\nTwo");
});

test("section reorder, duplicate and delete keep stored order", () => {
  let current = state("[Verse]\nOne\n[Chorus]\nTwo");
  sectionCommand("down")(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Chorus]\nTwo\n[Verse]\nOne");
  sectionCommand("duplicate")(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Chorus]\nTwo\n[Verse]\nOne\n\n[Verse]\nOne");
  sectionCommand("delete")(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Chorus]\nTwo\n[Verse]\nOne\n");
});

test("section movement preserves the caret lyric and character offset", () => {
  let current = state("[Verse]\nAlpha\nSecond line\n[Chorus]\nGamma");
  const secondLine = sectionPosition(current.doc, 0) + 2 + current.doc.child(0).child(0).nodeSize + 4;
  current = current.apply(current.tr.setSelection(TextSelection.create(current.doc, secondLine)));
  sectionCommand("down")(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Chorus]\nGamma\n[Verse]\nAlpha\nSecond line");
  assert.equal(current.selection.empty, true);
  assert.equal(current.selection.$head.parent.textContent, "Second line");
  assert.equal(current.selection.$head.parentOffset, 4);
});

test("moving a cross-section selection moves its head section and collapses at the preserved head", () => {
  let current = state("[Verse]\nAlpha\n[Chorus]\nGamma");
  const first = sectionPosition(current.doc, 0) + 3;
  const second = sectionPosition(current.doc, 1) + 5;
  current = current.apply(current.tr.setSelection(TextSelection.create(current.doc, first, second)));
  sectionCommand("up")(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Chorus]\nGamma\n[Verse]\nAlpha");
  assert.equal(current.selection.empty, true);
  assert.equal(current.selection.$head.parent.textContent, "Gamma");
  assert.equal(current.selection.$head.parentOffset, 3);
});

test("insert and duplicate add only missing separators and undo together", () => {
  for (const action of ["insert", "duplicate"] as const) {
    for (const blanks of ["", "\n", "\n\n"]) {
      const original = `[Verse]\nOne${blanks}\n[Chorus]\nTwo`;
      let current = state(original);
      sectionCommand(action)(current, tr => { current = current.apply(tr); });
      assert.equal(current.doc.child(0).childCount, blanks ? 1 + blanks.length : 2);
      assert.match(documentToText(current.doc), /One\n\n/);
      if (action === "duplicate") assert.match(documentToText(current.doc), /One\n\n(?:\n)?\[Chorus\]/);
      undo(current, tr => { current = current.apply(tr); });
      assert.equal(documentToText(current.doc), original);
    }
  }
});

test("split uses the caret line, separates sections and rejects a single-line section", () => {
  const selectLine = (current: EditorState, lineIndex: number) => {
    let position = sectionPosition(current.doc, 0) + 2;
    for (let index = 0; index < lineIndex; index++) position += current.doc.child(0).child(index).nodeSize;
    return current.apply(current.tr.setSelection(TextSelection.create(current.doc, position)));
  };

  let first = selectLine(state("[Verse]\nA\nB\nC"), 0);
  assert.equal(sectionCommand("split")(first), true);
  sectionCommand("split")(first, tr => { first = first.apply(tr); });
  assert.equal(documentToText(first.doc), "[Verse]\nA\n\n[Verse]\nB\nC");
  assert.equal(first.selection.$head.parent.textContent, "B");

  let last = selectLine(state("[Verse]\nA\nB\n\nC"), 3);
  sectionCommand("split")(last, tr => { last = last.apply(tr); });
  assert.equal(documentToText(last.doc), "[Verse]\nA\nB\n\n[Verse]\nC");

  const single = state("[Verse]\nOnly");
  assert.equal(sectionCommand("split")(single), false);
});

test("section copy and paste preserve content, add boundary spacing and create fresh identities", () => {
  let current = state("[Verse]\nOne\n\nTwo\n[Chorus]\nNext");
  const snapshot = copyActiveSection(current);
  assert.deepEqual(snapshot, { tag: "Verse", lines: ["One", "", "Two"] });
  const originalId = current.doc.child(0).attrs.id;
  pasteSection(snapshot)(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Verse]\nOne\n\nTwo\n\n[Verse]\nOne\n\nTwo\n\n[Chorus]\nNext");
  assert.notEqual(current.doc.child(1).attrs.id, originalId);
  assert.equal(current.selection.$head.parent.textContent, "One");
  undo(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Verse]\nOne\n\nTwo\n[Chorus]\nNext");
});

test("page columns respect zoom, width, mobile and page count", () => {
  assert.equal(pageColumns(75, 1242, 3, false), 2);
  assert.equal(pageColumns(75, 1241, 3, false), 1);
  assert.equal(pageColumns(100, 2000, 3, false), 1);
  assert.equal(pageColumns(50, 1000, 1, false), 1);
  assert.equal(pageColumns(50, 1000, 3, true), 1);
  assert.deepEqual(pageOrigin(1, 2), { left: 840, top: 0 });
  assert.deepEqual(pageOrigin(2, 2), { left: 0, top: 1080 });
});

test("line grouping only changes the selected tag, preserving lyric order", () => {
  let current = state("[Verse]\nA\nB\nC\n[Chorus]\nD\nE");
  groupSections("Verse", 2)(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Verse]\nA\nB\n\n[Verse]\nC\n[Chorus]\nD\nE");
});

test("pagination keeps fitting groups together and splits oversized groups", () => {
  const layout = paginateGroups([{ positions: [0], heights: [800] }, { positions: [10, 20], heights: [40, 40] }]);
  assert.equal(layout.pages, 2);
  assert.equal(layout.breaks[0].pos, 10);
  assert.ok(layout.breaks[0].height > 192);
  const long = paginateGroups([{ positions: Array.from({ length: 60 }, (_, i) => i), heights: Array(60).fill(20) }]);
  assert.equal(long.pages, 2);
  assert.ok(long.breaks[0].pos > 0);
});

test("a section action and subsequent typing are separate undo steps", () => {
  let current = state("[Verse]\nOne\n[Chorus]\nTwo");
  sectionCommand("duplicate")(current, tr => { current = current.apply(tr); });
  const duplicated = documentToText(current.doc);
  current = current.apply(current.tr.insertText("New "));
  undo(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), duplicated);
  undo(current, tr => { current = current.apply(tr); });
  assert.equal(documentToText(current.doc), "[Verse]\nOne\n[Chorus]\nTwo");
});

test("copying a word does not add its section tag", () => {
  const doc = documentFromText("[Verse]\nAlpha beta\n[Chorus]\nGamma");
  assert.equal(copiedText(doc.slice(2, 7, true)), "Alpha");
  assert.equal(copiedText(doc.slice(0, doc.content.size)), "[Verse]\nAlpha beta\n[Chorus]\nGamma");
});

test("plain text paste preserves line breaks and tagged paste preserves sections", () => {
  let current = state("[Verse]\nAlpha");
  current = current.apply(current.tr.setSelection(TextSelection.create(current.doc, 7)));
  current = current.apply(current.tr.replaceSelection(plainTextSlice("\nBeta\nGamma")));
  assert.equal(documentToText(current.doc), "[Verse]\nAlpha\nBeta\nGamma");
  current = current.apply(current.tr.replaceSelection(plainTextSlice("[Bridge]\nNew lyrics")));
  assert.ok(documentToText(current.doc).includes("[Bridge]\nNew lyrics"));
});

test("section clipboard text accepts one tagged or untagged section and rejects invalid blocks", () => {
  const tagged = { tag: "Bridge", lines: ["Alpha", "", "Beta"] };
  assert.equal(sectionClipboardText(tagged), "[Bridge]\nAlpha\n\nBeta");
  assert.deepEqual(clipboardSection("[Bridge]\nAlpha\n\nBeta"), tagged);
  assert.deepEqual(clipboardSection("Alpha\n\nBeta"), { tag: null, lines: ["Alpha", "", "Beta"] });
  assert.equal(clipboardSection("   \n"), null);
  assert.equal(clipboardSection("[Verse]\nOne\n[Chorus]\nTwo"), null);
});

test("shortcut fallback places the caret at the end of the bottom-most non-empty lyric line", () => {
  const doc = documentFromText("[Verse]\nAlpha\n[Chorus]\nLast lyric\n\n");
  const selection = shortcutFallbackSelection(doc);
  assert.equal(selection.empty, true);
  assert.equal(selection.$head.parent.textContent, "Last lyric");
  assert.equal(selection.$head.parentOffset, "Last lyric".length);
});

test("shortcut fallback uses the document end when every lyric line is blank", () => {
  const doc = documentFromText("[Verse]\n\n");
  const selection = shortcutFallbackSelection(doc);
  assert.equal(selection.empty, true);
  assert.equal(selection.$head.parent.textContent, "");
  assert.equal(selection.to, TextSelection.atEnd(doc).to);
});
