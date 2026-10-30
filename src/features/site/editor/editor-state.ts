import { SITE_LIMITS, type SiteBlockInput } from "../blocks/block-validation.ts";

// The editor's blocks while a page is open: the stored block plus a key that stays the same while it is edited,
// moved or undone. Undo and redo are kept here, in the session only (revision history is a later feature).

export type EditorBlock = SiteBlockInput & { key: string };
export type NewBlockKind = SiteBlockInput["type"];

export type EditorState = {
  blocks: EditorBlock[];
  past: EditorBlock[][];
  future: EditorBlock[][];
  // The block whose text is being typed in right now, so a run of keystrokes is one undo step.
  typingIn: string | null;
};

export type EditorAction =
  | { type: "add"; block: EditorBlock; afterKey?: string }
  | { type: "remove"; key: string }
  | { type: "move"; key: string; direction: "up" | "down" }
  | { type: "update"; key: string; content: SiteBlockInput["content"]; coalesce?: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "load"; blocks: EditorBlock[] };

const HISTORY_LIMIT = 100;

function keyOf() {
  return globalThis.crypto.randomUUID();
}

export function withKeys(blocks: SiteBlockInput[]): EditorBlock[] {
  return blocks.map((block) => ({ ...block, key: keyOf() }));
}

export function newBlock(kind: NewBlockKind): EditorBlock {
  const key = keyOf();
  switch (kind) {
    case "PARAGRAPH": return { key, type: kind, content: { runs: [{ text: "" }], align: "left", size: "normal" } };
    case "HEADING": return { key, type: kind, content: { text: "", level: 2, align: "left" } };
    case "LIST": return { key, type: kind, content: { ordered: false, items: [""] } };
    case "QUOTE": return { key, type: kind, content: { text: "" } };
    case "BUTTON": return { key, type: kind, content: { label: "Learn more", link: { kind: "url", url: "https://" }, align: "left" } };
    // No picture chosen yet: the editor says so until one is uploaded.
    case "IMAGE": return { key, type: kind, content: { path: "", alt: "", align: "left" } };
    case "SPACER": return { key, type: kind, content: { size: "medium" } };
    case "SERVICE_TIMES": return { key, type: kind, content: { lines: [""] } };
    case "ANNOUNCEMENTS_LIST":
    case "EVENTS_LIST":
    case "CONTACT": return { key, type: kind, content: {} };
  }
}

export function initialEditorState(blocks: EditorBlock[]): EditorState {
  return { blocks, past: [], future: [], typingIn: null };
}

export const canUndo = (state: EditorState) => state.past.length > 0;
export const canRedo = (state: EditorState) => state.future.length > 0;

function changed(state: EditorState, blocks: EditorBlock[], typingIn: string | null = null): EditorState {
  return { blocks, past: [...state.past, state.blocks].slice(-HISTORY_LIMIT), future: [], typingIn };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "add": {
      if (state.blocks.length >= SITE_LIMITS.blocksPerPage) return state;
      const at = action.afterKey ? state.blocks.findIndex((block) => block.key === action.afterKey) + 1 : state.blocks.length;
      return changed(state, [...state.blocks.slice(0, at), action.block, ...state.blocks.slice(at)]);
    }
    case "remove":
      return changed(state, state.blocks.filter((block) => block.key !== action.key));
    case "move": {
      const from = state.blocks.findIndex((block) => block.key === action.key);
      const to = action.direction === "up" ? from - 1 : from + 1;
      if (from < 0 || to < 0 || to >= state.blocks.length) return state;
      const next = [...state.blocks];
      [next[from], next[to]] = [next[to], next[from]];
      return changed(state, next);
    }
    case "update": {
      const next = state.blocks.map((block) => (block.key === action.key ? ({ ...block, content: action.content } as EditorBlock) : block));
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
