import { Schema, type Node as ProseNode } from "prosemirror-model";
import { Plugin, TextSelection, type Command, type EditorState } from "prosemirror-state";
import { structuralTransaction } from "./editor-history.ts";

let nextId = 0;
const newId = () => `song-section-${++nextId}`;

export const songSchema = new Schema({
  nodes: {
    doc: { content: "section+" },
    section: {
      content: "lyric+", isolating: true, defining: true,
      attrs: { tag: { default: null }, id: { default: null } },
      toDOM: node => ["section", { "data-song-section": node.attrs.id },
        ["div", { class: "song-tag-heading", contenteditable: "false" }, node.attrs.tag ? `[${node.attrs.tag}]` : "Untagged"],
        ["div", { class: "song-section-lines" }, 0]],
    },
    lyric: {
      content: "text*", whitespace: "pre",
      toDOM: () => ["p", { class: "song-lyric-line" }, 0],
      parseDOM: [{ tag: "p" }],
    },
    text: {},
  },
});

export type SongSection = { tag: string | null; lines: string[]; id: string };
export type SectionSnapshot = Pick<SongSection, "tag" | "lines">;

export function sectionIdentityPlugin() {
  return new Plugin({
    appendTransaction: (transactions, _previous, state) => {
      if (!transactions.some(tr => tr.docChanged)) return null;
      const seen = new Set<string>();
      const tr = state.tr;
      state.doc.forEach((section, pos) => {
        let id = section.attrs.id as string | null;
        if (!id || seen.has(id)) {
          id = newId();
          tr.setNodeMarkup(pos, undefined, { ...section.attrs, id });
        }
        seen.add(id);
      });
      return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
    },
  });
}
export function makeSection(section: Partial<SongSection> = {}) {
  return songSchema.nodes.section.create(
    { tag: section.tag ?? null, id: section.id ?? newId() },
    (section.lines?.length ? section.lines : [""]).map(line => songSchema.nodes.lyric.create(null, line ? songSchema.text(line) : null)),
  );
}

export function documentFromText(text: string) {
  const sections: ProseNode[] = [];
  let current: SongSection = { tag: null, lines: [], id: newId() };
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const tag = line.match(/^\s*\[([^\]\r\n]+)\]\s*$/);
    if (tag) {
      if (current.tag !== null || current.lines.some(line => line.trim())) sections.push(makeSection(current));
      current = { tag: tag[1].trim(), lines: [], id: newId() };
    } else current.lines.push(line);
  }
  if (current.tag !== null || current.lines.length) sections.push(makeSection(current));
  return songSchema.nodes.doc.create(null, sections.length ? sections : [makeSection()]);
}

export function getSections(doc: ProseNode): SongSection[] {
  const sections: SongSection[] = [];
  doc.forEach(node => {
    const lines: string[] = [];
    node.forEach(line => lines.push(line.textContent));
    sections.push({ id: node.attrs.id, tag: node.attrs.tag, lines });
  });
  return sections;
}

export function copyActiveSection(state: EditorState): SectionSnapshot {
  const section = getSections(state.doc)[activeSection(state)];
  return { tag: section.tag, lines: [...section.lines] };
}

export function documentToText(doc: ProseNode) {
  return getSections(doc).map(section => [
    ...(section.tag ? [`[${section.tag}]`] : []), ...section.lines,
  ].join("\n")).join("\n");
}

export function activeSection(state: EditorState) {
  const { $head } = state.selection;
  return Math.min($head.index(0), state.doc.childCount - 1);
}

export function sectionPosition(doc: ProseNode, index: number) {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize;
  return pos;
}

export function shortcutFallbackSelection(doc: ProseNode) {
  let selection: TextSelection | undefined;
  doc.forEach((section, sectionPos) => {
    section.forEach((line, offset) => {
      if (!line.textContent.trim()) return;
      selection = TextSelection.create(doc, sectionPos + offset + 2 + line.content.size);
    });
  });
  return selection ?? TextSelection.atEnd(doc);
}

type RelativeCaret = { lineIndex: number; offset: number };

function caretSelection(doc: ProseNode, sectionIndex: number, caret?: RelativeCaret) {
  const section = doc.child(sectionIndex);
  const lineIndex = Math.max(0, Math.min(caret?.lineIndex ?? 0, section.childCount - 1));
  let position = sectionPosition(doc, sectionIndex) + 2;
  for (let index = 0; index < lineIndex; index++) position += section.child(index).nodeSize;
  return TextSelection.create(doc, position + Math.min(caret?.offset ?? 0, section.child(lineIndex).content.size));
}

function replaceSections(state: EditorState, dispatch: Parameters<Command>[1], sections: ProseNode[], index: number, caret?: RelativeCaret) {
  if (dispatch) {
    const doc = songSchema.nodes.doc.create(null, sections.length ? sections : [makeSection()]);
    const tr = structuralTransaction(state.tr.replaceWith(0, state.doc.content.size, doc.content));
    const selectedIndex = Math.max(0, Math.min(index, tr.doc.childCount - 1));
    tr.setSelection(caretSelection(tr.doc, selectedIndex, caret));
    dispatch(tr.scrollIntoView());
  }
  return true;
}

function separated(node: ProseNode) {
  return node.lastChild?.textContent.trim()
    ? node.copy(node.content.append(makeSection({ lines: [""] }).content))
    : node;
}

export function pasteSection(snapshot: SectionSnapshot): Command {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const sections: ProseNode[] = [];
    state.doc.forEach(section => sections.push(section));
    let index = activeSection(state);
    sections[index] = separated(sections[index]);
    let pasted = makeSection({ tag: snapshot.tag, lines: [...snapshot.lines] });
    if (index < sections.length - 1) pasted = separated(pasted);
    sections.splice(++index, 0, pasted);
    return replaceSections(state, dispatch, sections, index);
  };
}

export function tagSelection(tag: string): Command {
  return (state, dispatch) => {
    if (!tag.trim() || /[\[\]\r\n]/.test(tag)) return false;
    const index = activeSection(state);
    if (state.selection.empty) {
      const pos = sectionPosition(state.doc, index);
      if (dispatch) dispatch(structuralTransaction(state.tr.setNodeMarkup(pos, undefined, { ...state.doc.child(index).attrs, tag })).scrollIntoView());
      return true;
    }
    const sections: ProseNode[] = [];
    let selectedIndex = -1;
    state.doc.forEach((section, pos) => {
      const lines: ProseNode[] = [];
      const touched: number[] = [];
      section.forEach((line, offset, lineIndex) => {
        lines.push(line);
        const start = pos + 1 + offset;
        if (state.selection.from < start + line.nodeSize && state.selection.to > start + 1) touched.push(lineIndex);
      });
      if (!touched.length) { sections.push(section); return; }
      const first = touched[0], last = touched[touched.length - 1];
      if (first > 0) sections.push(section.copy(songSchema.nodes.section.create(null, lines.slice(0, first)).content));
      if (selectedIndex < 0) selectedIndex = sections.length;
      sections.push(songSchema.nodes.section.create({ tag, id: first === 0 ? section.attrs.id : newId() }, lines.slice(first, last + 1)));
      if (last < lines.length - 1) sections.push(songSchema.nodes.section.create({ ...section.attrs, id: newId() }, lines.slice(last + 1)));
    });
    return replaceSections(state, dispatch, sections, Math.max(0, selectedIndex));
  };
}

export type SectionAction = "insert" | "split" | "merge" | "duplicate" | "delete" | "up" | "down";
export function sectionCommand(action: SectionAction): Command {
  return (state, dispatch) => {
    const active = activeSection(state);
    if (!dispatch) {
      if (action === "up" || action === "merge") return active > 0;
      if (action === "down") return active < state.doc.childCount - 1;
      if (action === "split") return state.selection.$head.depth >= 2 && state.doc.child(active).childCount > 1;
      return true;
    }
    const sections: ProseNode[] = [];
    state.doc.forEach(section => sections.push(section));
    let index = activeSection(state);
    const section = sections[index];
    const relativeCaret = {
      lineIndex: state.selection.$head.depth >= 2 ? state.selection.$head.index(1) : 0,
      offset: state.selection.$head.parentOffset,
    };
    if (action === "insert") {
      sections[index] = separated(section);
      sections.splice(++index, 0, makeSection({ tag: "Verse" }));
    } else if (action === "duplicate") {
      sections[index] = separated(section);
      const copy = songSchema.nodes.section.create({ ...section.attrs, id: newId() }, section.content);
      index++;
      sections.splice(index, 0, index < sections.length ? separated(copy) : copy);
    } else if (action === "delete") {
      sections.splice(index, 1);
      if (!sections.length) sections.push(makeSection({ tag: "Verse" }));
    } else if (action === "merge") {
      if (index === 0) return false;
      const previous = sections[index - 1];
      sections.splice(index - 1, 2, previous.copy(previous.content.append(section.content)));
      index--;
    } else if (action === "split") {
      const lineIndex = state.selection.$head.depth >= 2 ? state.selection.$head.index(1) : 0;
      if (section.childCount <= 1) return false;
      const lines: ProseNode[] = [];
      section.forEach(line => lines.push(line));
      const boundary = lineIndex === 0 ? 1 : lineIndex;
      sections.splice(index, 1,
        separated(songSchema.nodes.section.create(section.attrs, lines.slice(0, boundary))),
        songSchema.nodes.section.create({ ...section.attrs, id: newId() }, lines.slice(boundary)));
      index++;
    } else {
      const target = index + (action === "up" ? -1 : 1);
      if (target < 0 || target >= sections.length) return false;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      index = target;
    }
    return replaceSections(state, dispatch, sections, index,
      action === "up" || action === "down" ? relativeCaret : undefined);
  };
}

export function groupSections(tag: string, size: 2 | 3): Command {
  return (state, dispatch) => {
    const source = getSections(state.doc);
    const output: ProseNode[] = [];
    for (let i = 0; i < source.length;) {
      const section = source[i++];
      if (section.tag?.toLowerCase() !== tag.toLowerCase()) { output.push(makeSection(section)); continue; }
      const lines = [...section.lines];
      while (i < source.length && source[i].tag?.toLowerCase() === tag.toLowerCase()) lines.push(...source[i++].lines);
      const lyrics = lines.filter(line => line.trim());
      if (!lyrics.length) { output.push(makeSection(section)); continue; }
      for (let j = 0; j < lyrics.length; j += size) {
        const group = lyrics.slice(j, j + size);
        if (j + size < lyrics.length) group.push("");
        output.push(makeSection({ tag: section.tag, lines: group }));
      }
    }
    return replaceSections(state, dispatch, output, 0);
  };
}
