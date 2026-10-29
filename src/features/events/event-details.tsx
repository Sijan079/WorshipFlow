"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { CalendarX, Check, ExternalLink, Loader2, Megaphone, Pencil, RotateCcw, Trash2, Undo2, Users, X, type LucideIcon } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProductionDatePicker } from "@/components/ui/production-date-picker";
import { EventColorPicker } from "./event-color-picker";
import { eventColorTokens } from "./event-colors";
import { ProductionTimePicker } from "@/components/ui/production-time-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import { PublicSwitch } from "./event-form-fields";
import { fullDateLabel, timeLabel } from "./event-labels";
import { buildOccurrenceTimes, occurrenceProblem, timeInputValue } from "./event-form";
import { localDateInZone } from "./recurrence";
import { attendanceShown, canMarkDone, canMarkNotDone, canRecordAttendance, cancelChoices, needsReview, registrationShown } from "./event-status";
import type { EventOccurrenceSummary } from "./event-types";

const INPUT = `${TEXT_FIELD_CLASS} min-h-11`;
const LABEL = FIELD_LABEL_CLASS;
// "Keep it" is the quiet way out of a confirmation: plain text, no fill, no border, so the red button is the only loud thing.
const KEEP_BUTTON = "inline-flex h-11 items-center rounded-md px-4 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]";
const CANCEL_BUTTON = "ui-btn-cancel pressable inline-flex items-center px-4 text-sm font-semibold";
const PRIMARY_BUTTON = "ui-btn-primary pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";
const DANGER_BUTTON = "ui-btn-danger-solid pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";

// A section of the card that opens and closes smoothly: it grows from nothing and fades in, and on the way
// out it fades and folds away before it is removed, so nothing below it jumps. The AnimatePresence sits
// outside the condition, which is what lets the section leave gracefully. The top margin is animated too,
// because the card spaces its sections with a margin that would otherwise vanish in one step (1.25rem is
// the card's space-y-5). Clipping is only on while it moves, so focus outlines are not cut off at rest.
function Collapse({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="section"
          initial={{ opacity: 0, height: 0, marginTop: 0, overflow: "hidden" }}
          animate={{ opacity: 1, height: "auto", marginTop: 20, transitionEnd: { overflow: "visible" } }}
          exit={{ opacity: 0, height: 0, marginTop: 0, overflow: "hidden" }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// A question that needs a clear yes or no, asked in a modal so the card behind it stays as it was. The X and
// Escape both mean "keep it".
function ConfirmModal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md space-y-4">
        <button type="button" onClick={onClose} aria-label="Close" title="Close" className="ui-modal-close absolute right-3 top-3"><X aria-hidden="true" className="h-4 w-4" /></button>
        <DialogTitle className="pr-12 text-xl font-semibold text-[var(--text-primary)]">{title}</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-[var(--text-secondary)]">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// An action shown as an icon alone: no border, no fill, muted until hovered, 44px. The words live in the
// accessible name and the tooltip, so nothing is lost for a screen reader or a person who hovers.
function iconActionClass(danger: boolean) {
  return `inline-flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-60 ${danger ? "text-[var(--text-secondary)] hover:text-[var(--state-danger)]" : "text-[var(--text-secondary)] hover:text-[var(--text-accent)]"}`;
}

function IconAction({ icon: Icon, label, onClick, busy = false, danger = false }: { icon: LucideIcon; label: string; onClick: () => void; busy?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} aria-label={label} title={label} className={iconActionClass(danger)}>
      {busy ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Icon aria-hidden="true" className="h-5 w-5" />}
    </button>
  );
}

// The one Cancel icon, for an event that can be cancelled two ways. It asks which, in a small menu, and the
// choice then opens its own confirmation.
function CancelMenu({ onChoose }: { onChoose: (choice: "this" | "all") => void }) {
  const item = "ui-action-menu-item ui-action-menu-item-danger min-h-10 px-2 text-sm";
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Cancel" title="Cancel" className={iconActionClass(true)}><CalendarX aria-hidden="true" className="h-5 w-5" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="workspace-content-light ui-action-menu-content w-48">
        <DropdownMenuItem onSelect={() => onChoose("this")} className={item}>Cancel this date</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChoose("all")} className={item}>Cancel all dates</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// A status shown as a coloured dot and a word, the way the Services list shows status.
function StatusMark({ label, tone }: { label: string; tone: "warning" | "neutral" }) {
  const color = tone === "warning" ? "var(--state-warning)" : "var(--text-secondary)";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone === "warning" ? color : "var(--state-idle)" }} />
      {label}
    </span>
  );
}

type Scope = "THIS" | "FUTURE";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Could not save the change.";
}

// The panel for one date of an event. Anyone who can see events reads it; people with Edit can change the
// event, change this date's times, cancel the date, and bring a cancelled date back.
export default function EventDetails({ item, canEdit, canDelete, canAnnounce }: { item: EventOccurrenceSummary; canEdit: boolean; canDelete: boolean; canAnnounce: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "attendance" | "cancel" | "cancelAll" | "done" | "delete">("view");
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["events"] });
  const cancelled = item.status === "CANCELLED";
  const done = item.doneAt !== null;
  const review = needsReview(item);
  // The icons stay up behind a cancel or delete modal; only the inline Edit and Mark done forms replace them.
  const cancelOptions = cancelChoices({ canEdit, cancelled, done, repeats: item.repeats, activeDates: item.activeDates });
  const actionsVisible = mode === "view" || mode === "cancel" || mode === "cancelAll" || mode === "delete";

  const togglePublic = useMutation({
    mutationFn: (isPublic: boolean) => apiFetch(`/api/events/${item.eventId}`, { method: "PATCH", body: JSON.stringify({ isPublic }) }),
    onSuccess: refresh,
  });
  // Starts a draft announcement for this event, with the date, time and place filled in, and opens it to edit.
  const announce = useMutation({
    mutationFn: () => apiFetch<{ id: string }>("/api/announcements", {
      method: "POST",
      body: JSON.stringify({
        title: item.title,
        body: [`${fullDateLabel(item.localDate)}, ${timeLabel(item.startsAt, item.timezone)} to ${timeLabel(item.endsAt, item.timezone)}`, item.venue ? `at ${item.venue}` : ""].filter(Boolean).join(" ") + ".",
        eventId: item.eventId,
        timezone: item.timezone,
      }),
    }),
    onSuccess: (created) => {
      const slug = window.location.pathname.match(/^\/w\/([^/]+)/)?.[1];
      router.push(slug ? `/w/${slug}/announcements?post=${created.id}` : "/");
    },
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
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cancelled ? "var(--text-muted)" : eventColorTokens(item.color).dot }} />
          <p className="text-xs font-semibold text-[var(--text-muted)]">{fullDateLabel(item.localDate)}</p>
          {item.edited ? <StatusMark label="Changed" tone="neutral" /> : null}
          {cancelled ? <StatusMark label="Cancelled" tone="warning" /> : null}
          {done ? <StatusMark label="Done" tone="neutral" /> : null}
          {review ? <StatusMark label="Needs review" tone="warning" /> : null}
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
      {item.conflict ? <p role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--state-warning)]"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--state-warning)]" />Schedule overlap to review. This event can still proceed.</p> : null}

      <Collapse show={(canEdit || canDelete || canAnnounce) && actionsVisible}>
        <div className="-mx-2 flex flex-wrap items-center gap-1">
          {canEdit ? <IconAction icon={Pencil} label="Edit" onClick={() => setMode("edit")} /> : null}
          {canEdit && canRecordAttendance(item) ? <IconAction icon={Users} label={item.attendanceCount === null ? "Record attendance" : "Edit attendance"} onClick={() => setMode("attendance")} /> : null}
          {cancelOptions.length === 2 ? <CancelMenu onChoose={(choice) => setMode(choice === "this" ? "cancel" : "cancelAll")} /> : null}
          {cancelOptions.length === 1 ? <IconAction icon={CalendarX} label={cancelOptions[0] === "this" ? "Cancel this date" : "Cancel all dates"} onClick={() => setMode(cancelOptions[0] === "this" ? "cancel" : "cancelAll")} danger /> : null}
          {canAnnounce && !cancelled ? <IconAction icon={Megaphone} label="Announce this event" onClick={() => announce.mutate()} busy={announce.isPending} /> : null}
          {canEdit && cancelled ? <IconAction icon={RotateCcw} label="Restore" onClick={() => restore.mutate()} busy={restore.isPending} /> : null}
          {canEdit && canMarkDone(item) ? <IconAction icon={Check} label="Mark done" onClick={() => setMode("done")} /> : null}
          {canEdit && canMarkNotDone(item) ? <IconAction icon={Undo2} label="Mark not done" onClick={() => markNotDone.mutate()} busy={markNotDone.isPending} /> : null}
          {canDelete && item.activeDates === 0 ? <IconAction icon={Trash2} label="Delete event" onClick={() => setMode("delete")} danger /> : null}
        </div>
      </Collapse>
      {announce.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(announce.error)}</p> : null}
      {markNotDone.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(markNotDone.error)}</p> : null}
      {restore.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(restore.error)}</p> : null}

      <Collapse show={canEdit && mode === "edit"}><EditForm item={item} onDone={() => { setMode("view"); void refresh(); }} onClose={() => setMode("view")} /></Collapse>
      {canEdit && mode === "cancel" ? <CancelForm item={item} onDone={() => { setMode("view"); void refresh(); }} onClose={() => setMode("view")} /> : null}

      <Collapse show={canEdit && mode === "attendance"}><AttendanceForm item={item} onDone={() => { setMode("view"); void refresh(); }} onClose={() => setMode("view")} /></Collapse>
      <Collapse show={canEdit && mode === "done"}><DoneForm item={item} onDone={() => { setMode("view"); void refresh(); }} onClose={() => setMode("view")} /></Collapse>
      {canEdit && mode === "cancelAll" ? <CancelAllForm item={item} onDone={() => { setMode("view"); void refresh(); }} onClose={() => setMode("view")} /> : null}
      {canDelete && mode === "delete" ? <DeleteForm item={item} onDone={() => { setMode("view"); void refresh(); }} onClose={() => setMode("view")} /> : null}

      {canEdit ? (
        <div>
          <PublicSwitch checked={item.isPublic} disabled={togglePublic.isPending} onChange={(next) => togglePublic.mutate(next)} />
          {togglePublic.isError ? <p role="alert" className="mt-1 text-sm text-[var(--state-danger)]">{errorText(togglePublic.error)}</p> : null}
        </div>
      ) : <p className="text-sm text-[var(--text-secondary)]">{item.isPublic ? "Shown on the church website." : "Not shown on the church website."}</p>}

      {registrationShown(item) ? (
        <div className="border-t border-[var(--rule-default)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Registration</h3>
          {item.registrationUrl ? (
            <a href={item.registrationUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[var(--text-accent)] underline underline-offset-2">
              Open external form <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          ) : null}
          {item.responseCount !== null ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.responseCount} responses · {item.yesCount ?? 0} yes · {item.noCount ?? 0} no</p> : null}
        </div>
      ) : null}
      {attendanceShown(item) ? (
        <div className="border-t border-[var(--rule-default)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">After the event</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.attendanceCount} attended</p>
        </div>
      ) : null}
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
  const [color, setColor] = useState(item.color);
  const dateNow = item.localDate;
  const endDateNow = localDateInZone(new Date(item.endsAt), item.timezone);
  const [date, setDate] = useState(dateNow);
  const [endDate, setEndDate] = useState(endDateNow);
  const [startTime, setStartTime] = useState(startNow);
  const [endTime, setEndTime] = useState(endNow);
  const [scope, setScope] = useState<Scope>("THIS");
  const timesChanged = startTime !== startNow || endTime !== endNow;
  const datesChanged = date !== dateNow || endDate !== endDateNow;
  const problem = occurrenceProblem({ date, endDate, startTime, endTime });

  const save = useMutation({
    mutationFn: async () => {
      const eventChanges = {
        ...(title.trim() !== item.title ? { title: title.trim() } : {}),
        ...(venue.trim() !== (item.venue ?? "") ? { venue: venue.trim() || null } : {}),
        ...(color !== item.color ? { color } : {}),
        ...(description.trim() !== (item.description ?? "") ? { description: description.trim() || null } : {}),
      };
      // Moving a date, or changing how long it lasts, only ever applies to this date.
      const futureTimes = timesChanged && !datesChanged && item.repeats && scope === "FUTURE";
      if (Object.keys(eventChanges).length > 0 || futureTimes) {
        await apiFetch(`/api/events/${item.eventId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...eventChanges, ...(futureTimes ? { startLocal: startTime, endLocal: endTime } : {}) }),
        });
      }
      if ((timesChanged || datesChanged) && !futureTimes) {
        await apiFetch(`/api/events/occurrences/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify(buildOccurrenceTimes({ date, endDate, startTime, endTime }, item.timezone)),
        });
      }
    },
    onSuccess: onDone,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || problem) return;
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-[var(--rule-default)] pt-4">
      <h3 className="text-lg font-semibold">Edit event</h3>
      <label className={LABEL}>Event name<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className={INPUT} /></label>
      <ProductionDatePicker label="Date" labelClassName={LABEL} value={date} onValueChange={(value) => { setDate(value); if (endDate < value) setEndDate(value); }} />
      {item.repeats ? null : (
        <ProductionDatePicker label="Ends on (for an event over several days)" labelClassName={LABEL} minValue={date} value={endDate} onValueChange={setEndDate} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <ProductionTimePicker label="Start" labelClassName={LABEL} value={startTime} onValueChange={setStartTime} />
        <ProductionTimePicker label="End" labelClassName={LABEL} value={endTime} onValueChange={setEndTime} />
      </div>
      {item.repeats && timesChanged && !datesChanged ? (
        <fieldset>
          <legend className="text-sm text-[var(--text-secondary)]">Change the times for</legend>
          <div className="mt-1 grid grid-cols-2 gap-2" role="group" aria-label="Which dates get the new times">
            {([["THIS", "This date only"], ["FUTURE", "All future dates"]] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)} className={`min-h-11 rounded-md border px-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${scope === value ? "border-[var(--action-primary-bg)] bg-[var(--surface-panel-strong)] font-semibold" : "border-[var(--border-default)]"}`}>{label}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Dates you changed on their own are left as they are.</p>
        </fieldset>
      ) : null}
      <label className={LABEL}>Venue <span className="font-normal text-[var(--text-muted)]">optional</span><input maxLength={200} value={venue} onChange={(event) => setVenue(event.target.value)} className={INPUT} /></label>
      <label className={LABEL}>Details <span className="font-normal text-[var(--text-muted)]">optional</span><textarea rows={3} maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} className={`${TEXT_FIELD_CLASS} mt-1`} /></label>
      <EventColorPicker value={color} onChange={setColor} />
      {problem ? <p role="alert" className="text-sm text-[var(--state-danger)]">{problem}</p> : null}
      {save.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(save.error)}</p> : null}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className={CANCEL_BUTTON}>Cancel</button>
        <button type="submit" disabled={save.isPending || Boolean(problem)} className={PRIMARY_BUTTON}>{save.isPending ? "Saving…" : "Save"}</button>
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
    <ConfirmModal title="Cancel This Date?" onClose={onClose} description={`${fullDateLabel(item.localDate)} stays on the calendar, marked Cancelled. Other dates are not affected. You can bring it back with Restore.`}>
      <label className={LABEL}>Note <span className="font-normal text-[var(--text-muted)]">(Optional)</span><input maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className={INPUT} /></label>
      {cancel.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(cancel.error)}</p> : null}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" autoFocus onClick={onClose} className={KEEP_BUTTON}>Keep it</button>
        <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending} className={DANGER_BUTTON}>{cancel.isPending ? "Cancelling…" : "Yes, I am sure"}</button>
      </div>
    </ConfirmModal>
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
    <ConfirmModal title="Delete This Event?" onClose={onClose} description={`${item.title} and ${dates} will be removed for good. This cannot be undone.${item.repeats ? " To drop only this one date, use Cancel this date instead." : ""}`}>
      {remove.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(remove.error)}</p> : null}
      <div className="flex justify-end gap-3">
        <button type="button" autoFocus onClick={onClose} className={KEEP_BUTTON}>Keep it</button>
        <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className={DANGER_BUTTON}>{remove.isPending ? "Deleting…" : "Yes, I am sure"}</button>
      </div>
    </ConfirmModal>
  );
}

// The headcount for one date, set or changed after the event. Empty clears it. It works for any date that has
// started, including the dates of a repeating event, and it is not counted as changing the date.
function AttendanceForm({ item, onDone, onClose }: { item: EventOccurrenceSummary; onDone: () => void; onClose: () => void }) {
  const [count, setCount] = useState(item.attendanceCount === null ? "" : String(item.attendanceCount));
  const invalid = count.trim() !== "" && !/^[0-9]{1,6}$/.test(count.trim());
  const save = useMutation({
    mutationFn: () => apiFetch(`/api/events/occurrences/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ attendanceCount: count.trim() === "" ? null : Number(count.trim()) }),
    }),
    onSuccess: onDone,
  });
  return (
    <form onSubmit={(event) => { event.preventDefault(); if (!invalid) save.mutate(); }} className="space-y-4 border-t border-[var(--rule-default)] pt-4">
      <h3 className="text-lg font-semibold">Attendance</h3>
      <label className={LABEL}>How many attended <span className="font-normal text-[var(--text-muted)]">(Optional)</span>
        <input inputMode="numeric" autoFocus value={count} onChange={(event) => setCount(event.target.value)} className={INPUT} />
      </label>
      {invalid ? <p role="alert" className="text-sm text-[var(--state-danger)]">Enter a whole number, like 120, or leave it empty.</p> : null}
      {save.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(save.error)}</p> : null}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className={CANCEL_BUTTON}>Cancel</button>
        <button type="submit" disabled={save.isPending || invalid} className={PRIMARY_BUTTON}>{save.isPending ? "Saving…" : "Save"}</button>
      </div>
    </form>
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
    <div className="space-y-4 border-t border-[var(--rule-default)] pt-4">
      <h3 className="text-lg font-semibold">Mark this event done</h3>
      <label className={LABEL}>How many attended <span className="font-normal text-[var(--text-muted)]">optional</span>
        <input inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} className={INPUT} />
      </label>
      {invalid ? <p role="alert" className="text-sm text-[var(--state-danger)]">Enter a whole number, like 120, or leave it empty.</p> : null}
      {mark.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(mark.error)}</p> : null}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className={CANCEL_BUTTON}>Cancel</button>
        <button type="button" onClick={() => mark.mutate()} disabled={mark.isPending || invalid} className={PRIMARY_BUTTON}>{mark.isPending ? "Saving…" : "Mark done"}</button>
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
    <ConfirmModal title="Cancel All Dates?" onClose={onClose} description={`${item.activeDates === 1 ? "The 1 date that is still scheduled" : `The ${item.activeDates} dates that are still scheduled`} will be marked Cancelled, and the event will not add new dates. They stay on the calendar until you delete the event.`}>
      {cancelAll.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{errorText(cancelAll.error)}</p> : null}
      <div className="flex justify-end gap-3">
        <button type="button" autoFocus onClick={onClose} className={KEEP_BUTTON}>Keep it</button>
        <button type="button" onClick={() => cancelAll.mutate()} disabled={cancelAll.isPending} className={DANGER_BUTTON}>{cancelAll.isPending ? "Cancelling…" : "Yes, I am sure"}</button>
      </div>
    </ConfirmModal>
  );
}
