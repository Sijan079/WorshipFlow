"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { PublicSwitch } from "./event-form-fields";
import { fullDateLabel, timeLabel } from "./event-labels";
import { timeInputValue } from "./event-form";
import { localDateInZone, zonedLocalToUtc } from "./recurrence";
import { canMarkDone, canMarkNotDone, needsReview } from "./event-status";
import type { EventOccurrenceSummary } from "./event-types";

const INPUT = "mt-1 min-h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]";
const SECONDARY_BUTTON = "inline-flex min-h-11 items-center rounded-md border border-[var(--border-default)] px-4 text-sm font-semibold hover:bg-[var(--surface-panel-alt)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]";

type Scope = "THIS" | "FUTURE";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Could not save the change.";
}

// The panel for one date of an event. Anyone who can see events reads it; people with Edit can change the
// event, change this date's times, cancel the date, and bring a cancelled date back.
export default function EventDetails({ item, canEdit, canDelete }: { item: EventOccurrenceSummary; canEdit: boolean; canDelete: boolean }) {
  const [mode, setMode] = useState<"view" | "edit" | "cancel" | "cancelAll" | "done" | "delete">("view");
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["events"] });
  const cancelled = item.status === "CANCELLED";
  const done = item.doneAt !== null;
  const review = needsReview(item);

  const togglePublic = useMutation({
    mutationFn: (isPublic: boolean) => apiFetch(`/api/events/${item.eventId}`, { method: "PATCH", body: JSON.stringify({ isPublic }) }),
    onSuccess: refresh,
  });
  const markNotDone = useMutation({
    mutationFn: () => apiFetch(`/api/events/occurrences/${item.id}`, { method: "PATCH", body: JSON.stringify({ done: false }) }),
    onSuccess: refresh,
  });
  const restore = useMutation({
    mutationFn: () => apiFetch(`/api/events/occurrences/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: "SCHEDULED", changeNote: null }) }),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-[var(--text-muted)]">{fullDateLabel(item.localDate)}</p>
          {item.edited ? <span className="rounded bg-[var(--surface-panel-strong)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">Changed</span> : null}
          {cancelled ? <span className="rounded bg-[var(--state-warning-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--state-warning)]">Cancelled</span> : null}
          {done ? <span className="rounded bg-[var(--surface-panel-strong)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">Done</span> : null}
          {review ? <span className="rounded bg-[var(--state-warning-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--state-warning)]">Needs review</span> : null}
        </div>
        <h2 className={`mt-2 text-xl font-semibold ${cancelled ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>{item.title}</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {timeLabel(item.startsAt, item.timezone)}–{timeLabel(item.endsAt, item.timezone)}
          {item.venue ? ` · ${item.venue}` : ""}
          {item.repeats ? " · Repeats" : ""}
        </p>
        {item.changeNote ? <p className="mt-2 text-sm text-[var(--text-secondary)]">Note: {item.changeNote}</p> : null}
        {item.description ? <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{item.description}</p> : null}
        {item.edited ? <p className="mt-2 text-xs text-[var(--text-muted)]">This date was changed on its own, so series changes skip it.</p> : null}
      </div>
      {item.conflict ? <p role="status" className="rounded-md bg-[var(--state-warning-soft)] px-3 py-2 text-sm font-medium text-[var(--state-warning)]">Schedule overlap to review. This event can still proceed.</p> : null}

      {canEdit ? (
        <div>
          <PublicSwitch checked={item.isPublic} disabled={togglePublic.isPending} onChange={(next) => togglePublic.mutate(next)} />
          {togglePublic.isError ? <p role="alert" className="mt-1 text-sm text-[var(--state-danger)]">{errorText(togglePublic.error)}</p> : null}
        </div>
      ) : <p className="text-sm text-[var(--text-secondary)]">{item.isPublic ? "Shown on the church website." : "Not shown on the church website."}</p>}

      {(canEdit || canDelete) && mode === "view" ? (
        <div className="flex flex-wrap gap-3">
          {canEdit ? <button type="button" onClick={() => setMode("edit")} className={SECONDARY_BUTTON}>Edit</button> : null}
          {canEdit && cancelled ? (
            <button type="button" onClick={() => restore.mutate()} disabled={restore.isPending} className={SECONDARY_BUTTON}>{restore.isPending ? "Restoring…" : "Restore"}</button>
          ) : null}
          {canEdit && canMarkDone(item) ? <button type="button" onClick={() => setMode("done")} className={SECONDARY_BUTTON}>Mark done</button> : null}
          {canEdit && canMarkNotDone(item) ? <button type="button" onClick={() => markNotDone.mutate()} disabled={markNotDone.isPending} className={SECONDARY_BUTTON}>{markNotDone.isPending ? "Saving…" : "Mark not done"}</button> : null}
          {canEdit && !cancelled && !done ? (
            <button type="button" onClick={() => setMode("cancel")} className={SECONDARY_BUTTON}>Cancel this date</button>
          ) : null}
          {canEdit && item.repeats && item.activeDates > 0 ? <button type="button" onClick={() => setMode("cancelAll")} className={SECONDARY_BUTTON}>Cancel all dates</button> : null}
          {canDelete && item.activeDates === 0 ? <button type="button" onClick={() => setMode("delete")} className={SECONDARY_BUTTON}>Delete event</button> : null}
        </div>
      ) : null}
      {canDelete && item.activeDates > 0 && mode === "view" ? <p className="text-xs text-[var(--text-muted)]">To delete this event, cancel it first.</p> : null}
      {markNotDone.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(markNotDone.error)}</p> : null}
      {restore.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(restore.error)}</p> : null}

      {canEdit && mode === "edit" ? <EditForm item={item} onDone={() => { setMode("view"); void refresh(); }} onClose={() => setMode("view")} /> : null}
      {canEdit && mode === "cancel" ? <CancelForm item={item} onDone={() => { setMode("view"); void refresh(); }} onClose={() => setMode("view")} /> : null}

      {canEdit && mode === "done" ? <DoneForm item={item} onDone={() => { setMode("view"); void refresh(); }} onClose={() => setMode("view")} /> : null}
      {canEdit && mode === "cancelAll" ? <CancelAllForm item={item} onDone={() => { setMode("view"); void refresh(); }} onClose={() => setMode("view")} /> : null}
      {canDelete && mode === "delete" ? <DeleteForm item={item} onDone={() => { setMode("view"); void refresh(); }} onClose={() => setMode("view")} /> : null}

      <div className="border-t border-[var(--border-default)] pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Registration</h3>
        {item.registrationUrl ? (
          <a href={item.registrationUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[var(--text-accent)] underline underline-offset-2">
            Open external form <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        ) : <p className="mt-2 text-sm text-[var(--text-muted)]">No registration link. People can attend without signing up.</p>}
        {item.responseCount !== null ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.responseCount} responses · {item.yesCount ?? 0} yes · {item.noCount ?? 0} no</p> : null}
      </div>
      <div className="border-t border-[var(--border-default)] pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">After the event</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{item.attendanceCount === null ? "Attendance has not been recorded." : `${item.attendanceCount} attended`}</p>
      </div>
    </div>
  );
}

// Name, place and details belong to the whole event. The times can change for this date only, or for all
// future dates of a repeating event.
function EditForm({ item, onDone, onClose }: { item: EventOccurrenceSummary; onDone: () => void; onClose: () => void }) {
  const startNow = timeInputValue(item.startsAt, item.timezone);
  const endNow = timeInputValue(item.endsAt, item.timezone);
  const [title, setTitle] = useState(item.title);
  const [venue, setVenue] = useState(item.venue ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [startTime, setStartTime] = useState(startNow);
  const [endTime, setEndTime] = useState(endNow);
  const [scope, setScope] = useState<Scope>("THIS");
  const timesChanged = startTime !== startNow || endTime !== endNow;

  const save = useMutation({
    mutationFn: async () => {
      const eventChanges = {
        ...(title.trim() !== item.title ? { title: title.trim() } : {}),
        ...(venue.trim() !== (item.venue ?? "") ? { venue: venue.trim() || null } : {}),
        ...(description.trim() !== (item.description ?? "") ? { description: description.trim() || null } : {}),
      };
      const futureTimes = timesChanged && item.repeats && scope === "FUTURE";
      if (Object.keys(eventChanges).length > 0 || futureTimes) {
        await apiFetch(`/api/events/${item.eventId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...eventChanges, ...(futureTimes ? { startLocal: startTime, endLocal: endTime } : {}) }),
        });
      }
      if (timesChanged && !futureTimes) {
        const lastDay = localDateInZone(new Date(item.endsAt), item.timezone);
        await apiFetch(`/api/events/occurrences/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            startsAt: zonedLocalToUtc(item.localDate, startTime, item.timezone).toISOString(),
            endsAt: zonedLocalToUtc(lastDay, endTime, item.timezone).toISOString(),
          }),
        });
      }
    },
    onSuccess: onDone,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-[var(--border-default)] pt-4">
      <h3 className="text-lg font-semibold">Edit event</h3>
      <label className="block text-sm font-medium">Event name<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className={INPUT} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Start<input required type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={INPUT} /></label>
        <label className="block text-sm font-medium">End<input required type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={INPUT} /></label>
      </div>
      {item.repeats && timesChanged ? (
        <fieldset>
          <legend className="text-sm font-medium">Change the times for</legend>
          <div className="mt-1 grid grid-cols-2 gap-2" role="group" aria-label="Which dates get the new times">
            {([["THIS", "This date only"], ["FUTURE", "All future dates"]] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)} className={`min-h-11 rounded-md border px-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${scope === value ? "border-[var(--action-primary-bg)] bg-[var(--surface-panel-strong)] font-semibold" : "border-[var(--border-default)]"}`}>{label}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Dates you changed on their own are left as they are.</p>
        </fieldset>
      ) : null}
      <label className="block text-sm font-medium">Venue <span className="font-normal text-[var(--text-muted)]">optional</span><input maxLength={200} value={venue} onChange={(event) => setVenue(event.target.value)} className={INPUT} /></label>
      <label className="block text-sm font-medium">Details <span className="font-normal text-[var(--text-muted)]">optional</span><textarea rows={3} maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]" /></label>
      {item.repeats ? <p className="text-xs text-[var(--text-muted)]">Name, place and details apply to every date of this event.</p> : null}
      {save.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(save.error)}</p> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={save.isPending} className="min-h-11 flex-1 rounded-md bg-[var(--action-primary-bg)] px-4 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60">{save.isPending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>Close</button>
      </div>
    </form>
  );
}

// Cancelling keeps the date on the calendar, greyed out, with an optional note for the people who look.
function CancelForm({ item, onDone, onClose }: { item: EventOccurrenceSummary; onDone: () => void; onClose: () => void }) {
  const [note, setNote] = useState("");
  const cancel = useMutation({
    mutationFn: () => apiFetch(`/api/events/occurrences/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED", changeNote: note.trim() || null }) }),
    onSuccess: onDone,
  });
  return (
    <div className="space-y-4 border-t border-[var(--border-default)] pt-4">
      <h3 className="text-lg font-semibold">Cancel this date?</h3>
      <p className="text-sm text-[var(--text-secondary)]">{fullDateLabel(item.localDate)} stays on the calendar, marked Cancelled. Other dates are not affected. You can bring it back with Restore.</p>
      <label className="block text-sm font-medium">Note <span className="font-normal text-[var(--text-muted)]">optional</span><input maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className={INPUT} /></label>
      {cancel.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(cancel.error)}</p> : null}
      <div className="flex gap-3">
        <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending} className="ui-btn-danger-solid pressable min-h-11 flex-1 px-4 text-sm font-semibold disabled:opacity-60">{cancel.isPending ? "Cancelling…" : "Cancel this date"}</button>
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>Keep it</button>
      </div>
    </div>
  );
}

// Deleting removes the whole event and every one of its dates. The question says how many, and Keep it is
// the first choice, so a stray tap does not remove anything.
function DeleteForm({ item, onDone, onClose }: { item: EventOccurrenceSummary; onDone: () => void; onClose: () => void }) {
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/events/${item.eventId}`, { method: "DELETE" }),
    onSuccess: onDone,
  });
  const dates = item.dateCount === 1 ? "its date" : `all ${item.dateCount} of its dates`;
  return (
    <div className="space-y-4 border-t border-[var(--border-default)] pt-4">
      <h3 className="text-lg font-semibold">Delete this event?</h3>
      <p className="text-sm text-[var(--text-secondary)]">
        {item.title} and {dates} will be removed for good. This cannot be undone.{item.repeats ? " To drop only this one date, use Cancel this date instead." : ""}
      </p>
      {remove.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(remove.error)}</p> : null}
      <div className="flex gap-3">
        <button type="button" autoFocus onClick={onClose} className={SECONDARY_BUTTON}>Keep it</button>
        <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="ui-btn-danger-solid pressable min-h-11 flex-1 px-4 text-sm font-semibold disabled:opacity-60">{remove.isPending ? "Deleting…" : "Delete event"}</button>
      </div>
    </div>
  );
}

// Marking done records that the event took place. The attendance number is optional and can be added later.
function DoneForm({ item, onDone, onClose }: { item: EventOccurrenceSummary; onDone: () => void; onClose: () => void }) {
  const [count, setCount] = useState(item.attendanceCount === null ? "" : String(item.attendanceCount));
  const invalid = count.trim() !== "" && !/^[0-9]{1,6}$/.test(count.trim());
  const mark = useMutation({
    mutationFn: () => apiFetch(`/api/events/occurrences/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ done: true, ...(count.trim() ? { attendanceCount: Number(count.trim()) } : {}) }),
    }),
    onSuccess: onDone,
  });
  return (
    <div className="space-y-4 border-t border-[var(--border-default)] pt-4">
      <h3 className="text-lg font-semibold">Mark this event done</h3>
      <label className="block text-sm font-medium">How many attended <span className="font-normal text-[var(--text-muted)]">optional</span>
        <input inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} className={INPUT} />
      </label>
      {invalid ? <p role="alert" className="text-sm text-[var(--state-danger)]">Enter a whole number, like 120, or leave it empty.</p> : null}
      {mark.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(mark.error)}</p> : null}
      <div className="flex gap-3">
        <button type="button" onClick={() => mark.mutate()} disabled={mark.isPending || invalid} className="min-h-11 flex-1 rounded-md bg-[var(--action-primary-bg)] px-4 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60">{mark.isPending ? "Saving…" : "Mark done"}</button>
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>Close</button>
      </div>
    </div>
  );
}

// Cancels every date that is still scheduled. A repeating event can only be deleted after this.
function CancelAllForm({ item, onDone, onClose }: { item: EventOccurrenceSummary; onDone: () => void; onClose: () => void }) {
  const cancelAll = useMutation({
    mutationFn: () => apiFetch(`/api/events/${item.eventId}`, { method: "PATCH", body: JSON.stringify({ cancelAll: true }) }),
    onSuccess: onDone,
  });
  return (
    <div className="space-y-4 border-t border-[var(--border-default)] pt-4">
      <h3 className="text-lg font-semibold">Cancel all dates?</h3>
      <p className="text-sm text-[var(--text-secondary)]">{item.activeDates === 1 ? "The 1 date that is still scheduled" : `The ${item.activeDates} dates that are still scheduled`} will be marked Cancelled, and the event will not add new dates. They stay on the calendar until you delete the event.</p>
      {cancelAll.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(cancelAll.error)}</p> : null}
      <div className="flex gap-3">
        <button type="button" autoFocus onClick={onClose} className={SECONDARY_BUTTON}>Keep it</button>
        <button type="button" onClick={() => cancelAll.mutate()} disabled={cancelAll.isPending} className="ui-btn-danger-solid pressable min-h-11 flex-1 px-4 text-sm font-semibold disabled:opacity-60">{cancelAll.isPending ? "Cancelling…" : "Cancel all dates"}</button>
      </div>
    </div>
  );
}
