"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import { STARTER_HOME_TITLE } from "../pages/starter-home";
import type { PageListItem, PageListResponse } from "./editor-types";
import PageEditor from "./page-editor";

const PRIMARY_BUTTON = "ui-btn-primary pressable inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60";
const SECONDARY_BUTTON = "ui-btn-secondary pressable inline-flex items-center px-4 text-sm font-semibold";

function statusText(page: PageListItem) {
  if (page.status === "PUBLISHED" && page.isPublic) return "Live";
  if (page.status === "PUBLISHED") return "Published, not shown";
  return "Draft";
}

function Row({ page, selected, onSelect }: { page: PageListItem; selected: boolean; onSelect: () => void }) {
  const live = page.status === "PUBLISHED" && page.isPublic;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left hover:bg-[var(--surface-panel-alt)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${selected ? "bg-[var(--surface-panel-strong)]" : ""}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{page.title}{page.slug === "home" ? " (home page)" : ""}</span>
        <span className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${live ? "bg-[var(--state-success)]" : "bg-[var(--text-muted)]"}`} />
          {statusText(page)}
        </span>
      </span>
    </button>
  );
}

function NewPageForm({ isFirst, onCreated, onClose }: { isFirst: boolean; onCreated: (id: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState(isFirst ? STARTER_HOME_TITLE : "");
  const [starter, setStarter] = useState(true);
  const create = useMutation({
    mutationFn: () => apiFetch<{ id: string }>("/api/site/pages", { method: "POST", body: JSON.stringify({ title: title.trim(), ...(isFirst ? { starter } : {}) }) }),
    onSuccess: (created) => onCreated(created.id),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim()) create.mutate();
  }
  return (
    <form onSubmit={submit} className="space-y-3 border-b border-[var(--rule-default)] p-3">
      <label className="block">
        <span className={FIELD_LABEL_CLASS}>{isFirst ? "Name of your home page" : "Page title"}</span>
        <input className={TEXT_FIELD_CLASS} value={title} maxLength={80} autoFocus onChange={(event) => setTitle(event.target.value)} />
      </label>
      {isFirst ? (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="ui-checkbox" checked={starter} onChange={(event) => setStarter(event.target.checked)} />
          Start with a ready-made page I can change
        </label>
      ) : null}
      {create.isError ? <p role="alert" className="text-sm">{create.error instanceof Error ? create.error.message : "The page could not be created."}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" className={SECONDARY_BUTTON + " min-h-11"} onClick={onClose}>Cancel</button>
        <button type="submit" className={PRIMARY_BUTTON} disabled={create.isPending || !title.trim()}>{create.isPending ? "Creating…" : "Create page"}</button>
      </div>
    </form>
  );
}

export default function SitePagesClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: ["site-pages"], queryFn: () => apiFetch<PageListResponse>("/api/site/pages") });
  const items = query.data?.items ?? [];
  const selected = items.find((page) => page.id === selectedId) ?? items[0] ?? null;
  const atLimit = query.data ? items.length >= query.data.limits.pagesPerChurch : false;

  return (
    <section className="min-h-[calc(100vh-8rem)] text-[var(--text-primary)]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Page Builder</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Build the pages of your church website. Nothing is shown to the public until you publish it.</p>
        </div>
        {query.data?.canCreate && !atLimit ? (
          <button type="button" onClick={() => setCreating(true)} className={PRIMARY_BUTTON}><Plus aria-hidden="true" className="h-4 w-4" />Add page</button>
        ) : null}
      </header>

      {query.isPending ? <p role="status" className="py-12 text-sm text-[var(--text-muted)]">Loading pages…</p> : null}
      {query.isError ? <div role="alert" className="py-8 text-sm"><p>The pages could not be loaded. {query.error instanceof Error ? query.error.message : ""}</p><button type="button" onClick={() => void query.refetch()} className="mt-3 min-h-11 text-sm font-semibold text-[var(--text-accent)] underline">Try again</button></div> : null}

      {query.isSuccess ? (
        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="Pages" className="min-w-0 self-start rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]">
            {creating ? <NewPageForm isFirst={items.length === 0} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setSelectedId(id); void query.refetch(); }} /> : null}
            {items.length === 0 && !creating ? (
              <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
                <FileText aria-hidden="true" className="mb-3 h-7 w-7 text-[var(--text-muted)]" />
                <p className="text-sm font-semibold">No pages yet</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{query.data.canCreate ? "Choose Add page to build your home page." : "Pages made by the team will show here."}</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--rule-default)]">
                {items.map((page) => <Row key={page.id} page={page} selected={page.id === selected?.id} onSelect={() => { setSelectedId(page.id); setCreating(false); }} />)}
              </div>
            )}
            {atLimit ? <p className="border-t border-[var(--rule-default)] px-3 py-2 text-sm text-[var(--text-muted)]">A church can have up to {query.data.limits.pagesPerChurch} pages.</p> : null}
          </nav>

          <div className="min-w-0 rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--elevation-subtle)]" aria-label="Page editor">
            {selected ? (
              <PageEditor
                key={selected.id}
                pageId={selected.id}
                flags={query.data}
                pages={items}
                onChanged={() => void query.refetch()}
                onDeleted={() => { setSelectedId(null); void query.refetch(); }}
              />
            ) : (
              <div>
                <h2 className="text-lg font-semibold">Start with your home page</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">Visitors see the home page first. You can add more pages later, like Visit or About.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
