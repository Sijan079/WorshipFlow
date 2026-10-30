"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Home, Redo2, Trash2, Undo2, X } from "lucide-react";
import { apiFetch, workspaceApiPath } from "@/lib/api-client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import { SITE_LIMITS, SiteBlockSchema, type SiteBlockInput } from "../blocks/block-validation";
import BlockList, { type ListContext } from "./block-list";
import { blockProblems } from "./block-problems";
import { LOCK_RENEW_SECONDS } from "../pages/page-lock";
import { hasMainHeading } from "../pages/page-rules";
import PreviewPanel from "./preview-panel";
import { canRedo, canUndo, countEditorBlocks, editorReducer, initialEditorState, stripKeys, withKeys, type EditorBlock } from "./editor-state";
import type { PageDetail, PageListItem } from "./editor-types";
import { Skeleton } from "@/components/ui/skeleton";

const PRIMARY_BUTTON = "ui-btn-primary pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";
const SECONDARY_BUTTON = "ui-btn-secondary pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";
const DANGER_BUTTON = "ui-btn-danger-solid pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";
const KEEP_BUTTON = "inline-flex h-11 items-center rounded-md px-4 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]";
const ICON_BUTTON = "inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-40";
const AUTOSAVE_DELAY_MS = 2000;

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
function snapshot(title: string, description: string, blocks: EditorBlock[], showTitle: boolean) {
  return JSON.stringify({ title: title.trim(), description: description.trim(), showTitle, blocks: stripKeys(blocks) });
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

function ConfirmMakeHome({ title, oldHomeTitle, notLive, busy, onClose, onConfirm }: { title: string; oldHomeTitle: string | null; notLive: boolean; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md space-y-4">
        <button type="button" onClick={onClose} aria-label="Close" title="Close" className="ui-modal-close absolute right-3 top-3"><X aria-hidden="true" className="h-4 w-4" /></button>
        <DialogTitle className="pr-12 text-xl font-semibold text-[var(--text-primary)]">Make This the Home Page</DialogTitle>
        <DialogDescription className="space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
          <span className="block">“{title}” will be the page visitors see first.{oldHomeTitle ? ` The current home page, “${oldHomeTitle}”, stays as an ordinary page.` : ""}</span>
          {notLive ? <span className="block font-semibold">This page is not published yet, so your website will show “This page is not available” until you publish it.</span> : null}
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <button type="button" autoFocus onClick={onClose} className={KEEP_BUTTON}>Keep it as it is</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={PRIMARY_BUTTON}>{busy ? "Changing…" : "Yes, I am sure"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Loaded({ page, skipped, initial, flags, pages, onChanged, onDeleted }: { page: PageDetail; skipped: number; initial: EditorBlock[] } & Omit<Props, "pageId">) {
  const workspaceSlug = String(useParams<{ workspaceSlug: string }>().workspaceSlug ?? "");
  const [title, setTitle] = useState(page.title);
  const [description, setDescription] = useState(page.description ?? "");
  const [showTitle, setShowTitle] = useState(page.showTitle);
  const [editor, dispatch] = useReducer(editorReducer, initial, initialEditorState);
  const [status, setStatus] = useState(page.status);
  const [isPublic, setIsPublic] = useState(page.isPublic);
  const [notice, setNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  // What the server last confirmed, as a snapshot. The page is "dirty" whenever the editor differs from it.
  const [saved, setSaved] = useState(() => snapshot(page.title, page.description ?? "", initial, page.showTitle));

  const current = snapshot(title, description, editor.blocks, showTitle);
  const dirty = current !== saved;
  const problems = useMemo(() => blockProblems(editor.blocks), [editor.blocks]);
  // Only one person edits a page at a time. Opening the page claims it, and asking again every 20 seconds
  // renews the claim. If the question itself fails, staying view-only is safer than risking an overwrite.
  const claim = useQuery({
    queryKey: ["site-page-lock", page.id],
    queryFn: () => apiFetch<{ mine: boolean; by: string | null }>(`/api/site/pages/${page.id}/lock`, { method: "POST" }),
    enabled: flags.canEdit,
    refetchInterval: LOCK_RENEW_SECONDS * 1000,
    refetchIntervalInBackground: true,
    retry: false,
    gcTime: 0,
  });
  const lock: "checking" | "mine" | "other" = !flags.canEdit ? "other" : claim.data ? (claim.data.mine ? "mine" : "other") : claim.isError ? "other" : "checking";
  const holder = claim.data && !claim.data.mine ? claim.data.by : null;
  const canSave = flags.canEdit && lock === "mine" && problems.size === 0 && title.trim() !== "";
  const readOnly = !flags.canEdit || lock !== "mine";

  // Give the page back when the editor closes, so the next person does not wait for the claim to run out.
  useEffect(() => {
    if (!flags.canEdit) return;
    const release = () => { void fetch(workspaceApiPath(`/api/site/pages/${page.id}/lock`), { method: "DELETE", keepalive: true }); };
    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [page.id, flags.canEdit]);

  const save = useMutation({
    mutationFn: (extra?: { status?: "DRAFT" | "PUBLISHED"; isPublic?: boolean }) => {
      const sent = snapshot(title, description, editor.blocks, showTitle);
      const body = JSON.parse(sent) as { title: string; description: string; showTitle: boolean; blocks: unknown[] };
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

  const queryClient = useQueryClient();
  const [confirmHome, setConfirmHome] = useState(false);
  const makeHome = useMutation({
    mutationFn: () => apiFetch<{ slug: string }>(`/api/site/pages/${page.id}/make-home`, { method: "POST" }),
    onSuccess: () => {
      setConfirmHome(false);
      void queryClient.invalidateQueries({ queryKey: ["site-page", page.id] });
      onChanged();
    },
  });

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

  const listContext: ListContext = { dispatch, problems, pages: pageList, readOnly, total: countEditorBlocks(editor.blocks), picker, setPicker };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          {!dirty && !save.isPending && !save.isError ? <Check aria-hidden="true" className="h-4 w-4 text-[var(--state-success)]" /> : null}
          {saveLine}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Edit or preview" className="flex gap-2">
            <button type="button" aria-pressed={mode === "edit"} className={`pressable inline-flex min-h-11 items-center px-4 text-sm font-semibold ${mode === "edit" ? "ui-btn-primary" : "ui-btn-secondary"}`} onClick={() => setMode("edit")}>Edit</button>
            <button type="button" aria-pressed={mode === "preview"} className={`pressable inline-flex min-h-11 items-center px-4 text-sm font-semibold ${mode === "preview" ? "ui-btn-primary" : "ui-btn-secondary"}`} onClick={() => setMode("preview")}>Preview</button>
          </div>
          <button type="button" className={ICON_BUTTON} aria-label="Undo" title="Undo" disabled={!canUndo(editor) || readOnly || mode === "preview"} onClick={() => dispatch({ type: "undo" })}><Undo2 aria-hidden="true" className="h-5 w-5" /></button>
          <button type="button" className={ICON_BUTTON} aria-label="Redo" title="Redo" disabled={!canRedo(editor) || readOnly || mode === "preview"} onClick={() => dispatch({ type: "redo" })}><Redo2 aria-hidden="true" className="h-5 w-5" /></button>
          {flags.canPublish && !isHome && mode === "edit" ? (
            <button type="button" className={SECONDARY_BUTTON + " min-h-11 gap-2"} disabled={save.isPending} onClick={() => setConfirmHome(true)}><Home aria-hidden="true" className="h-4 w-4" />Make this the home page</button>
          ) : null}
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

      {lock === "other" && flags.canEdit ? (
        <p role="status" className="border-l-2 border-[var(--border-focus)] pl-3 text-sm">
          {holder ? `${holder} is editing this page.` : "Someone else is editing this page."} You can look at it, but you cannot change it until they are done.{" "}
          <button type="button" className="font-semibold underline" onClick={() => void claim.refetch()}>Check again</button>
        </p>
      ) : null}
      {notice ? <p role="status" className="border-l-2 border-[var(--border-focus)] pl-3 text-sm">{notice}</p> : null}
      {skipped > 0 ? <p role="alert" className="border-l-2 border-[var(--state-warning)] pl-3 text-sm">{skipped} block{skipped === 1 ? "" : "s"} on this page could not be read and {skipped === 1 ? "is" : "are"} hidden. Saving will remove {skipped === 1 ? "it" : "them"}.</p> : null}
      {save.isError ? <p role="alert" className="border-l-2 border-[var(--state-danger)] pl-3 text-sm">{save.error instanceof Error ? save.error.message : "The page could not be saved."} <button type="button" className="font-semibold underline" onClick={() => save.mutate(undefined)}>Try again</button></p> : null}

      {mode === "preview" ? (
        <PreviewPanel pageId={page.id} churchSlug={workspaceSlug} savedKey={saved} saving={save.isPending} unsaved={dirty} />
      ) : (
        <>
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

        <div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="ui-checkbox" checked={showTitle} disabled={readOnly} onChange={(event) => setShowTitle(event.target.checked)} />
            Show the page title as a large heading at the top
          </label>
          {!hasMainHeading({ showTitle, blocks: editor.blocks }) ? <p role="status" className="border-l-2 border-[var(--state-warning)] pl-3 text-sm">Without a title, add a Cover with a headline, so the page still has a main heading for screen readers and search engines.</p> : null}
        </div>

        <BlockList blocks={editor.blocks} ctx={listContext} />
        {readOnly ? <p className="text-sm text-[var(--text-muted)]">{lock === "checking" ? "Checking whether anyone else is editing this page…" : "You can look at this page but not change it."}</p> : null}

        {flags.canDelete && !isHome && status === "DRAFT" ? (
          <div className="border-t border-[var(--rule-default)] pt-4">
            <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--state-danger)]" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden="true" className="h-4 w-4" />Delete this page</button>
          </div>
        ) : null}
        </>
      )}

      {confirmHome ? <ConfirmMakeHome title={title} oldHomeTitle={pages.find((item) => item.slug === "home")?.title ?? null} notLive={!live} busy={makeHome.isPending} onClose={() => setConfirmHome(false)} onConfirm={() => makeHome.mutate()} /> : null}
      {makeHome.isError ? <p role="alert" className="text-sm">{makeHome.error instanceof Error ? makeHome.error.message : "The home page could not be changed."}</p> : null}
      {confirmDelete ? <ConfirmDelete title={title} busy={remove.isPending} onClose={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} /> : null}
      {remove.isError ? <p role="alert" className="text-sm">{remove.error instanceof Error ? remove.error.message : "The page could not be deleted."}</p> : null}
    </div>
  );
}

export default function PageEditor({ pageId, ...rest }: Props) {
  // Loaded once per page. Saving updates what the editor shows itself, so a refetch never replaces what is being typed.
  const query = useQuery({ queryKey: ["site-page", pageId], queryFn: () => apiFetch<PageDetail>(`/api/site/pages/${pageId}`), staleTime: Infinity, refetchOnWindowFocus: false, gcTime: 0 });
  const prepared = useMemo(() => (query.data ? toEditorBlocks(query.data) : null), [query.data]);
  if (query.isPending) return <div className="space-y-4 py-6" role="status" aria-label="Loading the page"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (query.isError || !query.data || !prepared) {
    return <div role="alert" className="py-8 text-sm"><p>The page could not be loaded.</p><button type="button" onClick={() => void query.refetch()} className="mt-3 min-h-11 text-sm font-semibold text-[var(--text-accent)] underline">Try again</button></div>;
  }
  return <Loaded key={query.data.id} page={query.data} skipped={prepared.skipped} initial={prepared.blocks} {...rest} />;
}
