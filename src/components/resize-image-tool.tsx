"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Crop, Download, ImageIcon, RefreshCcw, Upload, X } from "lucide-react";
import { ProductionSelect } from "@/components/ui/production-select";
import { triggerBrowserDownload } from "@/lib/api-client";
import { DEVICE_PRESETS } from "@/lib/device-presets";
import {
  calculateBlurredBackgroundTransform,
  calculateFillTransform,
  calculateFitTransform,
  calculateStretchTransform,
  detectContentBounds,
  generateOutputFilename,
  getTargetDimensions,
  MAX_HEIGHT,
  MAX_SOURCE_FILE_BYTES,
  MAX_TOTAL_PIXELS,
  MAX_WIDTH,
  MIN_DIMENSION,
  validateTargetDimensions,
  type CropState,
  type FitMode,
  type ImageTransform,
  type Orientation,
  type SourceCrop,
} from "@/lib/resize-image";

type ToastTone = "info" | "success";
type OutputFormat = "png" | "jpeg" | "webp";
type BackgroundMode = "transparent" | "solid" | "blur" | "black" | "white";
type EnhancementMode = "none" | "screenshot" | "photo";

type ResizeImageToolProps = {
  showToast: (message: string, tone?: ToastTone) => void;
};

type LoadedImage = {
  fileName: string;
  mimeType: string;
  fileSize: number;
  objectUrl: string;
  image: HTMLImageElement;
};

type RenderSettings = {
  width: number;
  height: number;
  fitMode: FitMode;
  crop: CropState;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  enhancementMode: EnhancementMode;
  outputFormat: OutputFormat;
  sourceCrop: SourceCrop | null;
};

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const DEFAULT_CROP: CropState = { zoom: 1, positionX: 0, positionY: 0 };
const controlClass =
  "mt-1 h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

function loadImageFromFile(file: File) {
  return new Promise<LoadedImage>((resolve, reject) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      reject(new Error("Choose a PNG, JPEG, or WebP image."));
      return;
    }
    if (file.size > MAX_SOURCE_FILE_BYTES) {
      reject(new Error(`Image files must be ${MAX_SOURCE_FILE_BYTES / 1024 / 1024}MB or smaller.`));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (
        image.naturalWidth > MAX_WIDTH ||
        image.naturalHeight > MAX_HEIGHT ||
        image.naturalWidth * image.naturalHeight > MAX_TOTAL_PIXELS
      ) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("The source image dimensions are too large to process safely."));
        return;
      }
      resolve({ fileName: file.name, mimeType: file.type, fileSize: file.size, objectUrl, image });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected file is corrupted or could not be decoded."));
    };
    image.src = objectUrl;
  });
}

function drawTransform(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  transform: ImageTransform
) {
  context.drawImage(
    image,
    transform.sourceX,
    transform.sourceY,
    transform.sourceWidth,
    transform.sourceHeight,
    transform.destinationX,
    transform.destinationY,
    transform.destinationWidth,
    transform.destinationHeight
  );
}

function renderCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  settings: RenderSettings,
  preview = false
) {
  const previewScale = preview ? Math.min(1, 1000 / Math.max(settings.width, settings.height)) : 1;
  canvas.width = Math.max(1, Math.round(settings.width * previewScale));
  canvas.height = Math.max(1, Math.round(settings.height * previewScale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable in this browser.");
  }

  context.setTransform(previewScale, 0, 0, previewScale, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (settings.sourceCrop) {
    context.filter =
      settings.enhancementMode === "screenshot"
        ? "contrast(1.04)"
        : settings.enhancementMode === "photo"
          ? "contrast(1.02) saturate(1.02)"
          : "none";
    context.drawImage(
      image,
      settings.sourceCrop.x,
      settings.sourceCrop.y,
      settings.sourceCrop.width,
      settings.sourceCrop.height,
      0,
      0,
      settings.width,
      settings.height
    );
    return;
  }

  const transparent = settings.backgroundMode === "transparent" && settings.outputFormat === "png";
  if (!transparent) {
    const fill =
      settings.backgroundMode === "white"
        ? "#ffffff"
        : settings.backgroundMode === "solid"
          ? settings.backgroundColor
          : "#000000";
    context.fillStyle = fill;
    context.fillRect(0, 0, settings.width, settings.height);
  }

  const input = {
    sourceWidth: image.naturalWidth,
    sourceHeight: image.naturalHeight,
    targetWidth: settings.width,
    targetHeight: settings.height,
  };

  if (settings.fitMode === "blur" || (settings.fitMode === "fit" && settings.backgroundMode === "blur")) {
    context.save();
    context.filter = "blur(32px) brightness(0.72)";
    drawTransform(
      context,
      image,
      calculateFillTransform({ ...input, crop: { zoom: 1.08, positionX: 0, positionY: 0 } })
    );
    context.restore();
  }

  context.save();
  context.filter =
    settings.enhancementMode === "screenshot"
      ? "contrast(1.04)"
      : settings.enhancementMode === "photo"
        ? "contrast(1.02) saturate(1.02)"
        : "none";
  const transform =
    settings.fitMode === "fill"
      ? calculateFillTransform({ ...input, crop: settings.crop })
      : settings.fitMode === "stretch"
        ? calculateStretchTransform(input)
        : settings.fitMode === "blur"
          ? calculateBlurredBackgroundTransform(input)
          : calculateFitTransform(input);
  drawTransform(context, image, transform);
  context.restore();
}

export default function ResizeImageTool({ showToast }: ResizeImageToolProps) {
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState("xiaomi-redmi-note-10-5g");
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1920);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [fitMode, setFitMode] = useState<FitMode>("fit");
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("black");
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const [enhancementMode, setEnhancementMode] = useState<EnhancementMode>("none");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
  const [outputQuality, setOutputQuality] = useState(0.9);
  const [sourceCrop, setSourceCrop] = useState<SourceCrop | null>(null);
  const [contentWidth, setContentWidth] = useState(1080);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const selectedPreset = useMemo(
    () => DEVICE_PRESETS.find((preset) => preset.id === selectedPresetId) ?? null,
    [selectedPresetId]
  );
  const target =
    sourceCrop && loadedImage
      ? {
          width: contentWidth,
          height: Math.round((contentWidth * sourceCrop.height) / sourceCrop.width),
        }
      : getTargetDimensions(selectedPreset, customWidth, customHeight, orientation);
  const targetError = validateTargetDimensions(target.width, target.height);
  const transparencyWarning =
    fitMode === "fit" && backgroundMode === "transparent" && outputFormat !== "png"
      ? "Transparency requires PNG; export will use a black background."
      : "";
  const settings: RenderSettings = {
    width: target.width,
    height: target.height,
    fitMode,
    crop,
    backgroundMode,
    backgroundColor,
    enhancementMode,
    outputFormat,
    sourceCrop,
  };

  const loadSourceFile = useCallback(
    async (file: File, successMessage = "Image loaded.") => {
      setIsLoading(true);
      setError("");
      try {
        const nextImage = await loadImageFromFile(file);
        setLoadedImage(nextImage);
        setSourceCrop(null);
        showToast(successMessage, "success");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Image loading failed.");
        showToast("Image loading failed.");
      } finally {
        setIsLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const imageItem = Array.from(event.clipboardData?.items ?? []).find(
        (item) => item.kind === "file" && ALLOWED_IMAGE_TYPES.has(item.type)
      );
      const file = imageItem?.getAsFile();
      if (!file) return;

      event.preventDefault();
      void loadSourceFile(file, "Image pasted.");
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [loadSourceFile]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !loadedImage || targetError) {
      return;
    }
    renderCanvas(canvas, loadedImage.image, {
      width: target.width,
      height: target.height,
      fitMode,
      crop,
      backgroundMode,
      backgroundColor,
      enhancementMode,
      outputFormat,
      sourceCrop,
    }, true);
  }, [
    loadedImage,
    target.width,
    target.height,
    targetError,
    fitMode,
    crop,
    backgroundMode,
    backgroundColor,
    enhancementMode,
    outputFormat,
    sourceCrop,
  ]);

  useEffect(() => {
    return () => {
      if (loadedImage) {
        URL.revokeObjectURL(loadedImage.objectUrl);
      }
    };
  }, [loadedImage]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void loadSourceFile(file);
    event.target.value = "";
  }

  async function handleDownload() {
    if (!loadedImage || targetError) return;
    setIsProcessing(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      renderCanvas(canvas, loadedImage.image, settings);
      const mimeType = `image/${outputFormat}`;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("Image export failed."))),
          mimeType,
          outputFormat === "png" ? undefined : outputQuality
        );
      });
      triggerBrowserDownload(
        blob,
        generateOutputFilename(
          loadedImage.fileName,
          sourceCrop
            ? `trimmed-${target.width}x${target.height}`
            : selectedPreset?.id ?? `${customWidth}x${customHeight}`,
          sourceCrop ? (target.width >= target.height ? "landscape" : "portrait") : orientation,
          outputFormat
        )
      );
      showToast("Image downloaded.", "success");
      canvas.width = 1;
      canvas.height = 1;
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : "Image export failed.";
      setError(message);
      showToast(message);
    } finally {
      setIsProcessing(false);
    }
  }

  function clearImage() {
    setLoadedImage(null);
    setSourceCrop(null);
    setError("");
  }

  function trimEmptySpace() {
    if (!loadedImage) return;

    const scanScale = Math.min(1, 512 / Math.max(loadedImage.image.naturalWidth, loadedImage.image.naturalHeight));
    const scanWidth = Math.max(1, Math.round(loadedImage.image.naturalWidth * scanScale));
    const scanHeight = Math.max(1, Math.round(loadedImage.image.naturalHeight * scanScale));
    const canvas = document.createElement("canvas");
    canvas.width = scanWidth;
    canvas.height = scanHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      setError("Canvas is unavailable in this browser.");
      return;
    }

    context.drawImage(loadedImage.image, 0, 0, scanWidth, scanHeight);
    const detected = detectContentBounds(
      context.getImageData(0, 0, scanWidth, scanHeight).data,
      scanWidth,
      scanHeight
    );
    if (!detected) {
      setError("No visible content was detected.");
      return;
    }

    const x = Math.floor(detected.x / scanScale);
    const y = Math.floor(detected.y / scanScale);
    const right = Math.ceil((detected.x + detected.width) / scanScale);
    const bottom = Math.ceil((detected.y + detected.height) / scanScale);
    const crop = {
      x,
      y,
      width: Math.min(loadedImage.image.naturalWidth, right) - x,
      height: Math.min(loadedImage.image.naturalHeight, bottom) - y,
    };
    setSourceCrop(crop);
    setError("");
    showToast(`Trimmed to ${crop.width} × ${crop.height}.`, "success");
  }

  function handlePreviewPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (fitMode !== "fill") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY };
  }

  function handlePreviewPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current || fitMode !== "fill") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setCrop((current) => ({
      ...current,
      positionX: Math.max(-1, Math.min(1, current.positionX - (deltaX / rect.width) * 2)),
      positionY: Math.max(-1, Math.min(1, current.positionY - (deltaY / rect.height) * 2)),
    }));
  }

  return (
    <section className="grid gap-4">
        <aside className="ui-surface-panel order-2 grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-3">
          <section className="border-b border-[var(--rule-default)] pb-5 md:border-b-0 md:border-r md:pb-0 md:pr-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">1. Source</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Choose or paste the screenshot, then remove unused borders if needed.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={handleFileChange}
            />
            {!loadedImage ? (
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="pressable ui-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {isLoading ? "Reading image..." : "Upload image"}
                </button>
                <p className="text-center text-xs text-[var(--text-muted)]">
                  Or paste an image with{" "}
                  <kbd className="rounded-[var(--radius-xs)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-1.5 py-0.5 font-mono text-[var(--text-secondary)]">
                    Ctrl/⌘ V
                  </kbd>
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3 text-sm text-[var(--text-secondary)]">
                <div className={`border-l-2 p-3 ${sourceCrop ? "border-[var(--action-primary-bg)] bg-[var(--surface-panel-alt)]" : "border-[var(--border-strong)] bg-[var(--surface-panel-alt)]"}`}>
                  <p className="truncate font-semibold text-[var(--text-primary)]">{loadedImage.fileName}</p>
                  <p className="mt-1">
                    {loadedImage.image.naturalWidth} × {loadedImage.image.naturalHeight} ·{" "}
                    {(loadedImage.fileSize / 1024 / 1024).toFixed(2)}MB
                  </p>
                  <p className="mt-1">
                    {loadedImage.mimeType} · {(loadedImage.image.naturalWidth / loadedImage.image.naturalHeight).toFixed(3)} ratio
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="pressable ui-btn-secondary inline-flex h-11 items-center justify-center gap-2 px-3">
                    <RefreshCcw className="h-4 w-4" /> Replace
                  </button>
                  <button type="button" onClick={clearImage} className="pressable ui-btn-secondary inline-flex h-11 items-center justify-center gap-2 px-3">
                    <X className="h-4 w-4" /> Clear
                  </button>
                </div>
                <button
                  type="button"
                  onClick={trimEmptySpace}
                  className="pressable ui-btn-secondary inline-flex h-11 w-full items-center justify-center gap-2 px-3 font-semibold"
                >
                  <Crop className="h-4 w-4" />
                  {sourceCrop ? "Detect trim again" : "Trim empty space"}
                </button>
              </div>
            )}
          </section>

          <section className="space-y-3 border-b border-[var(--rule-default)] pb-5 md:border-b-0 md:pb-0 xl:border-r xl:pr-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">2. Output frame</h3>
            {sourceCrop ? (
              <>
                <div className="border-l-2 border-[var(--action-primary-bg)] bg-[var(--surface-panel-alt)] p-3 text-xs text-[var(--text-secondary)]">
                  <p className="font-semibold text-[var(--text-accent)]">Trim active</p>
                  <p className="mt-1">
                    Source crop {sourceCrop.width} × {sourceCrop.height}; output height follows the width.
                  </p>
                </div>
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  Output width
                  <input
                    type="number"
                    min={MIN_DIMENSION}
                    max={MAX_WIDTH}
                    value={contentWidth}
                    onChange={(event) => setContentWidth(Number(event.target.value))}
                    className={controlClass}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setSourceCrop(null)}
                  className="pressable ui-btn-secondary inline-flex h-11 w-full items-center justify-center px-3 text-sm font-semibold"
                >
                  Restore full image
                </button>
              </>
            ) : (
              <>
                <div>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Device preset</span>
                  <ProductionSelect
                    value={selectedPresetId}
                    onValueChange={setSelectedPresetId}
                    ariaLabel="Device preset"
                    options={[
                      ...DEVICE_PRESETS.map((preset) => ({
                        value: preset.id,
                        label: `${preset.brand} · ${preset.model}`,
                      })),
                      { value: "custom", label: "Custom dimensions" },
                    ]}
                    triggerClassName="mt-1 h-11"
                  />
                </div>
                {!selectedPreset ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      Width
                      <input type="number" min="64" max={MAX_WIDTH} value={customWidth} onChange={(event) => setCustomWidth(Number(event.target.value))} className={controlClass} />
                    </label>
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      Height
                      <input type="number" min="64" max={MAX_HEIGHT} value={customHeight} onChange={(event) => setCustomHeight(Number(event.target.value))} className={controlClass} />
                    </label>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <ProductionSelect
                    value={orientation}
                    onValueChange={setOrientation}
                    ariaLabel="Orientation"
                    options={[
                      { value: "portrait", label: "Portrait" },
                      { value: "landscape", label: "Landscape" },
                    ]}
                    className="text-xs font-medium text-[var(--text-secondary)]"
                    triggerClassName="mt-1 h-11"
                    label="Orientation"
                  />
                  <ProductionSelect
                    value={fitMode}
                    onValueChange={setFitMode}
                    ariaLabel="Fit"
                    options={[
                      { value: "fit", label: "Fit" },
                      { value: "fill", label: "Fill / crop" },
                      { value: "stretch", label: "Stretch" },
                      { value: "blur", label: "Blurred background" },
                    ]}
                    className="text-xs font-medium text-[var(--text-secondary)]"
                    triggerClassName="mt-1 h-11"
                    label="Fit"
                  />
                </div>

                {fitMode === "fill" ? (
                  <div className="space-y-2 border-t border-[var(--rule-default)] pt-3">
                    <RangeControl label="Zoom" min={1} max={3} step={0.01} value={crop.zoom} onChange={(zoom) => setCrop((current) => ({ ...current, zoom }))} />
                    <RangeControl label="Horizontal" min={-1} max={1} step={0.01} value={crop.positionX} onChange={(positionX) => setCrop((current) => ({ ...current, positionX }))} />
                    <RangeControl label="Vertical" min={-1} max={1} step={0.01} value={crop.positionY} onChange={(positionY) => setCrop((current) => ({ ...current, positionY }))} />
                    <button type="button" onClick={() => setCrop(DEFAULT_CROP)} className="text-xs font-semibold text-[var(--text-accent)]">Center and reset</button>
                  </div>
                ) : null}

                {fitMode === "fit" ? (
                  <div className="grid grid-cols-[1fr_48px] items-end gap-2 border-t border-[var(--rule-default)] pt-3">
                    <ProductionSelect
                      value={backgroundMode}
                      onValueChange={setBackgroundMode}
                      ariaLabel="Background"
                      options={[
                        { value: "black", label: "Black" },
                        { value: "white", label: "White" },
                        { value: "transparent", label: "Transparent" },
                        { value: "solid", label: "Custom color" },
                        { value: "blur", label: "Blurred image" },
                      ]}
                      triggerClassName="mt-1 h-11"
                      label="Background"
                    />
                    {backgroundMode === "solid" ? (
                      <input aria-label="Background color" type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} className="ui-color-cell h-10 w-12 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-default)]" />
                    ) : <span />}
                  </div>
                ) : null}
                {fitMode === "stretch" ? <p className="text-xs text-[var(--state-warning)]">Stretch may visibly distort the source image.</p> : null}
              </>
            )}
          </section>

          <section className="space-y-3 md:col-span-2 xl:col-span-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">3. Export</h3>
            <div className="grid grid-cols-2 gap-2">
              <ProductionSelect
                value={enhancementMode}
                onValueChange={setEnhancementMode}
                ariaLabel="Enhancement"
                options={[
                  { value: "none", label: "None" },
                  { value: "screenshot", label: "Screenshot" },
                  { value: "photo", label: "Photo" },
                ]}
                triggerClassName="mt-1 h-11"
                label="Enhancement"
              />
              <ProductionSelect
                value={outputFormat}
                onValueChange={setOutputFormat}
                ariaLabel="Format"
                options={[
                  { value: "png", label: "PNG" },
                  { value: "jpeg", label: "JPEG" },
                  { value: "webp", label: "WebP" },
                ]}
                triggerClassName="mt-1 h-11"
                label="Format"
              />
            </div>
            {outputFormat !== "png" ? (
              <RangeControl label={`Quality ${Math.round(outputQuality * 100)}%`} min={0.5} max={1} step={0.01} value={outputQuality} onChange={setOutputQuality} />
            ) : null}
            <div className="flex items-center justify-between gap-3 border-y border-[var(--rule-default)] py-2 font-mono text-xs">
              <span className="text-[var(--text-muted)]">Final size</span>
              <span className="font-semibold text-[var(--text-primary)]">{target.width} × {target.height}px</span>
            </div>
            {transparencyWarning ? <p className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--state-warning-soft)] p-2.5 text-xs text-[var(--state-warning)]">{transparencyWarning}</p> : null}
            {targetError ? <p className="rounded-[var(--radius-control)] border border-[color-mix(in_oklab,var(--state-danger)_35%,transparent)] bg-[var(--state-danger-soft)] p-2.5 text-xs text-[var(--state-danger)]">{targetError}</p> : null}
            {error ? <p className="rounded-[var(--radius-control)] border border-[color-mix(in_oklab,var(--state-danger)_35%,transparent)] bg-[var(--state-danger-soft)] p-2.5 text-xs text-[var(--state-danger)]">{error}</p> : null}
            <button
              type="button"
              onClick={handleDownload}
              disabled={!loadedImage || Boolean(targetError) || isProcessing}
              className="pressable ui-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isProcessing ? "Exporting..." : `Download ${outputFormat.toUpperCase()}`}
            </button>
          </section>
        </aside>

        <div className="ui-surface-elevated order-1 p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Output preview</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {fitMode === "fill" ? "Drag the image to reposition the crop." : "Preview and export share the same layout calculations."}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-xs font-semibold text-[var(--text-primary)]">{target.width} × {target.height}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <ImageIcon className="h-3.5 w-3.5" /> {sourceCrop ? "trimmed content" : orientation}
              </p>
            </div>
          </div>
          <div className={`flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] shadow-[var(--elevation-subtle)] ${loadedImage && !targetError ? "p-3" : "min-h-64 p-4"}`}>
            {loadedImage && !targetError ? (
              <canvas
                ref={previewCanvasRef}
                onPointerDown={handlePreviewPointerDown}
                onPointerMove={handlePreviewPointerMove}
                onPointerUp={() => { dragRef.current = null; }}
                onPointerCancel={() => { dragRef.current = null; }}
                className={`block max-h-[72vh] max-w-full touch-none shadow-[var(--elevation-raised)] ${fitMode === "fill" ? "cursor-grab active:cursor-grabbing" : ""}`}
                style={{ aspectRatio: `${target.width} / ${target.height}` }}
              />
            ) : (
              <p className="max-w-sm text-center text-sm text-[var(--text-secondary)]">
                Upload or paste a PNG, JPEG, or WebP image to generate the device preview.
              </p>
            )}
          </div>
        </div>
    </section>
  );
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs font-medium text-[var(--text-secondary)]">
      <span className="flex justify-between gap-2"><span>{label}</span><span>{value.toFixed(2)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full accent-[var(--action-primary-bg)]" />
    </label>
  );
}
