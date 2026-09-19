import { Plugin, type Transaction } from "prosemirror-state";
import { closeHistory, history } from "prosemirror-history";

const COMMAND_META = "song-structural-command";

export function structuralTransaction(transaction: Transaction) {
  return closeHistory(transaction).setMeta(COMMAND_META, true);
}

export function songHistory() {
  return [history(), new Plugin({
    // Close both sides of a structural edit so later typing has its own undo step.
    appendTransaction: (transactions, _previous, state) => transactions.some(tr => tr.getMeta(COMMAND_META))
      ? closeHistory(state.tr) : null,
  })];
}
