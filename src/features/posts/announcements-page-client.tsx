"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import AnnouncementDetails, { dateRange } from "./announcement-details";
import AnnouncementForm from "./announcement-form";
import { announcementGroups } from "./post-rules";
import type { AnnouncementItem, AnnouncementListResponse } from "./post-types";
import { SkeletonRows } from "@/components/ui/skeleton";

function Row({ item, selected, onSelect }: { item: AnnouncementItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left hover:bg-[var(--surface-panel-alt)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${selected ? "bg-[var(--surface-panel-strong)]" : ""}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{item.title}</span>
        <span className="block truncate text-xs text-[var(--text-muted)]">{dateRange(item)}</span>
      </span>
      {item.isPublic && item.status === "PUBLISHED" ? <span className="shrink-0 rounded bg-[var(--surface-panel-strong)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">On website</span> : null}
    </button>
  );
}

function Group({ title, items, selectedId, onSelect, note }: { title: string; items: AnnouncementItem[]; selectedId: string | null; onSelect: (id: string) => void; note?: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className="border-b border-[var(--border-default)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{title} <span className="font-normal text-[var(--text-muted)]">({items.length})</span></h2>
      <div className="divide-y divide-[var(--border-default)]">
        {items.map((item) => <Row key={item.id} item={item} selected={item.id === selectedId} onSelect={() => onSelect(item.id)} />)}
      </div>
      {note ? <p className="px-3 py-2 text-xs text-[var(--text-muted)]">{note}</p> : null}
    </section>
  );
}

export default function AnnouncementsPageClient() {
  // ?post=ID opens that announcement, for example right after "Announce this event". It is read from the
  // router, not window.location, because window.location still has the old address while this page first
  // renders after a client navigation. Choosing a row, or New announcement, takes over from the address.
  const postFromAddress = useSearchParams().get("post");
  const [chosenId, setChosenId] = useState<string | null | undefined>(undefined);
  const selectedId = chosenId === undefined ? postFromAddress : chosenId;
  const setSelectedId = setChosenId;
  const [creating, setCreating] = useState(false);
  const [showEnded, setShowEnded] = useState(false);
  const query = useQuery({ queryKey: ["announcements"], queryFn: () => apiFetch<AnnouncementListResponse>("/api/announcements") });
  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const groups = useMemo(() => announcementGroups(items), [items]);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const select = (id: string) => { setSelectedId(id); setCreating(false); };

  return (
    <section className="min-h-[calc(100vh-8rem)] text-[var(--text-primary)]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Announcements</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Write notices for the church, choose when they show, and copy the text for Facebook and Instagram.</p>
        </div>
        {query.data?.canCreate ? (
          <button type="button" onClick={() => { setCreating(true); setSelectedId(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 text-sm font-semibold text-[var(--action-primary-ink)]">
            <Plus aria-hidden="true" className="h-4 w-4" />New announcement
          </button>
        ) : null}
      </header>

      {query.isPending ? <div className="overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)]"><SkeletonRows label="Loading announcements" rows={4} /></div> : null}
      {query.isError ? <div role="alert" className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 text-sm"><p>Announcements could not be loaded. {query.error instanceof Error ? query.error.message : ""}</p><button type="button" onClick={() => void query.refetch()} className="mt-3 min-h-11 text-sm font-semibold text-[var(--text-accent)] underline">Try again</button></div> : null}
      {query.isSuccess ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]">
            {items.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
                <Megaphone aria-hidden="true" className="mb-3 h-7 w-7 text-[var(--text-muted)]" />
                <p className="text-sm font-semibold">No announcements yet</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{query.data.canCreate ? "Choose New announcement to write the first one." : "Announcements written by the team will show here."}</p>
              </div>
            ) : (
              <>
                <Group title="Drafts" items={groups.drafts} selectedId={selectedId} onSelect={select} />
                <Group title="Live now" items={groups.live} selectedId={selectedId} onSelect={select} />
                <Group title="Scheduled" items={groups.scheduled} selectedId={selectedId} onSelect={select} />
                {groups.endedTotal > 0 ? (
                  <div>
                    <button type="button" aria-expanded={showEnded} onClick={() => setShowEnded((open) => !open)} className="flex min-h-11 w-full items-center justify-between border-b border-[var(--border-default)] px-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:bg-[var(--surface-panel-alt)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]">
                      <span>Ended <span className="font-normal text-[var(--text-muted)]">({groups.endedTotal})</span></span>
                      <span>{showEnded ? "Hide" : "Show"}</span>
                    </button>
                    {showEnded ? (
                      <div className="divide-y divide-[var(--border-default)]">
                        {groups.ended.map((item) => <Row key={item.id} item={item} selected={item.id === selectedId} onSelect={() => select(item.id)} />)}
                        {groups.endedTotal > groups.ended.length ? <p className="px-3 py-2 text-xs text-[var(--text-muted)]">Showing the {groups.ended.length} most recent of {groups.endedTotal}.</p> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>

          <aside className="min-h-64 rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--elevation-subtle)]" aria-label="Announcement details">
            {creating ? (
              <AnnouncementForm
                item={null}
                events={query.data.events}
                canPublish={query.data.canPublish}
                onSaved={(saved) => { setCreating(false); setSelectedId(saved.id); void query.refetch(); }}
                onClose={() => setCreating(false)}
              />
            ) : selected ? (
              <AnnouncementDetails key={`${selected.id}-${selected.updatedAt}`} item={selected} flags={query.data} onGone={() => setSelectedId(null)} />
            ) : (
              <div>
                <h2 className="text-lg font-semibold">No announcement selected</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">Choose an announcement to read it, edit it, or copy its text.</p>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
