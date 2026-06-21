"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageIcon, RefreshCcw, Upload, X } from "lucide-react";
import { triggerBrowserDownload } from "@/lib/api-client";
import {
  calculateContainLayout,
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
} from "@/lib/resize-image";

type ToastTone = "info" | "success";

type ResizeImageToolProps = {
  showToast: (message: string, tone?: ToastTone) => void;
};

type LoadedImage = {
  fileName: string;
  objectUrl: string;
  image: HTMLImageElement;
};

function loadImageFromFile(file: File) {
  return new Promise<LoadedImage>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        fileName: file.name.replace(/\.[^/.]+$/, "") || "resize-image",
        objectUrl,
        image,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected file could not be opened as an image."));
    };
    image.src = objectUrl;
  });
}

function renderPresentationCanvas(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable.");
  }

  canvas.width = PRESENTATION_WIDTH;
  canvas.height = PRESENTATION_HEIGHT;

  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const layout = calculateContainLayout({
    sourceWidth: image.naturalWidth,
    sourceHeight: image.naturalHeight,
    targetWidth: canvas.width,
    targetHeight: canvas.height,
  });

  context.drawImage(image, layout.offsetX, layout.offsetY, layout.drawWidth, layout.drawHeight);
}

export default function ResizeImageTool({ showToast }: ResizeImageToolProps) {
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!previewCanvasRef.current) {
      return;
    }

    const canvas = previewCanvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    if (!loadedImage) {
      canvas.width = PRESENTATION_WIDTH;
      canvas.height = PRESENTATION_HEIGHT;
      context.fillStyle = "#000000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    renderPresentationCanvas(canvas, loadedImage.image);
  }, [loadedImage]);

  useEffect(() => {
    return () => {
      if (loadedImage) {
        URL.revokeObjectURL(loadedImage.objectUrl);
      }
    };
  }, [loadedImage]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const nextImage = await loadImageFromFile(file);
      setLoadedImage((current) => {
        if (current) {
          URL.revokeObjectURL(current.objectUrl);
        }
        return nextImage;
      });
      showToast("Image loaded.", "success");
    } catch (loadError) {
      setLoadedImage((current) => {
        if (current) {
          URL.revokeObjectURL(current.objectUrl);
        }
        return null;
      });
      setError(loadError instanceof Error ? loadError.message : "Image loading failed.");
      showToast("Image loading failed.");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  }

  async function handleDownload() {
    if (!loadedImage) {
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      renderPresentationCanvas(canvas, loadedImage.image);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
            return;
          }

          reject(new Error("PNG export failed."));
        }, "image/png");
      });

      triggerBrowserDownload(blob, `${loadedImage.fileName}-1920x1080.png`);
      showToast("PNG downloaded.", "success");
    } catch (downloadError) {
      showToast(downloadError instanceof Error ? downloadError.message : "PNG export failed.");
    }
  }

  function handleReplaceImage() {
    fileInputRef.current?.click();
  }

  function handleClearImage() {
    setLoadedImage((current) => {
      if (current) {
        URL.revokeObjectURL(current.objectUrl);
      }
      return null;
    });
    setError("");
  }

  return (
    <div className="space-y-5">
      <section className="ui-surface-elevated p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Resize Image</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Fit one image into a 1920x1080 presentation frame without cropping. Extra space stays black.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-panel)] p-4">
              <p className="technical-label">INPUT</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Upload a single image and export a fixed 16:9 PNG slide.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />

              {!loadedImage ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="pressable mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {isLoading ? "Loading image..." : "Upload image"}
                </button>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-3 text-sm text-[var(--text-secondary)]">
                    <p className="font-semibold text-[var(--text-primary)]">{loadedImage.fileName}</p>
                    <p className="mt-1">
                      {loadedImage.image.naturalWidth} x {loadedImage.image.naturalHeight} source
                    </p>
                    <p className="mt-1">1920 x 1080 PNG output</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="pressable inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--action-primary-ink)]"
                  >
                    <Download className="h-4 w-4" />
                    Download PNG
                  </button>

                  <button
                    type="button"
                    onClick={handleReplaceImage}
                    className="pressable inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Replace image
                  </button>

                  <button
                    type="button"
                    onClick={handleClearImage}
                    className="pressable inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-4 w-4" />
                    Clear image
                  </button>
                </div>
              )}

              {error ? (
                <p className="mt-3 text-sm text-[var(--state-danger)]">{error}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-panel)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="technical-label">PREVIEW</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Final frame matches the exported PNG.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                <ImageIcon className="h-3.5 w-3.5" />
                16:9
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-black">
              <canvas
                ref={previewCanvasRef}
                width={PRESENTATION_WIDTH}
                height={PRESENTATION_HEIGHT}
                className="block aspect-video h-auto w-full"
              />
            </div>

            {!loadedImage ? (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Upload an image to preview how it will sit inside the 1920x1080 frame.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
