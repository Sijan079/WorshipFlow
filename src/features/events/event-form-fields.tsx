"use client";

import type { Dispatch, SetStateAction } from "react";
import { toggleWeekday, type NewEventForm, type RepeatChoice } from "./event-form";

const INPUT = "mt-1 min-h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]";
const WEEKDAYS = [
  { value: 0, short: "Sun", full: "Sunday" },
  { value: 1, short: "Mon", full: "Monday" },
  { value: 2, short: "Tue", full: "Tuesday" },
  { value: 3, short: "Wed", full: "Wednesday" },
  { value: 4, short: "Thu", full: "Thursday" },
  { value: 5, short: "Fri", full: "Friday" },
  { value: 6, short: "Sat", full: "Saturday" },
];
const REPEATS: Array<{ value: RepeatChoice; label: string }> = [
  { value: "NONE", label: "Doesn't repeat" },
  { value: "DAILY", label: "Every day" },
  { value: "WEEKLY", label: "Every week" },
];

// A large on/off switch. The label is part of the button, so the whole row is the target.
export function PublicSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-[var(--border-default)] px-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-60"
      >
        <span>Show on the church website</span>
        <span aria-hidden="true" className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 ${checked ? "justify-end bg-[var(--action-primary-bg)]" : "justify-start bg-[var(--surface-panel-strong)]"}`}>
          <span className="size-5 rounded-full bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]" />
        </span>
      </button>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Only the title, date, time and place are shown.</p>
    </div>
  );
}

// The fields of the New event form: when it happens, how often, and who can see it.
export default function EventFormFields({ form, setForm }: { form: NewEventForm; setForm: Dispatch<SetStateAction<NewEventForm>> }) {
  const set = <K extends keyof NewEventForm>(key: K, value: NewEventForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <>
      <label className="block text-sm font-medium">Event name<input required maxLength={160} value={form.title} onChange={(event) => set("title", event.target.value)} className={INPUT} /></label>
      <label className="block text-sm font-medium">Date<input required type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value, endDate: current.endDate < event.target.value ? event.target.value : current.endDate }))} className={INPUT} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Start<input required type="time" value={form.startTime} onChange={(event) => set("startTime", event.target.value)} className={INPUT} /></label>
        <label className="block text-sm font-medium">End<input required type="time" value={form.endTime} onChange={(event) => set("endTime", event.target.value)} className={INPUT} /></label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Repeat</legend>
        <div className="mt-1 grid grid-cols-3 gap-2" role="group" aria-label="Repeat">
          {REPEATS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={form.repeat === option.value}
              onClick={() => set("repeat", option.value)}
              className={`min-h-11 rounded-md border px-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${form.repeat === option.value ? "border-[var(--action-primary-bg)] bg-[var(--surface-panel-strong)] font-semibold" : "border-[var(--border-default)]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {form.repeat === "NONE" ? (
        <label className="block text-sm font-medium">Ends on <span className="font-normal text-[var(--text-muted)]">for an event over several days</span>
          <input type="date" min={form.date} value={form.endDate} onChange={(event) => set("endDate", event.target.value)} className={INPUT} />
        </label>
      ) : null}

      {form.repeat === "WEEKLY" ? (
        <fieldset>
          <legend className="text-sm font-medium">On these days</legend>
          <div className="mt-1 grid grid-cols-7 gap-1" role="group" aria-label="Days of the week">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                aria-pressed={form.weekdays.includes(day.value)}
                aria-label={day.full}
                onClick={() => set("weekdays", toggleWeekday(form.weekdays, day.value))}
                className={`min-h-11 rounded-md border text-sm focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${form.weekdays.includes(day.value) ? "border-[var(--action-primary-bg)] bg-[var(--action-primary-bg)] font-semibold text-[var(--action-primary-ink)]" : "border-[var(--border-default)]"}`}
              >
                {day.short}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {form.repeat !== "NONE" ? (
        <fieldset>
          <legend className="text-sm font-medium">Stops</legend>
          <div className="mt-1 grid grid-cols-2 gap-2" role="group" aria-label="When the repeat stops">
            {([["NEVER", "Never"], ["ON_DATE", "On a date"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={form.ends === value}
                onClick={() => set("ends", value)}
                className={`min-h-11 rounded-md border px-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${form.ends === value ? "border-[var(--action-primary-bg)] bg-[var(--surface-panel-strong)] font-semibold" : "border-[var(--border-default)]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {form.ends === "ON_DATE" ? (
            <label className="mt-2 block text-sm font-medium">Ends on<input type="date" min={form.date} value={form.until} onChange={(event) => set("until", event.target.value)} className={INPUT} /></label>
          ) : <p className="mt-1 text-xs text-[var(--text-muted)]">Dates are added automatically about four months ahead.</p>}
        </fieldset>
      ) : null}

      <label className="block text-sm font-medium">Venue <span className="font-normal text-[var(--text-muted)]">optional</span><input maxLength={200} value={form.venue} onChange={(event) => set("venue", event.target.value)} className={INPUT} /></label>
      <label className="block text-sm font-medium">Registration form link <span className="font-normal text-[var(--text-muted)]">optional</span><input type="url" value={form.registrationUrl} onChange={(event) => set("registrationUrl", event.target.value)} placeholder="https://" className={INPUT} /></label>
      <label className="block text-sm font-medium">Details <span className="font-normal text-[var(--text-muted)]">optional</span><textarea rows={3} maxLength={4000} value={form.description} onChange={(event) => set("description", event.target.value)} className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]" /></label>
      <PublicSwitch checked={form.isPublic} onChange={(next) => set("isPublic", next)} />
    </>
  );
}
