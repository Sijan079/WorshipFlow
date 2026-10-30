"use client";

import { ImagePlus } from "lucide-react";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import type { KeyedSection } from "./editor-state";
import { usePictureUpload } from "./use-picture-upload";

type Content = KeyedSection["content"];
type Props = { content: Content; disabled: boolean; onChange: (content: Content) => void };

const SECONDARY_BUTTON = "ui-btn-secondary pressable inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60";

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

function BackgroundPicture({ content, disabled, onChange }: Props) {
  const { input, upload, hasPicture, shown, choose, open } = usePictureUpload(content.picture ?? "", (picture) => onChange({ ...content, picture }));
  return (
    <div className="space-y-3 md:col-span-2">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview or the church's own small WebP
        <img src={shown} alt="" className="max-h-40 max-w-full rounded-lg" />
      ) : null}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a background picture" disabled={disabled || upload.isPending} onChange={(event) => choose(event.target.files?.[0])} />
      <button type="button" className={SECONDARY_BUTTON + " min-h-11"} disabled={disabled || upload.isPending} onClick={open}>
        <ImagePlus aria-hidden="true" className="h-4 w-4" />
        {upload.isPending ? "Adding your picture…" : hasPicture ? "Choose a different picture" : "Choose a background picture"}
      </button>
      {upload.isError ? <p role="alert" className="border-l-2 border-[var(--state-danger)] pl-3 text-sm">{upload.error instanceof Error ? upload.error.message : "The picture could not be added."}</p> : null}
    </div>
  );
}

// The settings of a Section: its background, spacing and widths. The blocks inside it are edited in the list below.
export default function SectionFields({ content, disabled, onChange }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Choice
        label="Background"
        value={content.background}
        disabled={disabled}
        options={[["none", "Plain white"], ["tinted", "Light tint"], ["dark", "Dark"], ["accent", "Colour of your church"], ["picture", "A picture"]]}
        onChange={(background) => onChange({ ...content, background })}
      />
      <Choice
        label="Space above and below"
        value={content.padding}
        disabled={disabled}
        options={[["small", "Small"], ["medium", "Medium"], ["large", "Large"]]}
        onChange={(padding) => onChange({ ...content, padding })}
      />
      {content.background === "picture" ? (
        <>
          <BackgroundPicture content={content} disabled={disabled} onChange={onChange} />
          <Choice
            label="How dark the picture is"
            value={content.overlay}
            disabled={disabled}
            options={[["light", "Lighter"], ["medium", "Medium"], ["strong", "Darker (best for reading)"]]}
            onChange={(overlay) => onChange({ ...content, overlay })}
          />
        </>
      ) : null}
      <Choice
        label="How wide the words are"
        value={content.inner}
        disabled={disabled}
        options={[["content", "Reading width"], ["wide", "Wide"]]}
        onChange={(inner) => onChange({ ...content, inner })}
      />
      <Choice
        label="How wide the band is"
        value={content.width}
        disabled={disabled}
        options={[["full", "Full width of the screen"], ["wide", "Wide"]]}
        onChange={(width) => onChange({ ...content, width })}
      />
    </div>
  );
}
