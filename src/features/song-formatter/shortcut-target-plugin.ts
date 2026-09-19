import { Plugin, PluginKey, type EditorState, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

const shortcutTargetKey = new PluginKey<boolean>("song-shortcut-target");

export function shortcutTargetLine(state: EditorState) {
  const { $head } = state.selection;
  for (let depth = $head.depth; depth > 0; depth--) {
    const node = $head.node(depth);
    if (node.type.name !== "lyric") continue;
    const from = $head.before(depth);
    return { active: shortcutTargetKey.getState(state) ?? false, from, to: from + node.nodeSize, node };
  }
  return null;
}

export function shortcutTargetTransaction(transaction: Transaction, active: boolean) {
  return transaction.setMeta(shortcutTargetKey, active).setMeta("addToHistory", false);
}

export function shortcutTargetPlugin() {
  return new Plugin<boolean>({
    key: shortcutTargetKey,
    state: {
      init: () => false,
      apply: (transaction, active) => transaction.getMeta(shortcutTargetKey) ?? active,
    },
    props: {
      decorations: state => {
        const target = shortcutTargetLine(state);
        return target?.active
          ? DecorationSet.create(state.doc, [Decoration.node(target.from, target.to, { "data-shortcut-target": "true" })])
          : DecorationSet.empty;
      },
    },
  });
}
