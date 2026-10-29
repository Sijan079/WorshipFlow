"use client";

import type { Dispatch, SetStateAction } from "react";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import { ProductionDatePicker } from "@/components/ui/production-date-picker";
import { ProductionTimePicker } from "@/components/ui/production-time-picker";
import { EventColorPicker } from "./event-color-picker";
import { changeDate, toggleWeekday, type NewEventForm, type RepeatChoice } from "./event-form";

const INPUT = `${TEXT_FIELD_CLASS} mt-1 min-h-11`;
const LABEL = FIELD_LABEL_CLASS;
const LEGEND = "text-sm text-[var(--text-secondary)]";
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
  { value: "NONE", label: "Never" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
];

// A large on/off switch. The label is part of the button, so the whole row is the target.
export function PublicSwitch({ checked, onChange, disabled, note }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; note?: string }) {
  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-0 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-60"
      >
        <span>Show on the church website</span>
        <span aria-hidden="true" className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 ${checked ? "justify-end bg-[var(--action-primary-bg)]" : "justify-start bg-[var(--surface-panel-strong)]"}`}>
          <span className="size-5 rounded-full bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]" />
        </span>
      </button>
      {note ? <p className="mt-1 text-xs text-[var(--text-muted)]">{note}</p> : null}
    </div>
  );
}

// The fields of the New event form: when it happens, how often, and who can see it.
export default function EventFormFields({ form, setForm }: { form: NewEventForm; setForm: Dispatch<SetStateAction<NewEventForm>> }) {
  const set = <K extends keyof NewEventForm>(key: K, value: NewEventForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <>
      <label className={LABEL}>Event name<input required maxLength={160} value={form.title} onChange={(event) => set("title", event.target.value)} className={INPUT} /></label>
      <ProductionDatePicker label="Date" labelClassName={LABEL} value={form.date} onValueChange={(value) => setForm((current) => changeDate(current, value))} />
      <div className="grid grid-cols-2 gap-3">
        <ProductionTimePicker label="Start" labelClassName={LABEL} value={form.startTime} onValueChange={(value) => set("startTime", value)} />
        <ProductionTimePicker label="End" labelClassName={LABEL} value={form.endTime} onValueChange={(value) => set("endTime", value)} />
      </div>

      <fieldset>
        <legend className={LEGEND}>Repeat</legend>
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
        <ProductionDatePicker label="Ends on (for an event over several days)" labelClassName={LABEL} minValue={form.date} value={form.endDate} onValueChange={(value) => set("endDate", value)} />
      ) : null}

      {form.repeat === "WEEKLY" ? (
        <fieldset>
          <legend className={LEGEND}>On these days</legend>
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
          <legend className={LEGEND}>Stops</legend>
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
            <ProductionDatePicker className="mt-2" label="Ends on" labelClassName={LABEL} minValue={form.date} value={form.until} onValueChange={(value) => set("until", value)} />
          ) : null}
        </fieldset>
      ) : null}

      <label className={LABEL}>Venue <span className="font-normal text-[var(--text-muted)]">optional</span><input maxLength={200} value={form.venue} onChange={(event) => set("venue", event.target.value)} className={INPUT} /></label>
      <label className={LABEL}>Registration form link <span className="font-normal text-[var(--text-muted)]">optional</span><input type="url" value={form.registrationUrl} onChange={(event) => set("registrationUrl", event.target.value)} placeholder="https://" className={INPUT} /></label>
      <label className={LABEL}>Details <span className="font-normal text-[var(--text-muted)]">optional</span><textarea rows={3} maxLength={4000} value={form.description} onChange={(event) => set("description", event.target.value)} className={`${TEXT_FIELD_CLASS} mt-1`} /></label>
      <EventColorPicker value={form.color} onChange={(color) => set("color", color)} />
      <PublicSwitch checked={form.isPublic} onChange={(next) => set("isPublic", next)} />
    </>
  );
}
