"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";

type Settings = { contactEmail: string | null; contactPhone: string | null; address: string | null; indexable: boolean };
type SettingsResponse = { settings: Settings; canEdit: boolean; canPublish: boolean };

const PRIMARY_BUTTON = "ui-btn-primary pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";

function Form({ initial, canEdit, canPublish, onSaved }: { initial: Settings; canEdit: boolean; canPublish: boolean; onSaved: (settings: Settings) => void }) {
  const [email, setEmail] = useState(initial.contactEmail ?? "");
  const [phone, setPhone] = useState(initial.contactPhone ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [indexable, setIndexable] = useState(initial.indexable);
  const [saved, setSaved] = useState(initial);

  const dirty = email.trim() !== (saved.contactEmail ?? "") || phone.trim() !== (saved.contactPhone ?? "") || address.trim() !== (saved.address ?? "") || indexable !== saved.indexable;

  const save = useMutation({
    mutationFn: () => apiFetch<{ settings: Settings }>("/api/site/settings", {
      method: "PATCH",
      body: JSON.stringify({ contactEmail: email, contactPhone: phone, address, ...(canPublish ? { indexable } : {}) }),
    }),
    onSuccess: ({ settings }) => { setSaved(settings); onSaved(settings); },
  });

  return (
    <form className="space-y-4 py-4" onSubmit={(event) => { event.preventDefault(); if (dirty) save.mutate(); }}>
      <p className="text-sm text-[var(--text-secondary)]">These show in the Contact block on your pages.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className={FIELD_LABEL_CLASS}>Church address</span>
          <textarea rows={2} maxLength={300} disabled={!canEdit} className={TEXT_FIELD_CLASS} value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>Phone number</span>
          <input maxLength={40} disabled={!canEdit} className={TEXT_FIELD_CLASS} value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>Email address</span>
          <input type="email" maxLength={160} disabled={!canEdit} className={TEXT_FIELD_CLASS} value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
      </div>
      <div>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" className="ui-checkbox mt-1" checked={indexable} disabled={!canPublish} onChange={(event) => setIndexable(event.target.checked)} />
          <span>
            Let search engines like Google list my website
            <span className="block text-[var(--text-muted)]">Off by default. Anyone with the link can still open the site. Only people who can publish can change this.</span>
          </span>
        </label>
      </div>
      {save.isError ? <p role="alert" className="border-l-2 border-[var(--state-danger)] pl-3 text-sm">{save.error instanceof Error ? save.error.message : "The settings could not be saved."}</p> : null}
      {canEdit && dirty ? (
        <div className="flex justify-end">
          <button type="submit" className={PRIMARY_BUTTON} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      ) : null}
    </form>
  );
}

// One full-width row that opens like the other collapsible sections: a chevron, a hairline, no box inside a box.
export default function SiteSettingsPanel() {
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ["site-settings"], queryFn: () => apiFetch<SettingsResponse>("/api/site/settings"), enabled: open, staleTime: Infinity, refetchOnWindowFocus: false });
  return (
    <section aria-label="Website settings" className="mb-6 border-y border-[var(--rule-default)]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex min-h-11 w-full items-center justify-between text-left text-base font-semibold focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]">
        Website settings
        <ChevronDown aria-hidden="true" className={`h-5 w-5 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        query.isPending ? <p role="status" className="py-4 text-sm text-[var(--text-muted)]">Loading…</p>
        : query.isError || !query.data ? <p role="alert" className="py-4 text-sm">The settings could not be loaded. <button type="button" className="font-semibold underline" onClick={() => void query.refetch()}>Try again</button></p>
        : <Form initial={query.data.settings} canEdit={query.data.canEdit} canPublish={query.data.canPublish} onSaved={() => undefined} />
      ) : null}
    </section>
  );
}
