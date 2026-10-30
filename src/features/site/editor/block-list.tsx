"use client";

import type { Dispatch } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { SITE_LIMITS } from "../blocks/block-validation";
import BlockBody, { BLOCK_LABELS } from "./block-editors";
import { countEditorBlocks, newBlock, newColumnsLayout, newMinistriesShowcase, type ColumnsLayout, type EditorAction, type EditorBlock, type NewBlockKind } from "./editor-state";

const SECONDARY_BUTTON = "ui-btn-secondary pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";
const ICON_BUTTON = "inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-40";

// One thing that can be added: its words, how many blocks it adds to the page (a ready-made layout adds several),
// and how to make it.
type Choice = { id: string; label: string; size: number; make: () => EditorBlock };

const single = (kind: NewBlockKind, label: string): Choice => ({ id: kind, label, size: 1, make: () => newBlock(kind) });
const layout = (id: ColumnsLayout, label: string, size: number): Choice => ({ id: `columns-${id}`, label, size, make: () => newColumnsLayout(id) });

const ORDINARY: Choice[] = [
  single("PARAGRAPH", "Text"), single("HEADING", "Heading"), single("IMAGE", "Picture"), single("LIST", "List"), single("QUOTE", "Quote"), single("BUTTON", "Button"), single("SPACER", "Space"),
  single("SERVICE_TIMES", "Service times"), single("ANNOUNCEMENTS_LIST", "Announcements"), single("EVENTS_LIST", "Upcoming events"), single("CONTACT", "Contact details"),
];
const COLUMN_LAYOUTS: Choice[] = [
  layout("picture-left", "Picture and text (picture on the left)", 4),
  layout("picture-right", "Picture and text (picture on the right)", 4),
  layout("cards-3", "Three cards", 7),
  layout("two-columns", "Two columns", 3),
];

export type ListKind = "page" | "section" | "column";

// The page itself can hold everything. A Section holds ordinary blocks and Columns. A column holds ordinary blocks only.
// The Carousel brings three starter cards, which count towards the blocks on the page.
const CAROUSEL: Choice = { id: "CAROUSEL", label: "Carousel of cards", size: 4, make: () => newBlock("CAROUSEL") };
const MINISTRIES: Choice = { id: "ministries-showcase", label: "Our ministries (ready-made)", size: countEditorBlocks([newMinistriesShowcase()]), make: newMinistriesShowcase };

const CHOICES: Record<ListKind, Choice[]> = {
  page: [single("COVER", "Cover (big picture with words)"), ...ORDINARY, single("SECTION", "Section"), ...COLUMN_LAYOUTS, CAROUSEL, MINISTRIES],
  section: [...ORDINARY, ...COLUMN_LAYOUTS, CAROUSEL],
  column: ORDINARY,
};

export type ListContext = {
  dispatch: Dispatch<EditorAction>;
  problems: Map<string, string>;
  pages: Array<{ slug: string; title: string }>;
  readOnly: boolean;
  // Blocks on the whole page, counting the ones inside Sections and columns.
  total: number;
  // Which "add" menu is open: "<where>|<after>", where "where" is the key of a Section or column, or "page".
  picker: string | null;
  setPicker: (value: string | null) => void;
};

type Props = { blocks: EditorBlock[]; kind?: ListKind; parentKey?: string; ctx: ListContext };

const WORDS: Record<ListKind, { aria: string; empty: string; add: string; full: string }> = {
  page: { aria: "Blocks on this page", empty: "This page is empty. Choose Add a block to start.", add: "Add a block", full: `This page has the most blocks it can hold (${SITE_LIMITS.blocksPerPage}).` },
  section: { aria: "Blocks inside this section", empty: "Nothing in this section yet.", add: "Add to this section", full: `A section holds up to ${SITE_LIMITS.sectionBlocks} blocks.` },
  column: { aria: "Blocks inside this column", empty: "Nothing in this column yet.", add: "Add to this column", full: `A column holds up to ${SITE_LIMITS.columnBlocks} blocks.` },
};

// One list of blocks. On the page it is the whole page; inside a Section or a column it is that container's own
// list, drawn indented, with the same add, move and delete buttons.
export default function BlockList({ blocks, kind = "page", parentKey, ctx }: Props) {
  const { dispatch, problems, pages, readOnly, total, picker, setPicker } = ctx;
  const where = parentKey ?? "page";
  const words = WORDS[kind];
  const remaining = SITE_LIMITS.blocksPerPage - total;
  const listLimit = kind === "section" ? SITE_LIMITS.sectionBlocks : kind === "column" ? SITE_LIMITS.columnBlocks : SITE_LIMITS.blocksPerPage;
  const full = remaining <= 0 || blocks.length >= listLimit;

  function add(choice: Choice, afterKey?: string) {
    dispatch({ type: "add", block: choice.make(), afterKey, parentKey });
    setPicker(null);
  }

  function menu(afterKey?: string) {
    return (
      <div className="grid grid-cols-2 gap-2 border-t border-[var(--rule-default)] py-3 sm:grid-cols-3 lg:grid-cols-4" role="group" aria-label="Choose a block to add">
        {CHOICES[kind].map((choice) => (
          <button key={choice.id} type="button" disabled={choice.size > remaining} onClick={() => add(choice, afterKey)} className={`${SECONDARY_BUTTON} justify-center text-center`}>{choice.label}</button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <ol className="divide-y divide-[var(--rule-default)] border-y border-[var(--rule-default)]" aria-label={words.aria}>
        {blocks.length === 0 ? <li className="py-6 text-sm text-[var(--text-muted)]">{words.empty}</li> : null}
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
              <BlockBody
                block={block}
                pages={pages}
                disabled={readOnly}
                onChange={(content, coalesce) => dispatch({ type: "update", key: block.key, content, coalesce })}
                onSetColumns={(count) => dispatch({ type: "setColumns", key: block.key, count })}
              />
              {problem ? <p role="alert" className="mt-2 border-l-2 border-[var(--state-danger)] pl-3 text-sm">{problem}</p> : null}
              {block.type === "SECTION" ? (
                <div className="ml-3 mt-4 border-l-2 border-[var(--border-focus)] pl-4" role="group" aria-label="Inside this section">
                  <p className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">Inside this section</p>
                  <BlockList blocks={block.content.blocks} kind="section" parentKey={block.key} ctx={ctx} />
                </div>
              ) : null}
              {block.type === "COLUMNS" ? (
                <div className="mt-4 space-y-4" role="group" aria-label="Inside these columns">
                  {block.content.columns.map((column, columnIndex) => (
                    <div key={column.key} className="ml-3 border-l-2 border-[var(--border-focus)] pl-4" role="group" aria-label={`Column ${columnIndex + 1}`}>
                      <p className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">Column {columnIndex + 1}</p>
                      <BlockList blocks={column.blocks} kind="column" parentKey={column.key} ctx={ctx} />
                    </div>
                  ))}
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
            <p className="text-sm text-[var(--text-muted)]">{remaining <= 0 ? WORDS.page.full : words.full}</p>
          ) : (
            <>
              <button type="button" className={SECONDARY_BUTTON + " min-h-11 gap-2"} aria-expanded={picker === `${where}|end`} onClick={() => setPicker(picker === `${where}|end` ? null : `${where}|end`)}>
                <Plus aria-hidden="true" className="h-4 w-4" />{words.add}
              </button>
              {picker === `${where}|end` ? menu() : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
