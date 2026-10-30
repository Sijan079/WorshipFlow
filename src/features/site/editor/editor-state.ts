import { SITE_LIMITS, type BaseBlockInput, type ColumnsBlockInput, type CoverBlockInput, type SectionBlockInput, type SectionChildInput, type SiteBlockInput } from "../blocks/block-validation.ts";

// The editor's blocks while a page is open: the stored block plus a key that stays the same while it is edited,
// moved or undone. A Section keeps its blocks inside its own content, Columns keep theirs inside each column, and
// all of them have keys too. Undo and redo are kept here, in the session only (revision history is a later feature).

export type KeyedBase = BaseBlockInput & { key: string };
// A column is not a block of its own: it has a key only so blocks can be added into it.
export type KeyedColumn = { key: string; blocks: KeyedBase[] };
export type KeyedColumns = { key: string; type: "COLUMNS"; content: Omit<ColumnsBlockInput["content"], "columns"> & { columns: KeyedColumn[] } };
export type KeyedSectionChild = KeyedBase | KeyedColumns;
export type KeyedSection = { key: string; type: "SECTION"; content: Omit<SectionBlockInput["content"], "blocks"> & { blocks: KeyedSectionChild[] } };
// A Cover has no blocks inside it, but like a Section it can only sit on the page itself.
export type KeyedCover = CoverBlockInput & { key: string };
export type EditorBlock = KeyedBase | KeyedSection | KeyedCover | KeyedColumns;
export type NewBlockKind = SiteBlockInput["type"];
export type ColumnsLayout = "picture-left" | "picture-right" | "cards-3" | "two-columns";

export type EditorState = {
  blocks: EditorBlock[];
  past: EditorBlock[][];
  future: EditorBlock[][];
  // The block whose text is being typed in right now, so a run of keystrokes is one undo step.
  typingIn: string | null;
};

export type EditorAction =
  // parentKey is the key of a Section or of a column: the block goes inside it. Without it the block goes on the page.
  | { type: "add"; block: EditorBlock; afterKey?: string; parentKey?: string }
  | { type: "remove"; key: string }
  | { type: "move"; key: string; direction: "up" | "down" }
  | { type: "update"; key: string; content: EditorBlock["content"]; coalesce?: boolean }
  // Two to four columns. Fewer is allowed only when the columns that would go are empty, so nothing is lost.
  | { type: "setColumns"; key: string; count: number }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "load"; blocks: EditorBlock[] };

const HISTORY_LIMIT = 100;

function keyOf() {
  return globalThis.crypto.randomUUID();
}

const keyBase = (block: BaseBlockInput): KeyedBase => ({ ...block, key: keyOf() });
const keyColumns = (block: ColumnsBlockInput): KeyedColumns => ({
  key: keyOf(),
  type: "COLUMNS",
  content: { ...block.content, columns: block.content.columns.map((column) => ({ key: keyOf(), blocks: column.blocks.map(keyBase) })) },
});
const keyChild = (child: SectionChildInput): KeyedSectionChild => (child.type === "COLUMNS" ? keyColumns(child) : keyBase(child));

// Gives every block, at every level, a key. Used when a saved page is opened.
export function withKeys(blocks: SiteBlockInput[]): EditorBlock[] {
  return blocks.map((block): EditorBlock => {
    if (block.type === "SECTION") return { key: keyOf(), type: "SECTION", content: { ...block.content, blocks: block.content.blocks.map(keyChild) } };
    if (block.type === "COLUMNS") return keyColumns(block);
    return { ...block, key: keyOf() };
  });
}

const unkeyBase = ({ key, ...block }: KeyedBase): BaseBlockInput => { void key; return block; };
const unkeyColumns = (block: KeyedColumns): ColumnsBlockInput => ({
  type: "COLUMNS",
  content: { ...block.content, columns: block.content.columns.map((column) => ({ blocks: column.blocks.map(unkeyBase) })) },
});

// The reverse: what gets saved, without the editor's own keys.
export function stripKeys(blocks: EditorBlock[]): SiteBlockInput[] {
  return blocks.map((block): SiteBlockInput => {
    if (block.type === "SECTION") {
      return { type: "SECTION", content: { ...block.content, blocks: block.content.blocks.map((child): SectionChildInput => (child.type === "COLUMNS" ? unkeyColumns(child) : unkeyBase(child))) } };
    }
    if (block.type === "COLUMNS") return unkeyColumns(block);
    const { key, ...plain } = block;
    void key;
    return plain;
  });
}

const emptyColumn = (): KeyedColumn => ({ key: keyOf(), blocks: [] });

export function newBlock(kind: NewBlockKind): EditorBlock {
  const key = keyOf();
  switch (kind) {
    case "PARAGRAPH": return { key, type: kind, content: { runs: [{ text: "" }], align: "left", size: "normal" } };
    case "HEADING": return { key, type: kind, content: { text: "", level: 2, align: "left" } };
    case "LIST": return { key, type: kind, content: { ordered: false, items: [""] } };
    case "QUOTE": return { key, type: kind, content: { text: "" } };
    // No picture chosen yet: the editor says so until one is uploaded.
    case "IMAGE": return { key, type: kind, content: { path: "", alt: "", align: "left" } };
    case "BUTTON": return { key, type: kind, content: { label: "Learn more", link: { kind: "url", url: "https://" }, align: "left" } };
    case "SPACER": return { key, type: kind, content: { size: "medium" } };
    case "SERVICE_TIMES": return { key, type: kind, content: { lines: [""] } };
    case "ANNOUNCEMENTS_LIST":
    case "EVENTS_LIST":
    case "CONTACT": return { key, type: kind, content: {} };
    case "SECTION": return { key, type: kind, content: { background: "tinted", overlay: "medium", padding: "medium", inner: "content", width: "full", blocks: [] } };
    case "COVER": return { key, type: kind, content: { headline: "", overlay: "medium", height: "tall", align: "center", focus: "center", width: "full", buttons: [] } };
    case "COLUMNS": return { key, type: kind, content: { columns: [emptyColumn(), emptyColumn()], valign: "top", cards: false, width: "wide" } };
  }
}

const base = (kind: Exclude<NewBlockKind, "SECTION" | "COVER" | "COLUMNS">) => newBlock(kind) as KeyedBase;
const smallHeading = (): KeyedBase => {
  const heading = base("HEADING");
  return heading.type === "HEADING" ? { ...heading, content: { ...heading.content, level: 3 } } : heading;
};

// The ready-made layouts offered when adding Columns. Their blocks start empty, ready to be filled in.
export function newColumnsLayout(layout: ColumnsLayout): KeyedColumns {
  const columns = newBlock("COLUMNS") as KeyedColumns;
  const textColumn = (): KeyedColumn => ({ key: keyOf(), blocks: [smallHeading(), base("PARAGRAPH")] });
  switch (layout) {
    case "picture-left":
      return { ...columns, content: { ...columns.content, valign: "center", columns: [{ key: keyOf(), blocks: [base("IMAGE")] }, textColumn()] } };
    case "picture-right":
      return { ...columns, content: { ...columns.content, valign: "center", columns: [textColumn(), { key: keyOf(), blocks: [base("IMAGE")] }] } };
    case "cards-3":
      return { ...columns, content: { ...columns.content, cards: true, columns: [textColumn(), textColumn(), textColumn()] } };
    case "two-columns":
      return { ...columns, content: { ...columns.content, columns: [{ key: keyOf(), blocks: [base("PARAGRAPH")] }, { key: keyOf(), blocks: [base("PARAGRAPH")] }] } };
  }
}

export function initialEditorState(blocks: EditorBlock[]): EditorState {
  return { blocks, past: [], future: [], typingIn: null };
}

export const canUndo = (state: EditorState) => state.past.length > 0;
export const canRedo = (state: EditorState) => state.future.length > 0;

// Blocks at every level: a Section or Columns counts once itself and once for each block inside it.
export function countEditorBlocks(blocks: EditorBlock[]): number {
  let total = 0;
  for (const block of blocks) {
    total += 1;
    if (block.type === "SECTION") total += countEditorBlocks(block.content.blocks);
    if (block.type === "COLUMNS") for (const column of block.content.columns) total += countEditorBlocks(column.blocks);
  }
  return total;
}

type Container = { kind: "section"; section: KeyedSection } | { kind: "column"; column: KeyedColumn };

// Finds the Section, or the column, that has this key. Sections sit on the page and columns sit on the page or in a Section.
function findContainer(blocks: EditorBlock[], key: string): Container | null {
  for (const block of blocks) {
    if (block.type === "SECTION") {
      if (block.key === key) return { kind: "section", section: block };
      const inner = findContainer(block.content.blocks, key);
      if (inner) return inner;
    } else if (block.type === "COLUMNS") {
      const column = block.content.columns.find((item) => item.key === key);
      if (column) return { kind: "column", column };
    }
  }
  return null;
}

const replaceAt = <T,>(list: T[], index: number, item: T) => list.map((existing, i) => (i === index ? item : existing));

// Applies a change to the list that holds the block with this key: the page's own list, a Section's list, or a
// column's list. Returns null when no list has that block.
function changeListHolding(blocks: EditorBlock[], key: string, change: (list: EditorBlock[], index: number) => EditorBlock[]): EditorBlock[] | null {
  const index = blocks.findIndex((block) => block.key === key);
  if (index >= 0) return change(blocks, index);
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (block.type === "SECTION") {
      const inner = changeListHolding(block.content.blocks, key, change);
      if (inner) return replaceAt(blocks, i, { ...block, content: { ...block.content, blocks: inner as KeyedSectionChild[] } });
    } else if (block.type === "COLUMNS") {
      for (let c = 0; c < block.content.columns.length; c += 1) {
        const inner = changeListHolding(block.content.columns[c].blocks, key, change);
        if (inner) {
          const columns = replaceAt(block.content.columns, c, { ...block.content.columns[c], blocks: inner as KeyedBase[] });
          return replaceAt(blocks, i, { ...block, content: { ...block.content, columns } });
        }
      }
    }
  }
  return null;
}

// Applies a change to the blocks inside the Section or column with this key.
function changeChildrenOf(blocks: EditorBlock[], containerKey: string, change: (list: EditorBlock[]) => EditorBlock[]): EditorBlock[] {
  return blocks.map((block): EditorBlock => {
    if (block.type === "SECTION") {
      if (block.key === containerKey) return { ...block, content: { ...block.content, blocks: change(block.content.blocks) as KeyedSectionChild[] } };
      return { ...block, content: { ...block.content, blocks: changeChildrenOf(block.content.blocks, containerKey, change) as KeyedSectionChild[] } };
    }
    if (block.type === "COLUMNS") {
      return { ...block, content: { ...block.content, columns: block.content.columns.map((column) => (column.key === containerKey ? { ...column, blocks: change(column.blocks) as KeyedBase[] } : column)) } };
    }
    return block;
  });
}

function insertAfter<T extends { key: string }>(list: T[], block: T, afterKey?: string) {
  const at = afterKey ? list.findIndex((item) => item.key === afterKey) + 1 : list.length;
  return [...list.slice(0, at), block, ...list.slice(at)];
}

function changed(state: EditorState, blocks: EditorBlock[], typingIn: string | null = null): EditorState {
  return { blocks, past: [...state.past, state.blocks].slice(-HISTORY_LIMIT), future: [], typingIn };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "add": {
      // A ready-made layout adds several blocks at once, so the whole of it has to fit.
      if (countEditorBlocks(state.blocks) + countEditorBlocks([action.block]) > SITE_LIMITS.blocksPerPage) return state;
      if (!action.parentKey) return changed(state, insertAfter(state.blocks, action.block, action.afterKey));
      const container = findContainer(state.blocks, action.parentKey);
      if (!container) return state;
      const type = action.block.type;
      if (container.kind === "section") {
        // A Section holds ordinary blocks and Columns: no Section inside a Section, and no Cover.
        if (type === "SECTION" || type === "COVER" || container.section.content.blocks.length >= SITE_LIMITS.sectionBlocks) return state;
      } else if (type === "SECTION" || type === "COVER" || type === "COLUMNS" || container.column.blocks.length >= SITE_LIMITS.columnBlocks) {
        // A column holds ordinary blocks only.
        return state;
      }
      return changed(state, changeChildrenOf(state.blocks, action.parentKey, (list) => insertAfter(list, action.block, action.afterKey)));
    }
    case "remove": {
      const next = changeListHolding(state.blocks, action.key, (list, index) => list.filter((_, i) => i !== index));
      return next ? changed(state, next) : state;
    }
    case "move": {
      const next = changeListHolding(state.blocks, action.key, (list, from) => {
        const to = action.direction === "up" ? from - 1 : from + 1;
        if (to < 0 || to >= list.length) return list;
        const swapped = [...list];
        [swapped[from], swapped[to]] = [swapped[to], swapped[from]];
        return swapped;
      });
      return next && next !== state.blocks ? changed(state, next) : state;
    }
    case "update": {
      const next = changeListHolding(state.blocks, action.key, (list, index) => list.map((block, i) => (i === index ? ({ ...block, content: action.content } as EditorBlock) : block)));
      if (!next) return state;
      if (action.coalesce && state.typingIn === action.key) return { ...state, blocks: next, future: [] };
      return changed(state, next, action.coalesce ? action.key : null);
    }
    case "setColumns": {
      if (action.count < 2 || action.count > 4) return state;
      let refused = false;
      const next = changeListHolding(state.blocks, action.key, (list, index) => {
        const block = list[index];
        if (block.type !== "COLUMNS") { refused = true; return list; }
        const current = block.content.columns;
        if (action.count === current.length) { refused = true; return list; }
        // Fewer columns: the ones that would go must be empty.
        if (action.count < current.length && current.slice(action.count).some((column) => column.blocks.length > 0)) { refused = true; return list; }
        const columns = action.count < current.length ? current.slice(0, action.count) : [...current, ...Array.from({ length: action.count - current.length }, emptyColumn)];
        return replaceAt(list, index, { ...block, content: { ...block.content, columns } });
      });
      return next && !refused ? changed(state, next) : state;
    }
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return { blocks: previous, past: state.past.slice(0, -1), future: [state.blocks, ...state.future], typingIn: null };
    }
    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return { blocks: next, past: [...state.past, state.blocks], future: rest, typingIn: null };
    }
    case "load":
      return initialEditorState(action.blocks);
  }
}
