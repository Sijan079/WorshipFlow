"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { apiFetch, workspaceApiPath } from "@/lib/api-client";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import { imageIdFromPath } from "../images/image-refs";

type ImageContent = { path: string; alt: string; caption?: string; align: "left" | "center" };
type Props = { content: ImageContent; disabled: boolean; onChange: (content: ImageContent, coalesce?: boolean) => void };

const SECONDARY_BUTTON = "ui-btn-secondary pressable inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60";

// Choosing a picture uploads it straight away. The server turns it into a small WebP, so what is stored is
// never the original file.
export default function ImageField({ content, disabled, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const imageId = imageIdFromPath(content.path);

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetch<{ path: string }>("/api/site/images", { method: "POST", body: form });
    },
    onSuccess: ({ path }) => { setPreview(null); onChange({ ...content, path }); },
  });

  function choose(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    upload.mutate(file, { onSettled: () => { if (input.current) input.current.value = ""; } });
  }

  const shown = preview ?? (imageId ? workspaceApiPath(`/api/site/images/${imageId}`) : null);

  return (
    <div className="space-y-3">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview or the church's own small WebP
        <img src={shown} alt={content.alt || "Picture chosen for this page"} className="max-h-64 max-w-full rounded-lg" />
      ) : null}
      <div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a picture" disabled={disabled || upload.isPending} onChange={(event) => choose(event.target.files?.[0])} />
        <button type="button" className={SECONDARY_BUTTON + " min-h-11"} disabled={disabled || upload.isPending} onClick={() => input.current?.click()}>
          <ImagePlus aria-hidden="true" className="h-4 w-4" />
          {upload.isPending ? "Adding your picture…" : imageId ? "Choose a different picture" : "Choose a picture"}
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
      <label className="block">
        <span className={FIELD_LABEL_CLASS}>Align</span>
        <select className={TEXT_FIELD_CLASS} disabled={disabled} value={content.align} onChange={(event) => onChange({ ...content, align: event.target.value as "left" | "center" })}>
          <option value="left">Left</option>
          <option value="center">Centre</option>
        </select>
      </label>
    </div>
  );
}
