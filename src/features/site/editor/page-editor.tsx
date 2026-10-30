"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Plus, Redo2, Trash2, Undo2, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import { SITE_LIMITS, SiteBlockSchema, type SiteBlockInput } from "../blocks/block-validation";
import BlockBody, { BLOCK_LABELS } from "./block-editors";
import { blockProblems } from "./block-problems";
import { canRedo, canUndo, editorReducer, initialEditorState, newBlock, withKeys, type EditorBlock, type NewBlockKind } from "./editor-state";
import type { PageDetail, PageListItem } from "./editor-types";

const PRIMARY_BUTTON = "ui-btn-primary pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";
const SECONDARY_BUTTON = "ui-btn-secondary pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";
const DANGER_BUTTON = "ui-btn-danger-solid pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";
const KEEP_BUTTON = "inline-flex h-11 items-center rounded-md px-4 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]";
const ICON_BUTTON = "inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-40";
const AUTOSAVE_DELAY_MS = 2000;

const ADDABLE: Array<[NewBlockKind, string]> = [
  ["PARAGRAPH", "Text"], ["HEADING", "Heading"], ["IMAGE", "Picture"], ["LIST", "List"], ["QUOTE", "Quote"], ["BUTTON", "Button"], ["SPACER", "Space"],
  ["SERVICE_TIMES", "Service times"], ["ANNOUNCEMENTS_LIST", "Announcements"], ["EVENTS_LIST", "Upcoming events"], ["CONTACT", "Contact details"],
];

type Flags = { canEdit: boolean; canDelete: boolean; canPublish: boolean };
type Props = { pageId: string; flags: Flags; pages: PageListItem[]; onChanged: () => void; onDeleted: () => void };

function toEditorBlocks(page: PageDetail) {
  const valid: SiteBlockInput[] = [];
  let skipped = 0;
  for (const block of page.blocks) {
    const parsed = SiteBlockSchema.safeParse({ type: block.type, content: block.content });
    if (parsed.success) valid.push(parsed.data);
    else skipped += 1;
  }
  return { blocks: withKeys(valid), skipped };
}

// What gets saved: the words and the blocks, without the editor's own keys.
function snapshot(title: string, description: string, blocks: EditorBlock[]) {
  return JSON.stringify({ title: title.trim(), description: description.trim(), blocks: blocks.map(({ key, ...block }) => { void key; return block; }) });
}

function ConfirmDelete({ title, onClose, onConfirm, busy }: { title: string; onClose: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md space-y-4">
        <button type="button" onClick={onClose} aria-label="Close" title="Close" className="ui-modal-close absolute right-3 top-3"><X aria-hidden="true" className="h-4 w-4" /></button>
        <DialogTitle className="pr-12 text-xl font-semibold text-[var(--text-primary)]">Delete This Page</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-[var(--text-secondary)]">“{title}” and everything on it will be removed. This cannot be undone.</DialogDescription>
        <div className="flex justify-end gap-2">
          <button type="button" autoFocus onClick={onClose} className={KEEP_BUTTON}>Keep it</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={DANGER_BUTTON}>{busy ? "Deleting…" : "Yes, I am sure"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Loaded({ page, skipped, initial, flags, pages, onChanged, onDeleted }: { page: PageDetail; skipped: number; initial: EditorBlock[] } & Omit<Props, "pageId">) {
  const workspaceSlug = String(useParams<{ workspaceSlug: string }>().workspaceSlug ?? "");
  const [title, setTitle] = useState(page.title);
  const [description, setDescription] = useState(page.description ?? "");
  const [editor, dispatch] = useReducer(editorReducer, initial, initialEditorState);
  const [status, setStatus] = useState(page.status);
  const [isPublic, setIsPublic] = useState(page.isPublic);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerAfter, setPickerAfter] = useState<string | "end" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // What the server last confirmed, as a snapshot. The page is "dirty" whenever the editor differs from it.
  const [saved, setSaved] = useState(() => snapshot(page.title, page.description ?? "", initial));

  const current = snapshot(title, description, editor.blocks);
  const dirty = current !== saved;
  const problems = useMemo(() => blockProblems(editor.blocks), [editor.blocks]);
  const canSave = flags.canEdit && problems.size === 0 && title.trim() !== "";
  const readOnly = !flags.canEdit;

  const save = useMutation({
    mutationFn: (extra?: { status?: "DRAFT" | "PUBLISHED"; isPublic?: boolean }) => {
      const sent = snapshot(title, description, editor.blocks);
      const body = JSON.parse(sent) as { title: string; description: string; blocks: unknown[] };
      return apiFetch<PageDetail>(`/api/site/pages/${page.id}`, { method: "PATCH", body: JSON.stringify({ ...body, ...extra }) }).then((saved) => ({ saved, sent }));
    },
    onSuccess: ({ saved, sent }) => {
      setSaved(sent);
      setStatus(saved.status);
      setIsPublic(saved.isPublic);
      setNotice(saved.sentBackToDraft ? "This page was live. Your change sent it back to Draft until someone who can publish approves it." : null);
      onChanged();
    },
  });

  // Autosave: two seconds after the last change, and only when the page is valid, so a half-finished button
  // never blocks the rest of the page from being kept.
  useEffect(() => {
    if (!dirty || !canSave || save.isPending) return;
    const timer = window.setTimeout(() => save.mutate(undefined), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [current, dirty, canSave, save]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const remove = useMutation({
    mutationFn: () => apiFetch<{ deleted: true }>(`/api/site/pages/${page.id}`, { method: "DELETE" }),
    onSuccess: () => { onChanged(); onDeleted(); },
  });

  const saveLine = save.isError ? "Could not save. Your changes are still here."
    : problems.size > 0 ? "Fix the marked block to save."
    : title.trim() === "" ? "Give the page a title to save."
    : save.isPending ? "Saving…"
    : dirty ? "Saving soon…"
    : "All changes saved";

  const live = status === "PUBLISHED" && isPublic;
  const isHome = page.slug === "home";
  const pageList = pages.map((item) => ({ slug: item.slug, title: item.title }));

  function addBlock(kind: NewBlockKind, afterKey?: string) {
    dispatch({ type: "add", block: newBlock(kind), afterKey });
    setPickerAfter(null);
  }

  function picker(afterKey?: string) {
    return (
      <div className="grid grid-cols-2 gap-2 border-t border-[var(--rule-default)] py-3 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Choose a block to add">
        {ADDABLE.map(([kind, label]) => (
          <button key={kind} type="button" onClick={() => addBlock(kind, afterKey)} className={`${SECONDARY_BUTTON} justify-center`}>{label}</button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          {!dirty && !save.isPending && !save.isError ? <Check aria-hidden="true" className="h-4 w-4 text-[var(--state-success)]" /> : null}
          {saveLine}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={ICON_BUTTON} aria-label="Undo" title="Undo" disabled={!canUndo(editor) || readOnly} onClick={() => dispatch({ type: "undo" })}><Undo2 aria-hidden="true" className="h-5 w-5" /></button>
          <button type="button" className={ICON_BUTTON} aria-label="Redo" title="Redo" disabled={!canRedo(editor) || readOnly} onClick={() => dispatch({ type: "redo" })}><Redo2 aria-hidden="true" className="h-5 w-5" /></button>
          {live ? <a className={SECONDARY_BUTTON + " min-h-11"} href={isHome ? `/c/${workspaceSlug}` : `/c/${workspaceSlug}/${page.slug}`} target="_blank" rel="noopener noreferrer">View live page</a> : null}
          {flags.canPublish ? (
            live ? (
              <button type="button" className={SECONDARY_BUTTON + " min-h-11"} disabled={save.isPending || !canSave} onClick={() => save.mutate({ status: "DRAFT" })}>Unpublish</button>
            ) : (
              <button type="button" className={PRIMARY_BUTTON} disabled={save.isPending || !canSave} onClick={() => save.mutate({ status: "PUBLISHED", isPublic: true })}>Publish</button>
            )
          ) : null}
        </div>
      </div>

      {notice ? <p role="status" className="border-l-2 border-[var(--border-focus)] pl-3 text-sm">{notice}</p> : null}
      {skipped > 0 ? <p role="alert" className="border-l-2 border-[var(--state-warning)] pl-3 text-sm">{skipped} block{skipped === 1 ? "" : "s"} on this page could not be read and {skipped === 1 ? "is" : "are"} hidden. Saving will remove {skipped === 1 ? "it" : "them"}.</p> : null}
      {save.isError ? <p role="alert" className="border-l-2 border-[var(--state-danger)] pl-3 text-sm">{save.error instanceof Error ? save.error.message : "The page could not be saved."} <button type="button" className="font-semibold underline" onClick={() => save.mutate(undefined)}>Try again</button></p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>Page title</span>
          <input className={TEXT_FIELD_CLASS} value={title} maxLength={SITE_LIMITS.titleMax} disabled={readOnly} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>Short description for search results (optional)</span>
          <input className={TEXT_FIELD_CLASS} value={description} maxLength={SITE_LIMITS.descriptionMax} disabled={readOnly} onChange={(event) => setDescription(event.target.value)} />
        </label>
      </div>

      <ol className="divide-y divide-[var(--rule-default)] border-y border-[var(--rule-default)]" aria-label="Blocks on this page">
        {editor.blocks.length === 0 ? <li className="py-6 text-sm text-[var(--text-muted)]">This page is empty. Choose Add a block to start.</li> : null}
        {editor.blocks.map((block, index) => {
          const problem = problems.get(block.key);
          return (
            <li key={block.key} className="py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{BLOCK_LABELS[block.type]}</h3>
                {!readOnly ? (
                  <div className="flex items-center">
                    <button type="button" className={ICON_BUTTON} aria-label={`Move ${BLOCK_LABELS[block.type]} up`} title="Move up" disabled={index === 0} onClick={() => dispatch({ type: "move", key: block.key, direction: "up" })}><ArrowUp aria-hidden="true" className="h-5 w-5" /></button>
                    <button type="button" className={ICON_BUTTON} aria-label={`Move ${BLOCK_LABELS[block.type]} down`} title="Move down" disabled={index === editor.blocks.length - 1} onClick={() => dispatch({ type: "move", key: block.key, direction: "down" })}><ArrowDown aria-hidden="true" className="h-5 w-5" /></button>
                    <button type="button" className={ICON_BUTTON} aria-label={`Delete ${BLOCK_LABELS[block.type]}`} title="Delete this block" onClick={() => dispatch({ type: "remove", key: block.key })}><Trash2 aria-hidden="true" className="h-5 w-5" /></button>
                  </div>
                ) : null}
              </div>
              <BlockBody block={block} pages={pageList} disabled={readOnly} onChange={(content, coalesce) => dispatch({ type: "update", key: block.key, content, coalesce })} />
              {problem ? <p role="alert" className="mt-2 border-l-2 border-[var(--state-danger)] pl-3 text-sm">{problem}</p> : null}
              {!readOnly && editor.blocks.length < SITE_LIMITS.blocksPerPage ? (
                <div className="mt-2">
                  <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--text-accent)]" aria-expanded={pickerAfter === block.key} onClick={() => setPickerAfter(pickerAfter === block.key ? null : block.key)}>
                    <Plus aria-hidden="true" className="h-4 w-4" />Add a block below
                  </button>
                  {pickerAfter === block.key ? picker(block.key) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {!readOnly ? (
        <div>
          {editor.blocks.length >= SITE_LIMITS.blocksPerPage ? (
            <p className="text-sm text-[var(--text-muted)]">This page has the most blocks it can hold ({SITE_LIMITS.blocksPerPage}).</p>
          ) : (
            <>
              <button type="button" className={SECONDARY_BUTTON + " min-h-11 gap-2"} aria-expanded={pickerAfter === "end"} onClick={() => setPickerAfter(pickerAfter === "end" ? null : "end")}>
                <Plus aria-hidden="true" className="h-4 w-4" />Add a block
              </button>
              {pickerAfter === "end" ? picker() : null}
            </>
          )}
        </div>
      ) : <p className="text-sm text-[var(--text-muted)]">You can look at this page but not change it.</p>}

      {flags.canDelete && !isHome && status === "DRAFT" ? (
        <div className="border-t border-[var(--rule-default)] pt-4">
          <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--state-danger)]" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden="true" className="h-4 w-4" />Delete this page</button>
        </div>
      ) : null}
      {confirmDelete ? <ConfirmDelete title={title} busy={remove.isPending} onClose={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} /> : null}
      {remove.isError ? <p role="alert" className="text-sm">{remove.error instanceof Error ? remove.error.message : "The page could not be deleted."}</p> : null}
    </div>
  );
}

export default function PageEditor({ pageId, ...rest }: Props) {
  // Loaded once per page. Saving updates what the editor shows itself, so a refetch never replaces what is being typed.
  const query = useQuery({ queryKey: ["site-page", pageId], queryFn: () => apiFetch<PageDetail>(`/api/site/pages/${pageId}`), staleTime: Infinity, refetchOnWindowFocus: false, gcTime: 0 });
  const prepared = useMemo(() => (query.data ? toEditorBlocks(query.data) : null), [query.data]);
  if (query.isPending) return <p role="status" className="py-8 text-sm text-[var(--text-muted)]">Loading the page…</p>;
  if (query.isError || !query.data || !prepared) {
    return <div role="alert" className="py-8 text-sm"><p>The page could not be loaded.</p><button type="button" onClick={() => void query.refetch()} className="mt-3 min-h-11 text-sm font-semibold text-[var(--text-accent)] underline">Try again</button></div>;
  }
  return <Loaded key={query.data.id} page={query.data} skipped={prepared.skipped} initial={prepared.blocks} {...rest} />;
}
