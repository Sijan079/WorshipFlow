"use client";

import { useState } from "react";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import type { KeyedColumns } from "./editor-state";

type Content = KeyedColumns["content"];
type Props = { content: Content; disabled: boolean; onChange: (content: Content) => void; onSetColumns: (count: number) => void };

// The settings of Columns: how many, how they line up, the card look and the width. The blocks inside each column
// are edited in the boxes below.
export default function ColumnsFields({ content, disabled, onChange, onSetColumns }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const count = content.columns.length;

  function changeCount(next: number) {
    const losing = content.columns.slice(next);
    if (next < count && losing.some((column) => column.blocks.length > 0)) {
      setMessage("The last column still has blocks in it. Move or delete them first, then choose fewer columns.");
      return;
    }
    setMessage(null);
    onSetColumns(next);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>How many columns</span>
          <select className={TEXT_FIELD_CLASS} value={count} disabled={disabled} onChange={(event) => changeCount(Number(event.target.value))}>
            <option value={2}>Two</option>
            <option value={3}>Three</option>
            <option value={4}>Four</option>
          </select>
        </label>
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>Line up the columns</span>
          <select className={TEXT_FIELD_CLASS} value={content.valign} disabled={disabled} onChange={(event) => onChange({ ...content, valign: event.target.value as Content["valign"] })}>
            <option value="top">At the top</option>
            <option value="center">In the middle</option>
          </select>
        </label>
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>How wide (when on the page itself)</span>
          <select className={TEXT_FIELD_CLASS} value={content.width} disabled={disabled} onChange={(event) => onChange({ ...content, width: event.target.value as Content["width"] })}>
            <option value="content">Same width as the text</option>
            <option value="wide">Wide</option>
            <option value="full">Full width of the screen</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 self-end text-sm">
          <input type="checkbox" className="ui-checkbox" checked={content.cards} disabled={disabled} onChange={(event) => onChange({ ...content, cards: event.target.checked })} />
          Show each column as a card
        </label>
      </div>
      {message ? <p role="alert" className="border-l-2 border-[var(--state-warning)] pl-3 text-sm">{message}</p> : null}
    </div>
  );
}
