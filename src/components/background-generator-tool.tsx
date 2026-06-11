"use client";

import { useMemo, useState } from "react";
import { Download, ImageIcon, Loader2, Play, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  downloadGeneratedBackground,
  estimateBackgroundGeneration,
  fetchGeneratedBackgrounds,
  generateBackground,
  triggerBrowserDownload,
  type BackgroundGenerationEstimateRecord,
  type BackgroundGenerationRequestPayload,
  type ServiceRecord,
} from "@/lib/api-client";

type BackgroundGeneratorToolProps = {
  services: ServiceRecord[];
  showToast: (message: string, tone?: "success" | "info") => void;
};

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

function formatServiceLabel(service: Pick<ServiceRecord, "ministryName" | "serviceDate">) {
  return `${service.ministryName} - ${new Date(service.serviceDate).toLocaleDateString()}`;
}

export default function BackgroundGeneratorTool({ services, showToast }: BackgroundGeneratorToolProps) {
  const queryClient = useQueryClient();
  const [request, setRequest] = useState<BackgroundGenerationRequestPayload>({
    mediaType: "image",
    purpose: "lyrics",
    mood: "reflective",
    visualStyle: "abstract-light",
    textSafeArea: "center-clear",
    serviceId: services[0]?.id,
  });
  const [estimate, setEstimate] = useState<BackgroundGenerationEstimateRecord | null>(null);
  const selectedService = useMemo(
    () => services.find((service) => service.id === request.serviceId),
    [request.serviceId, services]
  );

  const backgroundsQuery = useQuery({
    queryKey: ["media-backgrounds"],
    queryFn: fetchGeneratedBackgrounds,
  });

  const estimateMutation = useMutation({
    mutationFn: estimateBackgroundGeneration,
    onSuccess: (response) => {
      setEstimate(response.estimate);
      showToast("Generation estimate ready.", "success");
    },
    onError: (error: Error) => showToast(error.message),
  });

  const generateMutation = useMutation({
    mutationFn: generateBackground,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["media-backgrounds"] });
      setEstimate(null);
      showToast("Background generated.", "success");
    },
    onError: (error: Error) => showToast(error.message),
  });

  const updateRequest = (patch: Partial<BackgroundGenerationRequestPayload>) => {
    setEstimate(null);
    setRequest((current) => {
      const next = { ...current, ...patch };
      if (next.mediaType === "video") {
        next.durationSeconds = 15;
        next.videoQuality = "480p";
      } else {
        delete next.durationSeconds;
        delete next.videoQuality;
      }
      return next;
    });
  };

  const handleEstimate = () => {
    estimateMutation.mutate(request);
  };

  const handleGenerate = () => {
    if (!estimate) {
      showToast("Review the estimate before generating.");
      return;
    }
    generateMutation.mutate({ request, acceptedEstimate: estimate });
  };

  const handleDownload = async (outputId: string) => {
    try {
      const download = await downloadGeneratedBackground(outputId);
      triggerBrowserDownload(download.blob, download.fileName);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Download failed");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
      <section className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)]">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-400/30 bg-purple-500/15 text-purple-200">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Background Generator</h2>
            <p className="text-sm text-slate-400">Projection-ready worship backgrounds with cost validation.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Worship Service
            </label>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-400"
              value={request.serviceId ?? ""}
              onChange={(event) => updateRequest({ serviceId: event.target.value || undefined })}
            >
              <option value="">Select a service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {formatServiceLabel(service)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-1">
            {(["image", "video"] as const).map((mediaType) => (
              <button
                key={mediaType}
                type="button"
                onClick={() => updateRequest({ mediaType })}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  request.mediaType === mediaType
                    ? "bg-purple-500 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {mediaType === "image" ? <ImageIcon size={16} /> : <Play size={16} />}
                {mediaType === "image" ? "Image" : "15s 480p Video"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Purpose" value={request.purpose} options={purposes} onChange={(value) => updateRequest({ purpose: value })} />
            <SelectField label="Mood" value={request.mood} options={moods} onChange={(value) => updateRequest({ mood: value })} />
            <SelectField label="Style" value={request.visualStyle} options={visualStyles} onChange={(value) => updateRequest({ visualStyle: value })} />
            <SelectField label="Text Area" value={request.textSafeArea} options={textSafeAreas} onChange={(value) => updateRequest({ textSafeArea: value })} />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Prompt Details
            </label>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-400"
              maxLength={500}
              value={request.promptDetails ?? ""}
              onChange={(event) => updateRequest({ promptDetails: event.target.value || undefined })}
              placeholder="Optional: color palette, motion feel, or sanctuary-specific direction."
            />
            <p className="mt-1 text-xs text-slate-500">{request.promptDetails?.length ?? 0}/500</p>
          </div>

          <button
            type="button"
            onClick={handleEstimate}
            disabled={estimateMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {estimateMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
            Validate Estimate
          </button>
        </div>
      </section>

      <section className="space-y-5">
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-50">Generation Estimate</h3>
              <p className="text-sm text-slate-400">The server recalculates this before any provider call.</p>
            </div>
            <span className="rounded bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-200">16:9</span>
          </div>

          {estimate ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Provider" value={`${estimate.provider} / ${estimate.model}`} />
              <Metric label="Resolution" value={estimate.providerResolution} />
              <Metric label="Cost" value={`$${estimate.estimatedCostUsd.toFixed(2)}`} />
              <Metric label="Media" value={estimate.mediaType === "video" ? "15s 480p loop" : "Image"} />
              <Metric label="Input Tokens" value={estimate.estimatedInputTokens ?? "Provider reported"} />
              <Metric label="Output Tokens" value={estimate.estimatedOutputTokens ?? "Provider reported"} />
              <p className="sm:col-span-2 lg:col-span-3 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                {estimate.freeTierNote}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">
              Validate the request to see provider, resolution, token availability, and cost before generating.
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!estimate || !selectedService || generateMutation.isPending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generateMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
            Generate Background
          </button>
        </div>

        <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-50">Recent Backgrounds</h3>
              <p className="text-sm text-slate-400">Video outputs are loop-intended and should be previewed before use.</p>
            </div>
            <button
              type="button"
              onClick={() => backgroundsQuery.refetch()}
              className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
              aria-label="Refresh backgrounds"
            >
              <RefreshCcw size={16} />
            </button>
          </div>

          <div className="space-y-3">
            {(backgroundsQuery.data ?? []).map((output) => (
              <div key={output.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {output.type === "BACKGROUND_VIDEO" ? "15s 480p loop video" : "Presentation image"}
                  </p>
                  <p className="text-xs text-slate-500">{formatServiceLabel(output.service)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(output.id)}
                  className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <Download size={15} />
                  Download
                </button>
              </div>
            ))}

            {backgroundsQuery.data?.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                No generated backgrounds yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>
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
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <select
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-400"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
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
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}
