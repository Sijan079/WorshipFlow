"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { Download, Eraser, Loader2, Upload } from "lucide-react";
import { triggerBrowserDownload, workspaceApiPath } from "@/lib/api-client";
import { MAX_HEIGHT, MAX_SOURCE_FILE_BYTES, MAX_TOTAL_PIXELS, MAX_WIDTH } from "@/lib/resize-image";

type ToastTone = "info" | "success";
type LoadedImage = { file: File; image: HTMLImageElement; objectUrl: string };
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function loadImage(file: File) {
  return new Promise<LoadedImage>((resolve, reject) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return reject(new Error("Choose a PNG, JPEG, or WebP image."));
    if (file.size > MAX_SOURCE_FILE_BYTES) return reject(new Error("Image files must be 20MB or smaller."));
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth > MAX_WIDTH || image.naturalHeight > MAX_HEIGHT || image.naturalWidth * image.naturalHeight > MAX_TOTAL_PIXELS) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("The source image dimensions are too large to process safely."));
        return;
      }
      resolve({ file, image, objectUrl });
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("The selected file could not be decoded.")); };
    image.src = objectUrl;
  });
}

export default function BackgroundRemovalTool({ showToast }: { showToast: (message: string, tone?: ToastTone) => void }) {
  const [source, setSource] = useState<LoadedImage | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (source) URL.revokeObjectURL(source.objectUrl); }, [source]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  async function selectFile(file: File) {
    setError(""); setResult(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    try { setSource(await loadImage(file)); showToast("Image loaded. AI removal is ready.", "success"); }
    catch (loadError) { const message = loadError instanceof Error ? loadError.message : "Image loading failed."; setError(message); showToast(message); }
  }

  async function removeBackground() {
    if (!source) return;
    setProcessing(true); setError("");
    try {
      const form = new FormData(); form.append("file", source.file);
      const response = await fetch(workspaceApiPath("/api/media/background-removal"), { method: "POST", body: form });
      if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error || "AI background removal failed."); }
      const output = await response.blob();
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResult(output); setResultUrl(URL.createObjectURL(output)); showToast("Background removed.", "success");
    } catch (removalError) { const message = removalError instanceof Error ? removalError.message : "AI background removal failed."; setError(message); showToast(message); }
    finally { setProcessing(false); }
  }

  return <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
    <aside className="ui-surface-panel grid gap-5 p-4 xl:sticky xl:top-5">
      <div><h2 className="text-sm font-semibold text-[var(--text-primary)]">AI background removal</h2><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">The image is sent to the configured workspace AI model and returned as a transparent PNG.</p></div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void selectFile(file); event.target.value = ""; }} />
      <button type="button" onClick={() => inputRef.current?.click()} className="pressable ui-btn-secondary inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-semibold"><Upload className="h-4 w-4" />{source ? "Choose another image" : "Upload image"}</button>
      {source ? <div className="border-y border-[var(--rule-default)] py-4 text-xs text-[var(--text-secondary)]"><p className="truncate font-semibold text-[var(--text-primary)]">{source.file.name}</p><p className="mt-1">{source.image.naturalWidth} × {source.image.naturalHeight}</p></div> : null}
      {error ? <p role="alert" className="rounded-md border border-[color:color-mix(in_oklab,var(--state-danger)_35%,transparent)] bg-[var(--state-danger-soft)] p-3 text-xs text-[var(--text-danger)]">{error}</p> : null}
      <button type="button" onClick={() => void removeBackground()} disabled={!source || processing} className="pressable ui-btn-primary inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-50">{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}{processing ? "Removing background..." : "Remove background"}</button>
      {result ? <button type="button" onClick={() => triggerBrowserDownload(result, `${source?.file.name.replace(/\.[^/.]+$/, "") ?? "image"}-transparent.png`)} className="pressable ui-btn-secondary inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-semibold"><Download className="h-4 w-4" />Download PNG</button> : null}
    </aside>
    <div className="ui-surface-elevated p-4 sm:p-5"><div className="mb-4"><h2 className="text-sm font-semibold text-[var(--text-primary)]">{resultUrl ? "Transparent result" : "Source preview"}</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">{resultUrl ? "The checkerboard represents transparent pixels." : "Upload an image, then run AI background removal."}</p></div><div className="flex min-h-80 items-center justify-center overflow-auto rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--surface-panel-alt)] p-4">{resultUrl ? <img src={resultUrl} alt="Image with its background removed" className="max-h-[72vh] max-w-full [background:conic-gradient(var(--surface-panel-alt)_25%,var(--surface-panel)_0_50%,var(--surface-panel-alt)_0_75%,var(--surface-panel)_0)_0_0/24px_24px]" /> : source ? <img src={source.objectUrl} alt="Selected source image" className="max-h-[72vh] max-w-full" /> : <p className="max-w-sm text-center text-sm text-[var(--text-secondary)]">Upload a PNG, JPEG, or WebP image to begin.</p>}</div></div>
  </section>;
}
