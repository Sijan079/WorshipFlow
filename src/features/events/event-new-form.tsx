"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import EventFormFields from "./event-form-fields";
import type { NewEventForm } from "./event-form";

// The New event form, drawn in the event panel (or above the list on a phone). Actions sit at the bottom right.
export default function EventNewForm({ form, setForm, problem, error, saving, onSubmit, onCancel }: {
  form: NewEventForm;
  setForm: Dispatch<SetStateAction<NewEventForm>>;
  problem: string;
  error: string;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">New event</h2>
      <EventFormFields form={form} setForm={setForm} />
      {problem ? <p role="alert" className="text-sm text-[var(--state-danger)]">{problem}</p> : null}
      {error ? <p role="alert" className="text-sm text-[var(--state-danger)]">{error}</p> : null}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="ui-btn-cancel pressable inline-flex items-center px-4 text-sm font-semibold">Cancel</button>
        <button type="submit" disabled={saving} className="ui-btn-primary pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60">{saving ? "Saving…" : "Create event"}</button>
      </div>
    </form>
  );
}
