"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import { Check, Clipboard, Copy, Download, FileImage, Link2, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { triggerBrowserDownload } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ToastTone = "info" | "success";

type QRGeneratorToolProps = {
  showToast: (message: string, tone?: ToastTone) => void;
};

type QRExportMode = "qr" | "card";
type QRSizePreset = "slide" | "print" | "social";
type QRPresetId = "fellowship" | "giving" | "connect" | "prayer" | "livestream" | "notes" | "custom";

type QRPreset = {
  id: QRPresetId;
  label: string;
  title: string;
  subtitle: string;
  filename: string;
};

const QR_PRESETS: QRPreset[] = [
  {
    id: "fellowship",
    label: "Fellowship Pre-Reg",
    title: "Fellowship Pre-Registration",
    subtitle: "Scan to reserve your spot.",
    filename: "fellowship-pre-reg",
  },
  { id: "giving", label: "Giving", title: "Give Online", subtitle: "Scan to open the giving link.", filename: "giving-qr" },
  { id: "connect", label: "Connect Card", title: "Connect With Us", subtitle: "Scan to fill out a connect card.", filename: "connect-card" },
  { id: "prayer", label: "Prayer Request", title: "Prayer Request", subtitle: "Scan to share a prayer request.", filename: "prayer-request" },
  { id: "livestream", label: "Livestream", title: "Watch Online", subtitle: "Scan to open the livestream.", filename: "livestream" },
  { id: "notes", label: "Sermon Notes", title: "Sermon Notes", subtitle: "Scan to follow along.", filename: "sermon-notes" },
  { id: "custom", label: "Custom", title: "", subtitle: "", filename: "qr-code" },
];

const SIZE_PRESETS: Record<QRSizePreset, { label: string; qrPixels: number; cardWidth: number; cardHeight: number }> = {
  slide: { label: "Slide", qrPixels: 720, cardWidth: 1200, cardHeight: 900 },
  print: { label: "Print", qrPixels: 1000, cardWidth: 1200, cardHeight: 1600 },
  social: { label: "Social", qrPixels: 1080, cardWidth: 1080, cardHeight: 1080 },
};

const URL_LIKE_PATTERN = /^(https?:\/\/|mailto:|tel:|sms:|www\.)\S+/i;

function isUrlLike(value: string) {
  return URL_LIKE_PATTERN.test(value.trim());
}

function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "qr-code"
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (context.measureText(testLine).width <= maxWidth || !current) {
      current = testLine;
    } else {
      lines.push(current);
      current = word;
    }

    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);

  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });
}

export default function QRGeneratorTool({ showToast }: QRGeneratorToolProps) {
  const [presetId, setPresetId] = useState<QRPresetId>("fellowship");
  const [destination, setDestination] = useState("");
  const [exportMode, setExportMode] = useState<QRExportMode>("card");
  const [sizePreset, setSizePreset] = useState<QRSizePreset>("slide");
  const [title, setTitle] = useState(QR_PRESETS[0].title);
  const [subtitle, setSubtitle] = useState(QR_PRESETS[0].subtitle);
  const [filename, setFilename] = useState(QR_PRESETS[0].filename);
  const [foreground, setForeground] = useState("#111827");
  const [background, setBackground] = useState("#ffffff");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [error, setError] = useState("");
  const manualFieldsRef = useRef({ title: false, subtitle: false, filename: false });

  const trimmedDestination = destination.trim();
  const activeSize = SIZE_PRESETS[sizePreset];
  const selectedPreset = QR_PRESETS.find((preset) => preset.id === presetId) ?? QR_PRESETS[0];
  const canExport = Boolean(trimmedDestination && qrDataUrl && !error);
  const hasUrlWarning = Boolean(trimmedDestination && !isUrlLike(trimmedDestination));
  const hasDensityWarning = trimmedDestination.length > 160;
  const downloadBaseName = sanitizeFileName(filename || selectedPreset.filename || title || "qr-code");

  useEffect(() => {
    if (!trimmedDestination) {
      return;
    }

    let cancelled = false;
    const options = {
      errorCorrectionLevel: "M" as const,
      margin: 2,
      width: activeSize.qrPixels,
      color: {
        dark: foreground,
        light: background,
      },
    };

    Promise.all([QRCode.toDataURL(trimmedDestination, options), QRCode.toString(trimmedDestination, { ...options, type: "svg" as const })])
      .then(([nextDataUrl, nextSvg]) => {
        if (cancelled) return;
        setQrDataUrl(nextDataUrl);
        setQrSvg(nextSvg);
        setError("");
      })
      .catch(() => {
        if (cancelled) return;
        setQrDataUrl("");
        setQrSvg("");
        setError("QR generation failed. Try a shorter value or different colors.");
      });

    return () => {
      cancelled = true;
    };
  }, [activeSize.qrPixels, background, foreground, trimmedDestination]);

  function applyPreset(nextPresetId: QRPresetId) {
    const nextPreset = QR_PRESETS.find((preset) => preset.id === nextPresetId) ?? QR_PRESETS[0];
    setPresetId(nextPresetId);

    if (nextPreset.id === "custom") return;
    if (!manualFieldsRef.current.title) setTitle(nextPreset.title);
    if (!manualFieldsRef.current.subtitle) setSubtitle(nextPreset.subtitle);
    if (!manualFieldsRef.current.filename) setFilename(nextPreset.filename);
  }

  async function renderCardDataUrl() {
    if (!qrDataUrl) throw new Error("QR is not ready yet.");

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");

    canvas.width = activeSize.cardWidth;
    canvas.height = activeSize.cardHeight;

    context.fillStyle = "#f8fafc";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const padding = Math.round(canvas.width * 0.08);
    const qrImage = await loadImage(qrDataUrl);
    const titleText = title.trim() || selectedPreset.title || "Scan the QR Code";
    const subtitleText = subtitle.trim();
    const qrSize = Math.min(Math.round(canvas.width * 0.62), Math.round(canvas.height * 0.55));
    const qrX = Math.round((canvas.width - qrSize) / 2);
    const qrY = exportMode === "card" ? Math.round(canvas.height * 0.37) : Math.round((canvas.height - qrSize) / 2);

    context.fillStyle = "#111827";
    context.textAlign = "center";
    context.textBaseline = "top";
    context.font = `700 ${Math.round(canvas.width * 0.055)}px sans-serif`;
    drawWrappedText(context, titleText, canvas.width / 2, padding, canvas.width - padding * 2, Math.round(canvas.width * 0.075), 2);

    if (subtitleText) {
      context.fillStyle = "#475569";
      context.font = `400 ${Math.round(canvas.width * 0.032)}px sans-serif`;
      drawWrappedText(context, subtitleText, canvas.width / 2, Math.round(canvas.height * 0.22), canvas.width - padding * 2, Math.round(canvas.width * 0.048), 2);
    }

    context.fillStyle = background;
    context.fillRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48);
    context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    return canvas.toDataURL("image/png");
  }

  async function currentPngDataUrl() {
    if (exportMode === "card") return renderCardDataUrl();
    if (!qrDataUrl) throw new Error("QR is not ready yet.");
    return qrDataUrl;
  }

  async function downloadPng() {
    try {
      const dataUrl = await currentPngDataUrl();
      const blob = await dataUrlToBlob(dataUrl);
      triggerBrowserDownload(blob, `${downloadBaseName}.png`);
      showToast("PNG downloaded.", "success");
    } catch (downloadError) {
      showToast(downloadError instanceof Error ? downloadError.message : "Could not download PNG.");
    }
  }

  function downloadSvg() {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml;charset=utf-8" });
    triggerBrowserDownload(blob, `${downloadBaseName}.svg`);
    showToast("SVG downloaded.", "success");
  }

  async function copyImage() {
    try {
      const dataUrl = await currentPngDataUrl();
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
        showToast("Image clipboard is not available here. Use download instead.");
        return;
      }

      const blob = await dataUrlToBlob(dataUrl);
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast("Image copied.", "success");
    } catch {
      showToast("Could not copy image. Use download instead.");
    }
  }

  async function copySource() {
    if (!trimmedDestination) return;
    try {
      await navigator.clipboard.writeText(trimmedDestination);
      showToast("Source copied.", "success");
    } catch {
      showToast("Could not copy source text.");
    }
  }

  const warningText = useMemo(() => {
    if (hasDensityWarning) return "Long values can make QR codes dense and harder to scan.";
    if (hasUrlWarning) return "This does not look like a web link, but it can still be encoded.";
    return "";
  }, [hasDensityWarning, hasUrlWarning]);

  return (
    <section className="production-panel p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.82fr)_minmax(360px,1fr)]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="technical-label" id="qr-preset-label">Preset</label>
              <Select
                value={presetId}
                onValueChange={(value) => applyPreset(value as QRPresetId)}
              >
                <SelectTrigger aria-labelledby="qr-preset-label" className="mt-1 h-10 w-full border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-[var(--text-primary)] hover:bg-[var(--surface-panel-strong)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-1.5 shadow-[var(--elevation-raised)]">
                  {QR_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id} className="min-h-9 px-2 py-2 pr-8 font-medium">
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="technical-label" id="qr-size-label">Output Size</label>
              <Select
                value={sizePreset}
                onValueChange={(value) => setSizePreset(value as QRSizePreset)}
              >
                <SelectTrigger aria-labelledby="qr-size-label" className="mt-1 h-10 w-full border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-[var(--text-primary)] hover:bg-[var(--surface-panel-strong)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-1.5 shadow-[var(--elevation-raised)]">
                  {Object.entries(SIZE_PRESETS).map(([id, preset]) => (
                    <SelectItem key={id} value={id} className="min-h-9 px-2 py-2 pr-8 font-medium">
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="block">
            <span className="technical-label">Destination URL or Text</span>
            <textarea
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              rows={4}
              className="mt-1 w-full resize-none rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-4 py-3 text-sm leading-6 text-[var(--text-primary)] outline-none transition focus:border-[var(--border-focus)]"
              placeholder="https://example.com/pre-register"
            />
          </label>

          {warningText ? (
            <p className="rounded-[var(--radius-control)] border border-[color-mix(in_oklab,var(--state-warning)_28%,transparent)] bg-[var(--state-warning-soft)] px-3 py-2 text-xs font-semibold text-[var(--state-warning)]">{warningText}</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="technical-label" id="qr-export-mode-label">Export Mode</label>
              <Select
                value={exportMode}
                onValueChange={(value) => setExportMode(value as QRExportMode)}
              >
                <SelectTrigger aria-labelledby="qr-export-mode-label" className="mt-1 h-10 w-full border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-[var(--text-primary)] hover:bg-[var(--surface-panel-strong)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-1.5 shadow-[var(--elevation-raised)]">
                  <SelectItem value="card" className="min-h-9 px-2 py-2 pr-8 font-medium">Labeled Card</SelectItem>
                  <SelectItem value="qr" className="min-h-9 px-2 py-2 pr-8 font-medium">QR Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="block">
              <span className="technical-label">Filename</span>
              <input
                value={filename}
                onChange={(event) => {
                  manualFieldsRef.current.filename = true;
                  setFilename(event.target.value);
                }}
                className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-focus)]"
              />
            </label>
          </div>

          <div className={exportMode === "card" ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
            <label className="block">
              <span className="technical-label">Title</span>
              <input
                value={title}
                onChange={(event) => {
                  manualFieldsRef.current.title = true;
                  setTitle(event.target.value);
                }}
                className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-focus)]"
              />
            </label>

            <label className="block">
              <span className="technical-label">Subtitle</span>
              <input
                value={subtitle}
                onChange={(event) => {
                  manualFieldsRef.current.subtitle = true;
                  setSubtitle(event.target.value);
                }}
                className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-focus)]"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="technical-label">Foreground</span>
              <span className="mt-1 flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2">
                <input type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} className="h-8 w-10 bg-transparent" />
                <span className="font-[var(--font-mono)] text-sm font-semibold text-[var(--text-primary)]">{foreground.toUpperCase()}</span>
              </span>
            </label>

            <label className="block">
              <span className="technical-label">Background</span>
              <span className="mt-1 flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2">
                <input type="color" value={background} onChange={(event) => setBackground(event.target.value)} className="h-8 w-10 bg-transparent" />
                <span className="font-[var(--font-mono)] text-sm font-semibold text-[var(--text-primary)]">{background.toUpperCase()}</span>
              </span>
            </label>
          </div>
        </div>

        <div className="ui-surface-panel flex min-h-[520px] flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              {exportMode === "card" ? <FileImage className="h-4 w-4 text-[var(--state-ready)]" /> : <QrCode className="h-4 w-4 text-[var(--state-ready)]" />}
              {exportMode === "card" ? "Labeled Card" : "QR Only"}
            </div>
            <span className="font-[var(--font-mono)] text-xs font-semibold text-[var(--text-secondary)]">
              {exportMode === "card" ? `${activeSize.cardWidth}x${activeSize.cardHeight}` : `${activeSize.qrPixels}x${activeSize.qrPixels}`}
            </span>
          </div>

          <div className="flex flex-1 items-center justify-center p-5">
            {!trimmedDestination ? (
              <div className="flex max-w-xs flex-col items-center text-center text-sm text-[var(--text-secondary)]">
                <Link2 className="mb-3 h-8 w-8 text-[var(--state-ready)]" />
                Enter a link or text value to generate a QR asset.
              </div>
            ) : error ? (
              <p className="max-w-xs text-center text-sm font-semibold text-[var(--state-danger)]">{error}</p>
            ) : exportMode === "card" ? (
              <div className="w-full max-w-[430px] rounded-lg bg-slate-50 p-7 text-center text-slate-900">
                <p className="text-2xl font-bold leading-tight">{title.trim() || selectedPreset.title || "Scan the QR Code"}</p>
                {subtitle.trim() ? <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">{subtitle}</p> : null}
                <div className="mx-auto mt-7 flex w-full max-w-[260px] items-center justify-center bg-white p-4">
                  {qrDataUrl ? (
                    <NextImage src={qrDataUrl} alt="Generated QR code preview" width={260} height={260} unoptimized className="h-full w-full" />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex w-full max-w-[320px] items-center justify-center bg-white p-4">
                {qrDataUrl ? <NextImage src={qrDataUrl} alt="Generated QR code preview" width={320} height={320} unoptimized className="h-full w-full" /> : null}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border-default)] p-4">
            <button
              type="button"
              onClick={copySource}
              disabled={!trimmedDestination}
              className="pressable ui-btn-secondary inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Copy className="h-4 w-4" />
              Copy Source
            </button>
            <button
              type="button"
              onClick={copyImage}
              disabled={!canExport}
              className="pressable ui-btn-secondary inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Clipboard className="h-4 w-4" />
              Copy PNG
            </button>
            {exportMode === "qr" ? (
              <button
                type="button"
                onClick={downloadSvg}
                disabled={!canExport}
                className="pressable ui-btn-secondary inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                SVG
              </button>
            ) : null}
            <button
              type="button"
              onClick={downloadPng}
              disabled={!canExport}
              className="pressable ui-btn-primary inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              PNG
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
