"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, Download, ImageIcon, Loader2, RefreshCcw, RotateCcw, ShieldCheck, Sparkles, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  downloadGeneratedBackground,
  estimateBackgroundGeneration,
  fetchGeneratedBackgrounds,
  generateBackground,
  getGeneratedBackgroundPreviewUrl,
  triggerBrowserDownload,
  type BackgroundGenerationEstimateRecord,
  type BackgroundGenerationRequestPayload,
  type GeneratedOutputRecord,
} from "@/lib/api-client";

type BackgroundGeneratorToolProps = {
  showToast: (message: string, tone?: "success" | "info") => void;
};

type MoodValue = BackgroundGenerationRequestPayload["mood"];
type VisualStyleValue = BackgroundGenerationRequestPayload["visualStyle"];
type BackgroundGeneratorFormState = Omit<BackgroundGenerationRequestPayload, "mood" | "visualStyle"> & {
  mood: MoodValue | "";
  visualStyle: VisualStyleValue | "";
};
type BackgroundStage = "data-entry" | "estimation" | "output";

const purposes = [
  ["lyrics", "Lyrics"],
  ["sermon", "Sermon"],
  ["scripture", "Scripture"],
  ["offering", "Offering"],
  ["announcements", "Announcements"],
  ["general-worship", "General Worship"],
] as const;

const moods = [
  ["reverent", "Reverent"],
  ["joyful", "Joyful"],
  ["reflective", "Reflective"],
  ["hopeful", "Hopeful"],
  ["quiet", "Quiet"],
  ["celebration", "Celebration"],
] as const;

const visualStyles = [
  ["abstract-light", "Abstract Light"],
  ["soft-landscape", "Soft Landscape"],
  ["stained-glass", "Stained Glass"],
  ["minimal-texture", "Minimal Texture"],
  ["warm-stage-wash", "Stage Wash"],
  ["atmospheric-clouds", "Atmospheric Clouds"],
] as const;

const textSafeAreas = [
  ["center-clear", "Center Clear"],
  ["lower-third-clear", "Lower Third Clear"],
  ["full-frame", "Full Frame"],
] as const;

const stageOrder: BackgroundStage[] = ["data-entry", "estimation", "output"];

const stageLabels: Record<BackgroundStage, string> = {
  "data-entry": "Data Entry",
  estimation: "Estimation",
  output: "Output",
};

export default function BackgroundGeneratorTool({ showToast }: BackgroundGeneratorToolProps) {
  const queryClient = useQueryClient();
  const [activeStage, setActiveStage] = useState<BackgroundStage>("data-entry");
  const [request, setRequest] = useState<BackgroundGeneratorFormState>({
    mediaType: "image",
    purpose: "lyrics",
    mood: "",
    visualStyle: "",
    textSafeArea: "center-clear",
  });
  const [estimate, setEstimate] = useState<BackgroundGenerationEstimateRecord | null>(null);
  const [generatedOutput, setGeneratedOutput] = useState<GeneratedOutputRecord | null>(null);
  const [previewOutput, setPreviewOutput] = useState<GeneratedOutputRecord | null>(null);

  const backgroundsQuery = useQuery({
    queryKey: ["media-backgrounds"],
    queryFn: fetchGeneratedBackgrounds,
  });

  const estimateMutation = useMutation({
    mutationFn: estimateBackgroundGeneration,
    onSuccess: (response) => {
      setEstimate(response.estimate);
      setGeneratedOutput(null);
      setActiveStage("estimation");
      showToast("Generation estimate ready.", "success");
    },
    onError: (error: Error) => showToast(error.message),
  });

  const generateMutation = useMutation({
    mutationFn: generateBackground,
    onSuccess: async (response) => {
      setGeneratedOutput(response.output);
      await queryClient.invalidateQueries({ queryKey: ["media-backgrounds"] });
      setEstimate(null);
      setRequest((current) => ({ ...current, mood: "", visualStyle: "" }));
      setActiveStage("output");
      showToast("Background generated.", "success");
    },
    onError: (error: Error) => showToast(error.message),
  });

  const updateRequest = (patch: Partial<BackgroundGeneratorFormState>) => {
    setEstimate(null);
    setGeneratedOutput(null);
    setRequest((current) => ({ ...current, ...patch }));
  };

  const resetProcess = () => {
    if (generateMutation.isPending) {
      showToast("Wait for generation to finish before returning to Data Entry.");
      return;
    }

    setActiveStage("data-entry");
    setEstimate(null);
    setGeneratedOutput(null);
    setRequest((current) => ({ ...current, mood: "", visualStyle: "" }));
  };

  const getValidatedRequest = () => {
    if (!request.mood || !request.visualStyle) {
      showToast("Choose both Mood and Style before validating the estimate.");
      return null;
    }

    return {
      ...request,
      mood: request.mood,
      visualStyle: request.visualStyle,
    } satisfies BackgroundGenerationRequestPayload;
  };

  const handleEstimate = () => {
    const validatedRequest = getValidatedRequest();
    if (!validatedRequest) return;

    estimateMutation.mutate(validatedRequest);
  };

  const handleGenerate = () => {
    if (!estimate) {
      showToast("Review the estimate before generating.");
      return;
    }

    const validatedRequest = getValidatedRequest();
    if (!validatedRequest) return;

    generateMutation.mutate({ request: validatedRequest, acceptedEstimate: estimate });
  };

  const handleDownload = async (outputId: string, options: { resetAfterDownload?: boolean } = {}) => {
    try {
      const download = await downloadGeneratedBackground(outputId);
      triggerBrowserDownload(download.blob, download.fileName);
      if (options.resetAfterDownload) {
        resetProcess();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Download failed");
    }
  };

  const stageIndex = stageOrder.indexOf(activeStage);
  const recentBackgrounds = (backgroundsQuery.data ?? []).slice(0, 10);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)]">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Background Generator</h2>
            <p className="text-sm text-slate-400">Create a workspace image asset in three controlled stages.</p>
          </div>
          <StageProgress activeStage={activeStage} />
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/50">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${stageIndex * 100}%)` }}
          >
            <StagePanel>
              <DataEntryStage
                request={request}
                isPending={estimateMutation.isPending}
                onEstimate={handleEstimate}
                onUpdateRequest={updateRequest}
              />
            </StagePanel>
            <StagePanel>
              <EstimationStage
                estimate={estimate}
                isPending={generateMutation.isPending}
                onBack={() => {
                  if (generateMutation.isPending) {
                    showToast("Wait for generation to finish before returning to Data Entry.");
                    return;
                  }
                  setActiveStage("data-entry");
                }}
                onGenerate={handleGenerate}
              />
            </StagePanel>
            <StagePanel>
              <OutputStage
                output={generatedOutput}
                isPending={generateMutation.isPending}
                onDownload={(outputId) => handleDownload(outputId, { resetAfterDownload: true })}
                onReset={resetProcess}
              />
            </StagePanel>
          </div>
        </div>
      </section>

      <RecentBackgroundShelf
        backgrounds={recentBackgrounds}
        isLoading={backgroundsQuery.isLoading}
        onDownload={(outputId) => handleDownload(outputId, { resetAfterDownload: false })}
        onPreview={setPreviewOutput}
        onRefresh={() => backgroundsQuery.refetch()}
      />
      {previewOutput ? (
        <BackgroundPreviewModal
          output={previewOutput}
          onClose={() => setPreviewOutput(null)}
          onDownload={(outputId) => handleDownload(outputId, { resetAfterDownload: false })}
        />
      ) : null}
    </div>
  );
}

function StagePanel({ children }: { children: React.ReactNode }) {
  return <div className="w-full shrink-0 p-5">{children}</div>;
}

function StageProgress({ activeStage }: { activeStage: BackgroundStage }) {
  return (
    <div className="flex gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-1">
      {stageOrder.map((stage, index) => {
        const isActive = activeStage === stage;
        return (
          <div
            key={stage}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
              isActive ? "bg-purple-500 text-white" : "text-slate-400"
            }`}
          >
            <span className="font-[var(--font-mono)] text-xs">{index + 1}</span>
            <span>{stageLabels[stage]}</span>
          </div>
        );
      })}
    </div>
  );
}

function DataEntryStage({
  request,
  isPending,
  onEstimate,
  onUpdateRequest,
}: {
  request: BackgroundGeneratorFormState;
  isPending: boolean;
  onEstimate: () => void;
  onUpdateRequest: (patch: Partial<BackgroundGeneratorFormState>) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
          <ImageIcon size={16} />
          Workspace image asset
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Purpose" value={request.purpose} options={purposes} onChange={(value) => value && onUpdateRequest({ purpose: value })} />
          <SelectField label="Mood" value={request.mood} options={moods} onChange={(value) => onUpdateRequest({ mood: value })} />
          <SelectField label="Style" value={request.visualStyle} options={visualStyles} onChange={(value) => onUpdateRequest({ visualStyle: value })} />
          <SelectField label="Text Area" value={request.textSafeArea} options={textSafeAreas} onChange={(value) => value && onUpdateRequest({ textSafeArea: value })} />
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Prompt Details
          </span>
          <textarea
            className="min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-400"
            maxLength={500}
            value={request.promptDetails ?? ""}
            onChange={(event) => onUpdateRequest({ promptDetails: event.target.value || undefined })}
            placeholder="Optional: color palette, lighting feel, or sanctuary-specific direction."
          />
          <span className="mt-1 block text-xs text-slate-500">{request.promptDetails?.length ?? 0}/500</span>
        </label>
      </div>

      <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <div>
          <p className="text-sm font-medium text-slate-100">Required before estimate</p>
          <p className="mt-2 text-sm text-slate-400">Mood and Style must be selected before the estimate can be validated.</p>
        </div>
        <button
          type="button"
          onClick={onEstimate}
          disabled={isPending || !request.mood || !request.visualStyle}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
          Validate Estimate
        </button>
      </div>
    </div>
  );
}

function EstimationStage({
  estimate,
  isPending,
  onBack,
  onGenerate,
}: {
  estimate: BackgroundGenerationEstimateRecord | null;
  isPending: boolean;
  onBack: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-50">Generation Estimate</h3>
          <p className="text-sm text-slate-400">Review provider, resolution, and estimated cost before generation.</p>
        </div>
        <span className="rounded bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-200">16:9</span>
      </div>

      {estimate ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Provider" value={`${estimate.provider} / ${estimate.model}`} />
          <Metric label="Resolution" value={estimate.providerResolution} />
          <Metric label="Estimated Cost" value={`$${estimate.estimatedCostUsd.toFixed(2)}`} />
          <Metric label="Media" value="Image" />
          <Metric label="Input Tokens" value={estimate.estimatedInputTokens ?? "Provider reported"} />
          <Metric label="Output Tokens" value={estimate.estimatedOutputTokens ?? "Provider reported"} />
          <p className="sm:col-span-2 lg:col-span-3 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
            {estimate.freeTierNote}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">
          Return to Data Entry and validate the estimate before generating.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          <ArrowLeft size={16} />
          Back to Data Entry
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!estimate || isPending}
          className="flex items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          Generate Background
        </button>
      </div>
    </div>
  );
}

function OutputStage({
  output,
  isPending,
  onDownload,
  onReset,
}: {
  output: GeneratedOutputRecord | null;
  isPending: boolean;
  onDownload: (outputId: string) => void;
  onReset: () => void;
}) {
  if (isPending) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border border-slate-800 bg-slate-950/70 text-slate-300">
        <Loader2 className="animate-spin text-purple-200" size={28} />
        <p className="text-sm font-medium">Generating background...</p>
      </div>
    );
  }

  if (!output) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-slate-700 bg-slate-950/50 text-center">
        <p className="text-sm text-slate-400">No generated output is ready yet.</p>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          <RotateCcw size={16} />
          Restart Process
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
        <Image
          src={getGeneratedBackgroundPreviewUrl(output.id)}
          alt="Generated worship background preview"
          width={1536}
          height={864}
          unoptimized
          className="aspect-video h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <div>
          <p className="text-sm font-medium text-slate-100">Generated image ready</p>
          <p className="mt-2 text-sm text-slate-400">Download it to finish, or restart the process without downloading.</p>
        </div>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => onDownload(output.id)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Download size={16} />
            Download
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            <RotateCcw size={16} />
            Restart Process
          </button>
        </div>
      </div>
    </div>
  );
}

function RecentBackgroundShelf({
  backgrounds,
  isLoading,
  onDownload,
  onPreview,
  onRefresh,
}: {
  backgrounds: GeneratedOutputRecord[];
  isLoading: boolean;
  onDownload: (outputId: string) => void;
  onPreview: (output: GeneratedOutputRecord) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-50">10 Most Recent Generated Images</h3>
          <p className="text-sm text-slate-400">Workspace assets expire after 24 hours.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
          aria-label="Refresh backgrounds"
        >
          <RefreshCcw size={16} />
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">Loading images...</div>
      ) : null}

      {!isLoading && backgrounds.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">
          No generated backgrounds yet.
        </div>
      ) : null}

      {backgrounds.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {backgrounds.map((output) => (
            <article key={output.id} className="w-56 shrink-0 rounded-lg border border-slate-800 bg-slate-900/70 p-2">
              <button
                type="button"
                onClick={() => onPreview(output)}
                className="block aspect-video w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950 text-left"
                aria-label="Preview generated background"
              >
                <Image
                  src={getGeneratedBackgroundPreviewUrl(output.id)}
                  alt="Generated worship background preview"
                  width={320}
                  height={180}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-slate-500">{new Date(output.createdAt).toLocaleString()}</p>
                <button
                  type="button"
                  onClick={() => onDownload(output.id)}
                  className="rounded-md border border-slate-700 p-1.5 text-slate-200 hover:bg-slate-800"
                  aria-label="Download generated background"
                >
                  <Download size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function BackgroundPreviewModal({
  output,
  onClose,
  onDownload,
}: {
  output: GeneratedOutputRecord;
  onClose: () => void;
  onDownload: (outputId: string) => void;
}) {
  const [overlayTextTone, setOverlayTextTone] = useState<"white" | "black">("white");
  const overlayTextClass =
    overlayTextTone === "white"
      ? "text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.72)]"
      : "text-black [text-shadow:0_1px_10px_rgba(255,255,255,0.55)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-50">Generated Background Preview</h3>
            <p className="text-xs text-slate-500">{new Date(output.createdAt).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1">
              {(["white", "black"] as const).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setOverlayTextTone(tone)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                    overlayTextTone === tone ? "bg-purple-500 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
              aria-label="Close preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="min-h-0 overflow-auto bg-slate-950 p-4">
          <div className="relative mx-auto aspect-video max-h-[62vh] w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
            <Image
              src={getGeneratedBackgroundPreviewUrl(output.id)}
              alt="Generated worship background preview"
              width={1536}
              height={864}
              unoptimized
              className="h-full w-full object-contain"
            />
            <div className={`pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 text-center ${overlayTextClass}`}>
              <p className="text-2xl font-semibold leading-tight sm:text-4xl">
                Lorem ipsum dolor sit amet
              </p>
              <p className="mt-3 text-base font-medium leading-relaxed opacity-90 sm:text-2xl">
                Consectetur adipiscing elit sed do eiusmod tempor
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            onClick={() => onDownload(output.id)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Download size={16} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "";
  options: readonly (readonly [T, string])[];
  onChange: (value: T | "") => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <select
        className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-400"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}
