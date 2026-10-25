"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

type Usage = {
  azure: { baselineCharacters: number; appCharacters: number; estimatedCharacters: number; unmeteredRequests: number; monthStart: string; monthEnd: string; trackingSince: string | null; baseline: { periodStart: string; capturedAt: string; source: string } | null; configured: boolean; scope: "resource-snapshot-plus-workspace" };
  deepgram: { status: "available" | "unconfigured" | "error"; balances: Array<{ amount: number; units: string }>; checkedAt: string | null; scope: "project" };
};

const number = new Intl.NumberFormat("en-US");

export default function CaptionUsageSection() {
  const query = useQuery({ queryKey: ["settings", "caption-usage"], queryFn: () => apiFetch<Usage>("/api/settings/usage"), staleTime: 60_000 });

  return <section className="space-y-5" aria-labelledby="caption-usage-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="caption-usage-heading" className="text-lg font-semibold text-[var(--text-primary)]">Sermon Captions usage</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Provider usage to check before starting a broadcast.</p>
      </div>
      <button type="button" className="ui-btn-secondary min-h-10 px-3 text-sm font-semibold" onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh</button>
    </div>
    {query.isLoading ? <p role="status" className="text-sm text-[var(--text-secondary)]">Loading usage…</p> : null}
    {query.error ? <p role="alert" className="text-sm text-[var(--text-danger)]">Could not load usage. Try Refresh.</p> : null}
    {query.data ? <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]">
      <div className="border-b border-[var(--border-default)] px-5 py-5 sm:px-6">
        <h3 className="font-semibold text-[var(--text-primary)]">Deepgram balance</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Project-wide balance · may include usage outside WorshipFlow</p>
        {query.data.deepgram.status === "available" ? <>
          {query.data.deepgram.balances.length ? <ul className="mt-4 space-y-2">{query.data.deepgram.balances.map((balance, index) => <li key={`${balance.units}-${index}`} className="flex items-baseline gap-2"><strong className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{number.format(balance.amount)}</strong><span className="text-sm text-[var(--text-secondary)]">{balance.units}</span></li>)}</ul>
            : <p className="mt-4 text-sm text-[var(--text-secondary)]">Deepgram returned no balance entries.</p>}
          <p className="mt-3 text-xs text-[var(--text-muted)]">Checked {query.data.deepgram.checkedAt ? new Date(query.data.deepgram.checkedAt).toLocaleString() : "just now"}. Balance updates may lag active streaming. Deepgram does not label free and paid credits separately in this response.</p>
        </> : <p className="mt-4 text-sm text-[var(--text-secondary)]">{query.data.deepgram.status === "error" ? "Could not reach Deepgram billing. Try Refresh or check the Deepgram Console." : "Balance connection is not set up. Check credits in the Deepgram Console."} <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--text-accent)] underline underline-offset-2">Open Deepgram Console</a></p>}
      </div>
      <div className="px-5 py-5 sm:px-6">
        <h3 className="font-semibold text-[var(--text-primary)]">Azure Translator characters</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Azure resource export plus later WorshipFlow translations</p>
        <p className="mt-4"><strong className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{number.format(query.data.azure.estimatedCharacters)}</strong><span className="ml-2 text-sm text-[var(--text-secondary)]">estimated characters this month</span></p>
        {query.data.azure.baseline ? <p className="mt-2 text-sm text-[var(--text-secondary)]">Azure export {number.format(query.data.azure.baselineCharacters)} + later WorshipFlow {number.format(query.data.azure.appCharacters)}</p> : <p className="mt-2 text-sm text-[var(--text-secondary)]">WorshipFlow metered usage only; no Azure export baseline for this month.</p>}
        <p className="mt-2 text-xs text-[var(--text-muted)]">{new Date(query.data.azure.monthStart).toLocaleDateString(undefined, { timeZone: "UTC", month: "long", year: "numeric" })} (UTC){query.data.azure.baseline ? ` | ${query.data.azure.baseline.source}, ${new Date(query.data.azure.baseline.periodStart).toLocaleString()} to ${new Date(query.data.azure.baseline.capturedAt).toLocaleString()}` : ""}{query.data.azure.trackingSince ? ` | app tracking since ${new Date(query.data.azure.trackingSince).toLocaleString()}` : ""}</p>
        {query.data.azure.unmeteredRequests > 0 ? <p role="status" className="mt-3 text-sm text-[var(--text-warning)]">{number.format(query.data.azure.unmeteredRequests)} successful translation requests lacked a usable meter. The total is incomplete.</p> : null}
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{query.data.azure.configured ? "This estimate excludes Azure resource activity outside WorshipFlow after the export. Check Azure for the official allowance." : "Azure Translator is not configured in this deployment."}</p>
      </div>
    </div> : null}
  </section>;
}
