"use client";

import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import type { CoverBlockInput } from "../blocks/block-validation";
import LinkField from "./link-field";
import { usePictureUpload } from "./use-picture-upload";

type Content = CoverBlockInput["content"];
type Props = { content: Content; pages: Array<{ slug: string; title: string }>; disabled: boolean; onChange: (content: Content, coalesce?: boolean) => void };

const SECONDARY_BUTTON = "ui-btn-secondary pressable inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60";
const ICON_BUTTON = "inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-40";

const FOCUS_LABELS: Record<Content["focus"], string> = {
  "top-left": "Top left", top: "Top", "top-right": "Top right",
  left: "Left", center: "Middle", right: "Right",
  "bottom-left": "Bottom left", bottom: "Bottom", "bottom-right": "Bottom right",
};

function Choice<T extends string>({ label, value, options, disabled, onChange }: { label: string; value: T; options: Array<[T, string]>; disabled: boolean; onChange: (value: T) => void }) {
  return (
    <label className="block">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      <select className={TEXT_FIELD_CLASS} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as T)}>
        {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
      </select>
    </label>
  );
}

function CoverPicture({ content, disabled, onChange }: Omit<Props, "pages">) {
  const { input, upload, hasPicture, shown, choose, open } = usePictureUpload(content.picture ?? "", (picture) => onChange({ ...content, picture }));
  return (
    <div className="space-y-3">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview or the church's own small WebP
        <img src={shown} alt="" className="max-h-40 max-w-full rounded-lg" />
      ) : <p className="text-sm text-[var(--text-muted)]">No picture: the cover uses the colour of your church.</p>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a cover picture" disabled={disabled || upload.isPending} onChange={(event) => choose(event.target.files?.[0])} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={SECONDARY_BUTTON + " min-h-11"} disabled={disabled || upload.isPending} onClick={open}>
          <ImagePlus aria-hidden="true" className="h-4 w-4" />
          {upload.isPending ? "Adding your picture…" : hasPicture ? "Choose a different picture" : "Choose a picture"}
        </button>
        {hasPicture ? <button type="button" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold underline" disabled={disabled} onClick={() => onChange({ ...content, picture: undefined })}>Use the church colour instead</button> : null}
      </div>
      {upload.isError ? <p role="alert" className="border-l-2 border-[var(--state-danger)] pl-3 text-sm">{upload.error instanceof Error ? upload.error.message : "The picture could not be added."}</p> : null}
    </div>
  );
}

// A picture (or the church colour) with a headline, a line of words and up to two buttons on top of it.
export default function CoverFields({ content, pages, disabled, onChange }: Props) {
  const setButton = (index: number, button: Content["buttons"][number]) => onChange({ ...content, buttons: content.buttons.map((item, i) => (i === index ? button : item)) }, true);
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={FIELD_LABEL_CLASS}>Headline</span>
        <input disabled={disabled} className={`${TEXT_FIELD_CLASS} text-xl font-semibold`} maxLength={120} placeholder="For example: Welcome home" value={content.headline} onChange={(event) => onChange({ ...content, headline: event.target.value }, true)} />
      </label>
      <label className="block">
        <span className={FIELD_LABEL_CLASS}>A line under the headline (optional)</span>
        <textarea disabled={disabled} rows={2} className={TEXT_FIELD_CLASS} maxLength={300} value={content.text ?? ""} onChange={(event) => onChange({ ...content, text: event.target.value }, true)} />
      </label>
      <CoverPicture content={content} disabled={disabled} onChange={onChange} />

      <div className="grid gap-3 md:grid-cols-2">
        <Choice label="How dark the picture is" value={content.overlay} disabled={disabled} options={[["light", "Lighter"], ["medium", "Medium"], ["strong", "Darker (best for reading)"]]} onChange={(overlay) => onChange({ ...content, overlay })} />
        <Choice label="How tall" value={content.height} disabled={disabled} options={[["medium", "Medium"], ["tall", "Tall"], ["screen", "The whole screen"]]} onChange={(height) => onChange({ ...content, height })} />
        <Choice label="Where the words sit" value={content.align} disabled={disabled} options={[["center", "In the middle"], ["left", "On the left"]]} onChange={(align) => onChange({ ...content, align })} />
        <Choice label="How wide" value={content.width} disabled={disabled} options={[["full", "Full width of the screen"], ["wide", "Wide"]]} onChange={(width) => onChange({ ...content, width })} />
        <Choice label="Which part of the picture to keep in view" value={content.focus} disabled={disabled} options={(Object.keys(FOCUS_LABELS) as Array<Content["focus"]>).map((key): [Content["focus"], string] => [key, FOCUS_LABELS[key]])} onChange={(focus) => onChange({ ...content, focus })} />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Buttons (up to 2)</p>
        {content.buttons.map((button, index) => (
          <div key={index} className="space-y-3 border-t border-[var(--rule-default)] pt-3">
            <div className="flex items-end gap-2">
              <label className="block min-w-0 flex-1">
                <span className={FIELD_LABEL_CLASS}>What the button says</span>
                <input disabled={disabled} className={TEXT_FIELD_CLASS} maxLength={60} value={button.label} onChange={(event) => setButton(index, { ...button, label: event.target.value })} />
              </label>
              <button type="button" className={ICON_BUTTON} aria-label={`Remove button ${index + 1}`} title="Remove this button" disabled={disabled} onClick={() => onChange({ ...content, buttons: content.buttons.filter((_, i) => i !== index) })}><Trash2 aria-hidden="true" className="h-5 w-5" /></button>
            </div>
            <LinkField link={button.link} pages={pages} onChange={(link) => setButton(index, { ...button, link })} />
            <Choice label="Look" value={button.style} disabled={disabled} options={[["filled", "Filled (the main button)"], ["outline", "Outline (a quieter button)"]]} onChange={(style) => setButton(index, { ...button, style })} />
          </div>
        ))}
        {content.buttons.length < 2 ? (
          <button
            type="button"
            className={SECONDARY_BUTTON + " min-h-11"}
            disabled={disabled}
            onClick={() => onChange({ ...content, buttons: [...content.buttons, { label: content.buttons.length === 0 ? "Plan your visit" : "Learn more", link: pages[0] ? { kind: "page", slug: pages[0].slug } : { kind: "url", url: "https://" }, style: content.buttons.length === 0 ? "filled" : "outline" }] })}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />Add a button
          </button>
        ) : null}
      </div>
    </div>
  );
}
