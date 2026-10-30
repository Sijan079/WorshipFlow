"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ImagePlus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import { usePictureUpload } from "../editor/use-picture-upload";
import { COLOR_SET_IDS, COLOR_SETS, FONT_STYLE_IDS, FONT_STYLES, isColorSet, isFontStyle, lookVariables, type ColorSetId, type FontStyleId } from "../look/look";

type Settings = {
  contactEmail: string | null; contactPhone: string | null; address: string | null; indexable: boolean;
  colorSet: string; fontStyle: string; logoPath: string | null; headerButtonLabel: string | null; headerButtonSlug: string | null; serviceTimes: string | null;
};
type SettingsResponse = { settings: Settings; canEdit: boolean; canPublish: boolean };
type PageChoice = { slug: string; title: string };

const PRIMARY_BUTTON = "ui-btn-primary pressable inline-flex items-center px-4 text-sm font-semibold disabled:opacity-60";
const SECONDARY_BUTTON = "ui-btn-secondary pressable inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60";
const SECTION_TITLE = "text-base font-semibold";

// A small sample of the church's site in the chosen colours and fonts: a dark band, a button and a light band.
function Sample({ colorSet, fontStyle }: { colorSet: ColorSetId; fontStyle: FontStyleId }) {
  return (
    <div style={lookVariables(colorSet, fontStyle) as React.CSSProperties} className="overflow-hidden rounded-lg border border-[var(--border-default)]" aria-hidden="true">
      <div style={{ backgroundColor: "var(--site-dark)", fontFamily: "var(--site-font-body)" }} className="px-4 py-3 text-white">
        <p style={{ fontFamily: "var(--site-font-heading)" }} className="text-lg font-bold">Welcome home</p>
        <p className="text-sm">Come as you are.</p>
        <span style={{ backgroundColor: "var(--site-accent)", color: "var(--site-accent-text)" }} className="mt-2 inline-block rounded-md px-3 py-1 text-sm font-semibold">Plan your visit</span>
      </div>
      <div style={{ backgroundColor: "var(--site-soft)", color: "var(--site-text)", fontFamily: "var(--site-font-body)" }} className="px-4 py-3 text-sm">A light band with your words on it.</div>
    </div>
  );
}

function Form({ initial, canEdit, canPublish, pages, onSaved }: { initial: Settings; canEdit: boolean; canPublish: boolean; pages: PageChoice[]; onSaved: (settings: Settings) => void }) {
  const [email, setEmail] = useState(initial.contactEmail ?? "");
  const [phone, setPhone] = useState(initial.contactPhone ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [indexable, setIndexable] = useState(initial.indexable);
  const [colorSet, setColorSet] = useState<ColorSetId>(isColorSet(initial.colorSet) ? initial.colorSet : "dawn");
  const [fontStyle, setFontStyle] = useState<FontStyleId>(isFontStyle(initial.fontStyle) ? initial.fontStyle : "clean");
  const [logoPath, setLogoPath] = useState(initial.logoPath ?? "");
  const [buttonLabel, setButtonLabel] = useState(initial.headerButtonLabel ?? "");
  const [buttonSlug, setButtonSlug] = useState(initial.headerButtonSlug ?? "");
  const [serviceTimes, setServiceTimes] = useState(initial.serviceTimes ?? "");
  const [saved, setSaved] = useState(initial);
  const queryClient = useQueryClient();
  const { input: logoInput, upload: logoUpload, hasPicture: hasLogo, shown: logoShown, choose: chooseLogo, open: openLogo } = usePictureUpload(logoPath, setLogoPath);

  const dirty = email.trim() !== (saved.contactEmail ?? "") || phone.trim() !== (saved.contactPhone ?? "") || address.trim() !== (saved.address ?? "")
    || indexable !== saved.indexable || colorSet !== saved.colorSet || fontStyle !== saved.fontStyle || logoPath !== (saved.logoPath ?? "")
    || buttonLabel.trim() !== (saved.headerButtonLabel ?? "") || buttonSlug !== (saved.headerButtonSlug ?? "")
    || serviceTimes.split("\n").map((line) => line.trim()).filter(Boolean).join("\n") !== (saved.serviceTimes ?? "");

  const save = useMutation({
    mutationFn: () => apiFetch<{ settings: Settings }>("/api/site/settings", {
      method: "PATCH",
      body: JSON.stringify({
        contactEmail: email, contactPhone: phone, address, colorSet, fontStyle, logoPath: logoPath || null,
        headerButtonLabel: buttonLabel, headerButtonSlug: buttonSlug, serviceTimes,
        ...(canPublish ? { indexable } : {}),
      }),
    }),
    onSuccess: ({ settings }) => {
      setSaved(settings);
      onSaved(settings);
      // An open preview shows the new look straight away.
      void queryClient.invalidateQueries({ queryKey: ["site-preview"] });
    },
  });

  return (
    <form className="space-y-8 py-4" onSubmit={(event) => { event.preventDefault(); if (dirty) save.mutate(); }}>
      <section className="space-y-4" aria-label="Contact details">
        <h3 className={SECTION_TITLE}>Contact details</h3>
        <p className="text-sm text-[var(--text-secondary)]">These show in the Contact block and in the footer of every page.</p>
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
      </section>

      <section className="space-y-4 border-t border-[var(--rule-default)] pt-6" aria-label="Look">
        <h3 className={SECTION_TITLE}>Look</h3>
        <fieldset className="space-y-2">
          <legend className={FIELD_LABEL_CLASS}>Colours</legend>
          <div className="grid gap-2 md:grid-cols-2">
            {COLOR_SET_IDS.map((id) => {
              const set = COLOR_SETS[id];
              return (
                <label key={id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${colorSet === id ? "border-[var(--border-focus)]" : "border-[var(--border-default)]"}`}>
                  <input type="radio" name="colorSet" className="h-5 w-5" checked={colorSet === id} disabled={!canEdit} onChange={() => setColorSet(id)} />
                  <span className="flex shrink-0 overflow-hidden rounded" aria-hidden="true">
                    <span className="h-8 w-6" style={{ backgroundColor: set.accent }} />
                    <span className="h-8 w-6" style={{ backgroundColor: set.dark }} />
                    <span className="h-8 w-6" style={{ backgroundColor: set.tint }} />
                  </span>
                  <span><span className="block font-semibold">{set.name}</span><span className="block text-[var(--text-muted)]">{set.description}</span></span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className={FIELD_LABEL_CLASS}>Letters</legend>
          <div className="grid gap-2 md:grid-cols-2">
            {FONT_STYLE_IDS.map((id) => (
              <label key={id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${fontStyle === id ? "border-[var(--border-focus)]" : "border-[var(--border-default)]"}`}>
                <input type="radio" name="fontStyle" className="h-5 w-5" checked={fontStyle === id} disabled={!canEdit} onChange={() => setFontStyle(id)} />
                <span>
                  <span className="block text-lg font-bold" style={{ fontFamily: FONT_STYLES[id].heading }}>{FONT_STYLES[id].name}</span>
                  <span className="block text-[var(--text-muted)]">{FONT_STYLES[id].description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <p className={FIELD_LABEL_CLASS}>How it will look</p>
          <Sample colorSet={colorSet} fontStyle={fontStyle} />
        </div>
      </section>

      <section className="space-y-3 border-t border-[var(--rule-default)] pt-6" aria-label="Logo">
        <h3 className={SECTION_TITLE}>Logo</h3>
        <p className="text-sm text-[var(--text-secondary)]">Shown at the top left of every page. Without one, your church name is shown instead.</p>
        {logoShown ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview or the church's own small WebP
          <img src={logoShown} alt="Your logo" className="max-h-16 max-w-xs rounded border border-[var(--border-default)] bg-white p-2" />
        ) : null}
        <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a logo" disabled={!canEdit || logoUpload.isPending} onChange={(event) => chooseLogo(event.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SECONDARY_BUTTON + " min-h-11"} disabled={!canEdit || logoUpload.isPending} onClick={openLogo}>
            <ImagePlus aria-hidden="true" className="h-4 w-4" />
            {logoUpload.isPending ? "Adding your logo…" : hasLogo ? "Choose a different logo" : "Choose a logo"}
          </button>
          {hasLogo ? <button type="button" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold underline" disabled={!canEdit} onClick={() => setLogoPath("")}>Remove the logo</button> : null}
        </div>
        {logoUpload.isError ? <p role="alert" className="border-l-2 border-[var(--state-danger)] pl-3 text-sm">{logoUpload.error instanceof Error ? logoUpload.error.message : "The logo could not be added."}</p> : null}
      </section>

      <section className="space-y-4 border-t border-[var(--rule-default)] pt-6" aria-label="Header button">
        <h3 className={SECTION_TITLE}>Header button</h3>
        <p className="text-sm text-[var(--text-secondary)]">An optional button at the top right of every page. It shows only when the page it opens is published.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className={FIELD_LABEL_CLASS}>What the button says</span>
            <input maxLength={40} disabled={!canEdit} className={TEXT_FIELD_CLASS} placeholder="For example: Plan your visit" value={buttonLabel} onChange={(event) => setButtonLabel(event.target.value)} />
          </label>
          <label className="block">
            <span className={FIELD_LABEL_CLASS}>Which page it opens</span>
            <select disabled={!canEdit} className={TEXT_FIELD_CLASS} value={buttonSlug} onChange={(event) => setButtonSlug(event.target.value)}>
              <option value="">No button</option>
              {pages.map((page) => <option key={page.slug} value={page.slug}>{page.title}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3 border-t border-[var(--rule-default)] pt-6" aria-label="Footer">
        <h3 className={SECTION_TITLE}>Footer</h3>
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>Service times, one per line, for example “Sunday 9:00 AM”</span>
          <textarea rows={3} disabled={!canEdit} className={TEXT_FIELD_CLASS} value={serviceTimes} onChange={(event) => setServiceTimes(event.target.value)} />
        </label>
      </section>

      <section className="space-y-3 border-t border-[var(--rule-default)] pt-6" aria-label="Search engines">
        <h3 className={SECTION_TITLE}>Search engines</h3>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" className="ui-checkbox mt-1" checked={indexable} disabled={!canPublish} onChange={(event) => setIndexable(event.target.checked)} />
          <span>
            Let search engines like Google list my website
            <span className="block text-[var(--text-muted)]">Off by default. Anyone with the link can still open the site. Only people who can publish can change this.</span>
          </span>
        </label>
      </section>

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
export default function SiteSettingsPanel({ pages }: { pages: PageChoice[] }) {
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
        : <Form initial={query.data.settings} canEdit={query.data.canEdit} canPublish={query.data.canPublish} pages={pages} onSaved={() => undefined} />
      ) : null}
    </section>
  );
}
