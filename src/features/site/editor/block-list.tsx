"use client";

import type { Dispatch } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { SITE_LIMITS } from "../blocks/block-validation";
import BlockBody, { BLOCK_LABELS } from "./block-editors";
import { newBlock, type EditorAction, type EditorBlock, type NewBlockKind } from "./editor-state";

const SECONDARY_BUTTON = "ui-btn-secondary pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";
const ICON_BUTTON = "inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-40";

const ADDABLE: Array<[NewBlockKind, string]> = [
  ["PARAGRAPH", "Text"], ["HEADING", "Heading"], ["IMAGE", "Picture"], ["LIST", "List"], ["QUOTE", "Quote"], ["BUTTON", "Button"], ["SPACER", "Space"],
  ["SERVICE_TIMES", "Service times"], ["ANNOUNCEMENTS_LIST", "Announcements"], ["EVENTS_LIST", "Upcoming events"], ["CONTACT", "Contact details"],
];
// A Section can only be added on the page itself, never inside another Section.
const ADDABLE_ON_PAGE: Array<[NewBlockKind, string]> = [...ADDABLE, ["SECTION", "Section"]];

export type ListContext = {
  dispatch: Dispatch<EditorAction>;
  problems: Map<string, string>;
  pages: Array<{ slug: string; title: string }>;
  readOnly: boolean;
  // Blocks on the whole page, counting the ones inside Sections.
  total: number;
  // Which "add" menu is open: "<where>|<after>", where "where" is a Section's key or "page".
  picker: string | null;
  setPicker: (value: string | null) => void;
};

type Props = { blocks: EditorBlock[]; parentKey?: string; ctx: ListContext };

// One list of blocks. On the page it is the whole page; inside a Section it is that Section's own list, drawn
// indented under the Section's settings, with the same add, move and delete buttons.
export default function BlockList({ blocks, parentKey, ctx }: Props) {
  const { dispatch, problems, pages, readOnly, total, picker, setPicker } = ctx;
  const where = parentKey ?? "page";
  const nested = Boolean(parentKey);
  const full = total >= SITE_LIMITS.blocksPerPage || (nested && blocks.length >= SITE_LIMITS.sectionBlocks);
  const choices = nested ? ADDABLE : ADDABLE_ON_PAGE;

  function add(kind: NewBlockKind, afterKey?: string) {
    dispatch({ type: "add", block: newBlock(kind), afterKey, parentKey });
    setPicker(null);
  }

  function menu(afterKey?: string) {
    return (
      <div className="grid grid-cols-2 gap-2 border-t border-[var(--rule-default)] py-3 sm:grid-cols-3 lg:grid-cols-4" role="group" aria-label="Choose a block to add">
        {choices.map(([kind, label]) => (
          <button key={kind} type="button" onClick={() => add(kind, afterKey)} className={`${SECONDARY_BUTTON} justify-center`}>{label}</button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <ol className="divide-y divide-[var(--rule-default)] border-y border-[var(--rule-default)]" aria-label={nested ? "Blocks inside this section" : "Blocks on this page"}>
        {blocks.length === 0 ? <li className="py-6 text-sm text-[var(--text-muted)]">{nested ? "Nothing in this section yet." : "This page is empty. Choose Add a block to start."}</li> : null}
        {blocks.map((block, index) => {
          const label = BLOCK_LABELS[block.type];
          const problem = problems.get(block.key);
          const here = `${where}|${block.key}`;
          return (
            <li key={block.key} className="py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{label}</h3>
                {!readOnly ? (
                  <div className="flex items-center">
                    <button type="button" className={ICON_BUTTON} aria-label={`Move ${label} up`} title="Move up" disabled={index === 0} onClick={() => dispatch({ type: "move", key: block.key, direction: "up" })}><ArrowUp aria-hidden="true" className="h-5 w-5" /></button>
                    <button type="button" className={ICON_BUTTON} aria-label={`Move ${label} down`} title="Move down" disabled={index === blocks.length - 1} onClick={() => dispatch({ type: "move", key: block.key, direction: "down" })}><ArrowDown aria-hidden="true" className="h-5 w-5" /></button>
                    <button type="button" className={ICON_BUTTON} aria-label={`Delete ${label}`} title="Delete this block" onClick={() => dispatch({ type: "remove", key: block.key })}><Trash2 aria-hidden="true" className="h-5 w-5" /></button>
                  </div>
                ) : null}
              </div>
              <BlockBody block={block} pages={pages} disabled={readOnly} onChange={(content, coalesce) => dispatch({ type: "update", key: block.key, content, coalesce })} />
              {problem ? <p role="alert" className="mt-2 border-l-2 border-[var(--state-danger)] pl-3 text-sm">{problem}</p> : null}
              {block.type === "SECTION" ? (
                <div className="ml-3 mt-4 border-l-2 border-[var(--border-focus)] pl-4" role="group" aria-label="Inside this section">
                  <p className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">Inside this section</p>
                  <BlockList blocks={block.content.blocks} parentKey={block.key} ctx={ctx} />
                </div>
              ) : null}
              {!readOnly && !full ? (
                <div className="mt-2">
                  <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--text-accent)]" aria-expanded={picker === here} onClick={() => setPicker(picker === here ? null : here)}>
                    <Plus aria-hidden="true" className="h-4 w-4" />Add a block below
                  </button>
                  {picker === here ? menu(block.key) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {!readOnly ? (
        <div className="mt-3">
          {full ? (
            <p className="text-sm text-[var(--text-muted)]">{nested ? `A section holds up to ${SITE_LIMITS.sectionBlocks} blocks.` : `This page has the most blocks it can hold (${SITE_LIMITS.blocksPerPage}).`}</p>
          ) : (
            <>
              <button type="button" className={SECONDARY_BUTTON + " min-h-11 gap-2"} aria-expanded={picker === `${where}|end`} onClick={() => setPicker(picker === `${where}|end` ? null : `${where}|end`)}>
                <Plus aria-hidden="true" className="h-4 w-4" />{nested ? "Add to this section" : "Add a block"}
              </button>
              {picker === `${where}|end` ? menu() : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
