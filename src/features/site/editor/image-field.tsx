"use client";

import { ImagePlus } from "lucide-react";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import { usePictureUpload } from "./use-picture-upload";

type ImageContent = { path: string; alt: string; caption?: string; align: "left" | "center"; width?: "content" | "wide" | "full" };
type Props = { content: ImageContent; disabled: boolean; onChange: (content: ImageContent, coalesce?: boolean) => void };

const SECONDARY_BUTTON = "ui-btn-secondary pressable inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60";

export default function ImageField({ content, disabled, onChange }: Props) {
  const { input, upload, hasPicture, shown, choose, open } = usePictureUpload(content.path, (path) => onChange({ ...content, path }));

  return (
    <div className="space-y-3">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview or the church's own small WebP
        <img src={shown} alt={content.alt || "Picture chosen for this page"} className="max-h-64 max-w-full rounded-lg" />
      ) : null}
      <div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a picture" disabled={disabled || upload.isPending} onChange={(event) => choose(event.target.files?.[0])} />
        <button type="button" className={SECONDARY_BUTTON + " min-h-11"} disabled={disabled || upload.isPending} onClick={open}>
          <ImagePlus aria-hidden="true" className="h-4 w-4" />
          {upload.isPending ? "Adding your picture…" : hasPicture ? "Choose a different picture" : "Choose a picture"}
        </button>
      </div>
      {upload.isError ? <p role="alert" className="border-l-2 border-[var(--state-danger)] pl-3 text-sm">{upload.error instanceof Error ? upload.error.message : "The picture could not be added."}</p> : null}
      <label className="block">
        <span className={FIELD_LABEL_CLASS}>Describe the picture, for people who cannot see it</span>
        <input disabled={disabled} className={TEXT_FIELD_CLASS} maxLength={300} value={content.alt} onChange={(event) => onChange({ ...content, alt: event.target.value }, true)} />
      </label>
      <label className="block">
        <span className={FIELD_LABEL_CLASS}>Words under the picture (optional)</span>
        <input disabled={disabled} className={TEXT_FIELD_CLASS} maxLength={300} value={content.caption ?? ""} onChange={(event) => onChange({ ...content, caption: event.target.value }, true)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>How wide</span>
          <select className={TEXT_FIELD_CLASS} disabled={disabled} value={content.width ?? "content"} onChange={(event) => onChange({ ...content, width: event.target.value as "content" | "wide" | "full" })}>
            <option value="content">Same width as the text</option>
            <option value="wide">Wide</option>
            <option value="full">Full width of the screen</option>
          </select>
        </label>
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>Align</span>
          <select className={TEXT_FIELD_CLASS} disabled={disabled} value={content.align} onChange={(event) => onChange({ ...content, align: event.target.value as "left" | "center" })}>
            <option value="left">Left</option>
            <option value="center">Centre</option>
          </select>
        </label>
      </div>
    </div>
  );
}
