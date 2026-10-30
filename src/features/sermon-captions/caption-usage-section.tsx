"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { UsagePoint } from "./caption-usage";
import AzureUsageCard from "./azure-usage-card";
import DeepgramUsageCard, { type DeepgramUsage } from "./deepgram-usage-card";

type Usage = {
  azure: { baselineCharacters: number; appCharacters: number; estimatedCharacters: number; unmeteredRequests: number; monthStart: string; monthEnd: string; trackingSince: string | null; daily: UsagePoint[]; hourly: Array<[number, number]>; cap: number; baseline: { periodStart: string; capturedAt: string; source: string } | null; configured: boolean; scope: "resource-snapshot-plus-workspace" };
  deepgram: DeepgramUsage;
};

const number = new Intl.NumberFormat("en-US");
const CARD = "rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-5 py-5 shadow-[var(--elevation-subtle)] sm:px-6";

const BAR_HEIGHTS = [38, 62, 30, 78, 52, 24, 70, 44, 58, 34, 66, 48, 28, 74, 56, 40, 64, 32, 54, 46, 72, 36, 60, 42];
const PULSE = "animate-pulse rounded bg-[var(--surface-panel-strong)]";

// Stands in for the two provider cards while usage loads: the same tile, number, switch and bars, in the
// same places, so nothing jumps when the real cards arrive.
function UsageSkeleton() {
  return <div role="status" aria-label="Loading usage" className="space-y-5">
    {[0, 1].map((card) => <div key={card} className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`size-9 rounded-md ${PULSE}`} />
          <div className={`h-7 w-28 ${PULSE}`} />
        </div>
        <div className={`h-11 w-64 max-w-full rounded-md ${PULSE}`} />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <span />
        <div className={`h-4 w-32 ${PULSE}`} />
      </div>
      <div className="mt-3 flex h-[150px] items-end gap-1.5 border-b border-[var(--border-default)] pl-9">
        {BAR_HEIGHTS.map((height, index) => <div key={index} className={`flex-1 rounded-t ${PULSE}`} style={{ height: `${height}%`, animationDelay: `${index * 60}ms` }} />)}
      </div>
    </div>)}
  </div>;
}

export default function CaptionUsageSection() {
  const query = useQuery({ queryKey: ["settings", "caption-usage"], queryFn: () => apiFetch<Usage>("/api/settings/usage"), staleTime: 60_000 });

  return <section className="space-y-5" aria-labelledby="caption-usage-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="caption-usage-heading" className="text-base font-semibold text-[var(--text-primary)]">Sermon Captions usage</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Provider usage to check before starting a broadcast.</p>
      </div>
      <button type="button" aria-label="Refresh usage" title="Refresh" className="inline-flex size-11 items-center justify-center rounded-md bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching ? "h-5 w-5 animate-spin" : "h-5 w-5"} /></button>
    </div>
    {query.isLoading ? <UsageSkeleton /> : null}
    {query.error ? <p role="alert" className="text-sm text-[var(--text-danger)]">Could not load usage. Try Refresh.</p> : null}
    {query.data ? <div className="space-y-5">
      <div className={CARD}>
        <DeepgramUsageCard deepgram={query.data.deepgram} />
      </div>
      <div className={CARD}>
        <AzureUsageCard azure={query.data.azure} />
        {query.data.azure.unmeteredRequests > 0 ? <p role="status" className="mt-3 text-sm text-[var(--text-warning)]">{number.format(query.data.azure.unmeteredRequests)} successful translation requests lacked a usable meter. The total is incomplete.</p> : null}
        {query.data.azure.configured ? null : <p className="mt-3 text-sm text-[var(--text-secondary)]">Azure Translator is not configured in this deployment.</p>}
      </div>
    </div> : null}
  </section>;
}
