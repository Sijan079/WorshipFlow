"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PublicSwitch } from "@/features/events/event-form-fields";
import { fullDateLabel, timeLabel } from "@/features/events/event-labels";
import AnnouncementForm, { CopyButton, SECONDARY_BUTTON, errorText } from "./announcement-form";
import { announcementPhase } from "./post-rules";
import type { AnnouncementItem, AnnouncementListResponse } from "./post-types";

type Flags = Pick<AnnouncementListResponse, "canEdit" | "canDelete" | "canPublish" | "events">;

const PHASE_LABEL = { draft: "Draft", scheduled: "Scheduled", live: "Live now", ended: "Ended" } as const;

export function dateRange(item: Pick<AnnouncementItem, "startDate" | "endDate">) {
  const short = (value: string) => fullDateLabel(value).replace(/^[A-Za-z]+, /, "").replace(/, \d{4}$/, "");
  if (item.startDate && item.endDate) return item.startDate === item.endDate ? short(item.startDate) : `${short(item.startDate)} to ${short(item.endDate)}`;
  if (item.startDate) return `From ${short(item.startDate)}`;
  if (item.endDate) return `Until ${short(item.endDate)}`;
  return "No dates";
}

// The panel for one announcement. People with Edit can change it; people with Publish can publish, unpublish
// and use the website switch; people with Delete can delete a draft.
export default function AnnouncementDetails({ item, flags, onGone }: { item: AnnouncementItem; flags: Flags; onGone: () => void }) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["announcements"] });
  const phase = announcementPhase(item);

  const change = useMutation({
    mutationFn: (body: { status?: "DRAFT" | "PUBLISHED"; isPublic?: boolean }) => apiFetch<AnnouncementItem>(`/api/announcements/${item.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/announcements/${item.id}`, { method: "DELETE" }),
    onSuccess: async () => { await refresh(); onGone(); },
  });

  if (mode === "edit") {
    return (
      <AnnouncementForm
        item={item}
        events={flags.events}
        canPublish={flags.canPublish}
        onSaved={(saved) => {
          const sent = (saved as AnnouncementItem & { sentBackToDraft?: boolean }).sentBackToDraft;
          setNotice(sent ? "Saved. It is a Draft again until someone who can publish approves it." : "");
          setMode("view");
          void refresh();
        }}
        onClose={() => setMode("view")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-[var(--surface-panel-strong)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">{PHASE_LABEL[phase]}</span>
          {item.isPublic && item.status === "PUBLISHED" ? <span className="rounded bg-[var(--surface-panel-strong)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">On website</span> : null}
        </div>
        <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{item.title}</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{dateRange(item)}</p>
        {item.body ? <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{item.body}</p> : <p className="mt-3 text-sm text-[var(--text-muted)]">No message yet.</p>}
      </div>
      {notice ? <p role="status" className="rounded-md bg-[var(--state-warning-soft)] px-3 py-2 text-sm font-medium text-[var(--state-warning)]">{notice}</p> : null}

      {item.event ? (
        <div className="border-t border-[var(--border-default)] pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">About the event</h3>
          <p className="mt-2 text-sm font-medium">{item.event.title}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {item.event.cancelled ? "Cancelled" : item.event.next ? `Next: ${fullDateLabel(item.event.next.localDate)}, ${timeLabel(item.event.next.startsAt, item.event.next.timezone)}` : "No upcoming dates"}
          </p>
        </div>
      ) : item.eventId ? <p className="text-sm text-[var(--text-muted)]">Linked to an event.</p> : null}

      <div className="border-t border-[var(--border-default)] pt-4">
        <PublicSwitch
          checked={item.isPublic}
          disabled={!flags.canPublish || change.isPending}
          onChange={(next) => change.mutate({ isPublic: next })}
          note={flags.canPublish ? "Shown on the public website while it is published and within its dates." : "Only people who can publish can change this."}
        />
      </div>

      {([["facebookText", "Facebook"], ["instagramText", "Instagram"]] as const).map(([key, label]) => item[key] ? (
        <div key={key} className="border-t border-[var(--border-default)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{label} text</h3>
            <CopyButton text={item[key] ?? ""} label={label} />
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{item[key]}</p>
        </div>
      ) : null)}

      {mode === "view" ? (
        <div className="flex flex-wrap gap-3 border-t border-[var(--border-default)] pt-4">
          {flags.canEdit ? <button type="button" onClick={() => { setNotice(""); setMode("edit"); }} className={SECONDARY_BUTTON}>Edit</button> : null}
          {flags.canPublish && item.status === "DRAFT" ? <button type="button" disabled={change.isPending} onClick={() => change.mutate({ status: "PUBLISHED" })} className="min-h-11 rounded-md bg-[var(--action-primary-bg)] px-4 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60">{change.isPending ? "Saving…" : "Publish"}</button> : null}
          {flags.canPublish && item.status === "PUBLISHED" ? <button type="button" disabled={change.isPending} onClick={() => change.mutate({ status: "DRAFT" })} className={SECONDARY_BUTTON}>{change.isPending ? "Saving…" : "Unpublish"}</button> : null}
          {flags.canDelete && item.status === "DRAFT" ? <button type="button" onClick={() => setMode("delete")} className={SECONDARY_BUTTON}>Delete announcement</button> : null}
        </div>
      ) : null}
      {flags.canDelete && item.status === "PUBLISHED" && mode === "view" ? <p className="text-xs text-[var(--text-muted)]">To delete this announcement, unpublish it first.</p> : null}
      {change.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(change.error)}</p> : null}

      {mode === "delete" ? (
        <div className="space-y-4 border-t border-[var(--border-default)] pt-4">
          <h3 className="text-lg font-semibold">Delete this announcement?</h3>
          <p className="text-sm text-[var(--text-secondary)]">{item.title} will be removed for good. This cannot be undone.</p>
          {remove.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(remove.error)}</p> : null}
          <div className="flex gap-3">
            <button type="button" autoFocus onClick={() => setMode("view")} className={SECONDARY_BUTTON}>Keep it</button>
            <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="ui-btn-danger-solid pressable min-h-11 flex-1 px-4 text-sm font-semibold disabled:opacity-60">{remove.isPending ? "Deleting…" : "Delete announcement"}</button>
          </div>
        </div>
      ) : null}

      <p className="border-t border-[var(--border-default)] pt-4 text-xs text-[var(--text-muted)]">
        Written by {item.createdBy ?? "someone"}{item.updatedBy && item.updatedBy !== item.createdBy ? `, last edited by ${item.updatedBy}` : ""}.
      </p>
    </div>
  );
}
