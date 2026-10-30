import { SITE_LIMITS, type BaseBlockInput, type SectionBlockInput, type SiteBlockInput } from "../blocks/block-validation.ts";

// The editor's blocks while a page is open: the stored block plus a key that stays the same while it is edited,
// moved or undone. A Section keeps its blocks inside its own content, and they have keys too. Undo and redo are
// kept here, in the session only (revision history is a later feature).

export type KeyedBase = BaseBlockInput & { key: string };
export type KeyedSection = { key: string; type: "SECTION"; content: Omit<SectionBlockInput["content"], "blocks"> & { blocks: KeyedBase[] } };
export type EditorBlock = KeyedBase | KeyedSection;
export type NewBlockKind = SiteBlockInput["type"];

export type EditorState = {
  blocks: EditorBlock[];
  past: EditorBlock[][];
  future: EditorBlock[][];
  // The block whose text is being typed in right now, so a run of keystrokes is one undo step.
  typingIn: string | null;
};

export type EditorAction =
  // parentKey puts the block inside that Section; without it the block goes on the page itself.
  | { type: "add"; block: EditorBlock; afterKey?: string; parentKey?: string }
  | { type: "remove"; key: string }
  | { type: "move"; key: string; direction: "up" | "down" }
  | { type: "update"; key: string; content: EditorBlock["content"]; coalesce?: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "load"; blocks: EditorBlock[] };

const HISTORY_LIMIT = 100;

function keyOf() {
  return globalThis.crypto.randomUUID();
}

// Gives every block, at every level, a key. Used when a saved page is opened.
export function withKeys(blocks: SiteBlockInput[]): EditorBlock[] {
  return blocks.map((block): EditorBlock => {
    if (block.type === "SECTION") return { key: keyOf(), type: "SECTION", content: { ...block.content, blocks: block.content.blocks.map((child) => ({ ...child, key: keyOf() })) } };
    return { ...block, key: keyOf() };
  });
}

// The reverse: what gets saved, without the editor's own keys.
export function stripKeys(blocks: EditorBlock[]): SiteBlockInput[] {
  return blocks.map((block): SiteBlockInput => {
    if (block.type === "SECTION") {
      return { type: "SECTION", content: { ...block.content, blocks: block.content.blocks.map(({ key, ...child }) => { void key; return child; }) } };
    }
    const { key, ...plain } = block;
    void key;
    return plain;
  });
}

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
  }
}

export function initialEditorState(blocks: EditorBlock[]): EditorState {
  return { blocks, past: [], future: [], typingIn: null };
}

export const canUndo = (state: EditorState) => state.past.length > 0;
export const canRedo = (state: EditorState) => state.future.length > 0;

// Blocks at every level, a Section counting once itself and once for each block inside it.
export function countEditorBlocks(blocks: EditorBlock[]): number {
  return blocks.reduce((total, block) => total + 1 + (block.type === "SECTION" ? block.content.blocks.length : 0), 0);
}

export function findBlock(blocks: EditorBlock[], key: string): EditorBlock | null {
  for (const block of blocks) {
    if (block.key === key) return block;
    if (block.type === "SECTION") {
      const inner = block.content.blocks.find((child) => child.key === key);
      if (inner) return inner;
    }
  }
  return null;
}

// Applies a change to the list that holds the block with this key: the page's own list, or a Section's list.
// Returns null when no list has that block.
function changeListHolding(blocks: EditorBlock[], key: string, change: (list: EditorBlock[], index: number) => EditorBlock[]): EditorBlock[] | null {
  const index = blocks.findIndex((block) => block.key === key);
  if (index >= 0) return change(blocks, index);
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (block.type !== "SECTION") continue;
    const inner = changeListHolding(block.content.blocks, key, change);
    if (inner) return blocks.map((other, j) => (j === i ? { ...block, content: { ...block.content, blocks: inner as KeyedBase[] } } : other));
  }
  return null;
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
      if (countEditorBlocks(state.blocks) >= SITE_LIMITS.blocksPerPage) return state;
      if (!action.parentKey) return changed(state, insertAfter(state.blocks, action.block, action.afterKey));
      const parent = state.blocks.find((block) => block.key === action.parentKey);
      // A Section holds blocks only: no Section inside a Section, and no more than its limit.
      if (!parent || parent.type !== "SECTION" || action.block.type === "SECTION") return state;
      if (parent.content.blocks.length >= SITE_LIMITS.sectionBlocks) return state;
      const child = action.block as KeyedBase;
      return changed(state, state.blocks.map((block) => (block.key === parent.key && block.type === "SECTION" ? { ...block, content: { ...block.content, blocks: insertAfter(block.content.blocks, child, action.afterKey) } } : block)));
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
