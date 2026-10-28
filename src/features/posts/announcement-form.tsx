"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PublicSwitch } from "@/features/events/event-form-fields";
import type { AnnouncementItem, AnnouncementListResponse } from "./post-types";
import { ANNOUNCEMENT_BODY_MAX, INSTAGRAM_CAPTION_WARNING } from "./post-validation";

export const INPUT = "mt-1 min-h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]";
export const SECONDARY_BUTTON = "inline-flex min-h-11 items-center rounded-md border border-[var(--border-default)] px-4 text-sm font-semibold hover:bg-[var(--surface-panel-alt)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-60";
const TEXTAREA = "mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]";

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Could not save the announcement.";
}

// Copies text for Facebook or Instagram, which the team posts by hand.
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!text}
      aria-label={`Copy ${label} text`}
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }, () => undefined)}
      className={SECONDARY_BUTTON}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

type Props = {
  // The announcement being edited, or null for a new one.
  item: AnnouncementItem | null;
  events: AnnouncementListResponse["events"];
  canPublish: boolean;
  initial?: Partial<{ title: string; body: string; eventId: string }>;
  onSaved: (saved: AnnouncementItem) => void;
  onClose: () => void;
};

type Draft = {
  title: string;
  body: string;
  startDate: string;
  endDate: string;
  eventId: string;
  isPublic: boolean;
  facebookText: string;
  instagramText: string;
};

// One form for writing a new announcement and for editing one.
export default function AnnouncementForm({ item, events, canPublish, initial, onSaved, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>({
    title: item?.title ?? initial?.title ?? "",
    body: item?.body ?? initial?.body ?? "",
    startDate: item?.startDate ?? "",
    endDate: item?.endDate ?? "",
    eventId: item?.eventId ?? initial?.eventId ?? "",
    isPublic: item?.isPublic ?? false,
    facebookText: item?.facebookText ?? "",
    instagramText: item?.instagramText ?? "",
  });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const [problem, setProblem] = useState("");
  const sendsBackToDraft = Boolean(item && item.status === "PUBLISHED" && !canPublish);

  const save = useMutation({
    mutationFn: () => {
      const text = (value: string) => value.trim() || null;
      const shared = {
        title: draft.title.trim(),
        body: draft.body,
        startDate: draft.startDate || null,
        endDate: draft.endDate || null,
        eventId: draft.eventId || null,
        facebookText: text(draft.facebookText),
        instagramText: text(draft.instagramText),
      };
      if (item) {
        return apiFetch<AnnouncementItem>(`/api/announcements/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...shared, ...(canPublish ? { isPublic: draft.isPublic } : {}) }),
        });
      }
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      return apiFetch<AnnouncementItem>("/api/announcements", {
        method: "POST",
        body: JSON.stringify({ ...shared, timezone, ...(canPublish ? { isPublic: draft.isPublic } : {}) }),
      });
    },
    onSuccess: onSaved,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) return setProblem("Enter a title.");
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) return setProblem("The end date cannot be before the start date.");
    setProblem("");
    save.mutate();
  }

  const fillSocial = (key: "facebookText" | "instagramText") => set(key, `${draft.title.trim()}\n\n${draft.body.trim()}`.trim());

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-semibold">{item ? "Edit announcement" : "New announcement"}</h2>
      <label className="block text-sm font-medium">Title<input required maxLength={160} value={draft.title} onChange={(event) => set("title", event.target.value)} className={INPUT} /></label>
      <label className="block text-sm font-medium">Message
        <textarea rows={6} maxLength={ANNOUNCEMENT_BODY_MAX} value={draft.body} onChange={(event) => set("body", event.target.value)} className={TEXTAREA} />
        <span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">{draft.body.length} of {ANNOUNCEMENT_BODY_MAX} characters. Plain text only.</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Starts <span className="font-normal text-[var(--text-muted)]">optional</span><input type="date" value={draft.startDate} onChange={(event) => set("startDate", event.target.value)} className={INPUT} /></label>
        <label className="block text-sm font-medium">Ends <span className="font-normal text-[var(--text-muted)]">optional</span><input type="date" min={draft.startDate || undefined} value={draft.endDate} onChange={(event) => set("endDate", event.target.value)} className={INPUT} /></label>
      </div>
      <p className="-mt-2 text-xs text-[var(--text-muted)]">With no dates, a published announcement stays up until someone unpublishes it.</p>
      {events ? (
        <label className="block text-sm font-medium">Event <span className="font-normal text-[var(--text-muted)]">optional</span>
          <select value={draft.eventId} onChange={(event) => set("eventId", event.target.value)} className={INPUT}>
            <option value="">No event</option>
            {events.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
          </select>
        </label>
      ) : null}
      <PublicSwitch
        checked={draft.isPublic}
        disabled={!canPublish}
        onChange={(next) => set("isPublic", next)}
        note={canPublish ? "Shown on the public website while it is published and within its dates." : "Only people who can publish can change this."}
      />

      <fieldset className="space-y-4 border-t border-[var(--border-default)] pt-4">
        <legend className="text-sm font-semibold">Text to post on social media</legend>
        {([["facebookText", "Facebook"], ["instagramText", "Instagram"]] as const).map(([key, label]) => (
          <div key={key}>
            <label className="block text-sm font-medium">{label} <span className="font-normal text-[var(--text-muted)]">optional</span>
              <textarea rows={4} maxLength={ANNOUNCEMENT_BODY_MAX} value={draft[key]} onChange={(event) => set(key, event.target.value)} className={TEXTAREA} />
            </label>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <span className={`text-xs ${key === "instagramText" && draft[key].length > INSTAGRAM_CAPTION_WARNING ? "text-[var(--state-warning)]" : "text-[var(--text-muted)]"}`}>
                {draft[key].length} characters{key === "instagramText" && draft[key].length > INSTAGRAM_CAPTION_WARNING ? ". Instagram captions over 2,200 characters get cut off." : ""}
              </span>
              <span className="flex gap-2">
                <button type="button" onClick={() => fillSocial(key)} className={SECONDARY_BUTTON}>Fill from announcement</button>
                <CopyButton text={draft[key]} label={label} />
              </span>
            </div>
          </div>
        ))}
      </fieldset>

      {sendsBackToDraft ? <p role="status" className="rounded-md bg-[var(--state-warning-soft)] px-3 py-2 text-sm font-medium text-[var(--state-warning)]">Saving moves this back to Draft until someone who can publish approves it.</p> : null}
      {problem ? <p role="alert" className="text-sm text-[var(--state-danger)]">{problem}</p> : null}
      {save.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(save.error)}</p> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={save.isPending} className="min-h-11 flex-1 rounded-md bg-[var(--action-primary-bg)] px-4 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60">{save.isPending ? "Saving…" : item ? "Save" : "Save draft"}</button>
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>Close</button>
      </div>
    </form>
  );
}
