"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProductionDatePicker } from "@/components/ui/production-date-picker";
import { ProductionSelect } from "@/components/ui/production-select";
import { formatCalendarDate } from "@/lib/calendar-date";
import type { MinistryRecord } from "@/features/ministries/ministry-types";
import { STATUS_DESCRIPTIONS, formatStatusLabel } from "./people-format";
import {
  datePartsToIso,
  emptyPersonForm,
  isoToDateParts,
  personToForm,
  validatePersonForm,
  type DateParts,
  type PersonForm,
  type PersonFormErrors,
} from "./person-form";
import type { PersonRecord } from "./person-types";
import { BAPTISM_STATUSES, PERSON_STATUSES, type BaptismStatus } from "./person-validation";

const LABEL_CLASS = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const BAPTISM_LABELS: Record<BaptismStatus, string> = {
  BAPTIZED: "Baptized",
  NOT_BAPTIZED: "Not baptized",
  UNKNOWN: "Don't know",
};

function DateField({
  legend,
  parts,
  error,
  onChange,
}: {
  legend: string;
  parts: DateParts;
  error?: string;
  onChange: (next: DateParts) => void;
}) {
  const iso = datePartsToIso(parts);
  return (
    <div className="min-w-0">
      <ProductionDatePicker
        label={legend}
        labelClassName={LABEL_CLASS}
        value={iso === null || iso === "incomplete" ? "" : iso}
        onValueChange={(value) => onChange(isoToDateParts(value || null))}
        allowClear
        jumpToMonthAndYear
        showToday={false}
        maxValue={formatCalendarDate(new Date())}
        placeholder="Choose a date"
        triggerClassName="min-h-11"
      />
      {error ? <p className="mt-1 text-sm text-[var(--state-danger)]" role="alert">{error}</p> : null}
    </div>
  );
}

function formatAudit(person: PersonRecord) {
  const added = person.createdByName ? `Added by ${person.createdByName}` : "Added";
  const edited = person.updatedByName ? `Last edited by ${person.updatedByName}` : "Last edited";
  const when = new Date(person.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${added} · ${edited}, ${when}`;
}

export function PersonDialog({
  person,
  ministries,
  pending,
  onClose,
  onSave,
}: {
  person: PersonRecord | null;
  ministries: MinistryRecord[];
  pending: boolean;
  onClose: () => void;
  onSave: (form: PersonForm) => void;
}) {
  const [form, setForm] = useState<PersonForm>(() => (person ? personToForm(person) : emptyPersonForm()));
  const [errors, setErrors] = useState<PersonFormErrors>({});
  const patch = (next: Partial<PersonForm>) => setForm((current) => ({ ...current, ...next }));
  const choices = ministries.filter((ministry) => ministry.active || form.ministryIds.includes(ministry.id));

  function submit() {
    const found = validatePersonForm(form);
    setErrors(found ?? {});
    if (!found) onSave(form);
  }

  const inputClass = "ui-field ui-field-inactive mt-0 w-full px-3 py-2 outline-none";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">{person ? "Edit person" : "Add person"}</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
              {person ? formatAudit(person) : "Only the name is required. You can add the rest later."}
            </DialogDescription>
          </div>
          <button type="button" onClick={onClose} className="ui-modal-close pressable" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="mt-5 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL_CLASS}>First name</span>
              <input type="text" value={form.firstName} onChange={(event) => patch({ firstName: event.target.value })} className={inputClass} autoFocus />
              {errors.firstName ? <p className="mt-1 text-sm text-[var(--state-danger)]" role="alert">{errors.firstName}</p> : null}
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Last name</span>
              <input type="text" value={form.lastName} onChange={(event) => patch({ lastName: event.target.value })} className={inputClass} />
              {errors.lastName ? <p className="mt-1 text-sm text-[var(--state-danger)]" role="alert">{errors.lastName}</p> : null}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <ProductionSelect
                label="Status"
                labelClassName={LABEL_CLASS}
                value={form.status}
                onValueChange={(value) => patch({ status: value })}
                options={PERSON_STATUSES.map((status) => ({ value: status, label: formatStatusLabel(status) }))}
              />
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{STATUS_DESCRIPTIONS[form.status]}</p>
            </div>
            <ProductionSelect
              label="Gender"
              labelClassName={LABEL_CLASS}
              value={form.gender}
              onValueChange={(value) => patch({ gender: value })}
              options={[{ value: "", label: "Not set" }, { value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }]}
            />
          </div>

          <DateField
            legend="Birthdate"
            parts={{ year: form.birthYear, month: form.birthMonth, day: form.birthDay }}
            error={errors.birthdate}
            onChange={(next) => patch({ birthYear: next.year, birthMonth: next.month, birthDay: next.day })}
          />

          <fieldset>
            <legend className={LABEL_CLASS}>Ministries</legend>
            {choices.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No ministries yet. Add some on the Ministries page.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {choices.map((ministry) => {
                  const checked = form.ministryIds.includes(ministry.id);
                  return (
                    <label key={ministry.id} className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-panel-alt)]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => patch({ ministryIds: checked ? form.ministryIds.filter((id) => id !== ministry.id) : [...form.ministryIds, ministry.id] })}
                        className="ui-checkbox h-5 w-5"
                      />
                      {ministry.label}
                      {ministry.active ? null : <span className="text-sm text-[var(--text-muted)]">(archived)</span>}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div className="space-y-3">
            <ProductionSelect
              label="Baptism"
              labelClassName={LABEL_CLASS}
              value={form.baptismStatus}
              onValueChange={(value) => patch({ baptismStatus: value })}
              options={BAPTISM_STATUSES.map((status) => ({ value: status, label: BAPTISM_LABELS[status] }))}
            />
            {form.baptismStatus === "BAPTIZED" ? (
              <DateField
                legend="Baptism date (optional)"
                parts={{ year: form.baptismYear, month: form.baptismMonth, day: form.baptismDay }}
                error={errors.baptismDate}
                onChange={(next) => patch({ baptismYear: next.year, baptismMonth: next.month, baptismDay: next.day })}
              />
            ) : null}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="ui-btn-cancel pressable min-h-11 px-4 text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="ui-btn-primary pressable inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {person ? "Save changes" : "Add person"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
