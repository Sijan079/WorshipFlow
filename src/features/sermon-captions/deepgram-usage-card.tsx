"use client";

import { useState } from "react";
import UsageBarChart from "./usage-bar-chart";
import { deepgramBuckets, viewRangeLabel, type DeepgramRequest, type UsageView } from "./usage-buckets";

export type DeepgramUsage = { status: "available" | "unconfigured" | "error"; balances: Array<{ amount: number; units: string }>; requests: DeepgramRequest[] };

const VIEWS: Array<{ id: UsageView; label: string }> = [{ id: "day", label: "Per day" }, { id: "week", label: "Per week" }, { id: "month", label: "Per month" }];
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// Deepgram reports "usd"; show it as dollars. Any other unit keeps its name.
function money(units: string) {
  return units.toLowerCase() === "usd"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
    : { format: (value: number) => `${new Intl.NumberFormat("en-US").format(value)} ${units}` };
}

// The Deepgram "D" mark (white on black), then the balance, with a switch for the chart below. The chart
// shows the minutes of audio used: each hour of today, each day of this week (Sunday to Saturday), or each
// day of this month, in this computer's time. Hovering a bar also gives its cost.
export default function DeepgramUsageCard({ deepgram }: { deepgram: DeepgramUsage }) {
  const [view, setView] = useState<UsageView>("day");
  const now = new Date();
  const buckets = deepgramBuckets(view, deepgram.requests, now);
  const range = viewRangeLabel(view, now);
  const totalMinutes = buckets.reduce((sum, bucket) => sum + (bucket.value ?? 0), 0);
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-md bg-black text-lg font-bold leading-none text-white" role="img" aria-label="Deepgram">D</span>
        {deepgram.status === "available" && deepgram.balances.length
          ? <ul className="flex flex-wrap items-baseline gap-x-4">{deepgram.balances.map((balance, index) => <li key={`${balance.units}-${index}`}><strong className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{money(balance.units).format(balance.amount)}</strong></li>)}</ul>
          : <span className="text-base font-semibold text-[var(--text-primary)]">Deepgram</span>}
      </div>
      {deepgram.status === "available" ? <div role="radiogroup" aria-label="Chart view" className="relative grid grid-cols-3 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] p-0.5">
        {/* One highlight that slides to the chosen option. */}
        <span aria-hidden="true" className="absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded bg-[var(--action-secondary-accent-bg)] shadow-[var(--elevation-subtle)] transition-transform duration-300 ease-out" style={{ transform: `translateX(${VIEWS.findIndex((item) => item.id === view) * 100}%)` }} />
        {VIEWS.map((item) => <button key={item.id} type="button" role="radio" aria-checked={view === item.id} onClick={() => setView(item.id)} className={`relative min-h-9 whitespace-nowrap rounded px-4 text-sm font-medium transition-colors duration-300 ${view === item.id ? "text-[var(--action-secondary-accent-ink)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>{item.label}</button>)}
      </div> : null}
    </div>
    {deepgram.status === "available" ? <>
      {deepgram.balances.length ? null : <p className="mt-4 text-sm text-[var(--text-secondary)]">Deepgram returned no balance entries.</p>}
      <UsageBarChart range={range} buckets={buckets} level={VIEWS.findIndex((item) => item.id === view)} unit="Used" format={(value) => whole.format(value)} ariaSummary={`Deepgram audio used, ${range}: ${whole.format(totalMinutes)} minutes in total`} />
    </> : <p className="mt-4 text-sm text-[var(--text-secondary)]">{deepgram.status === "error" ? "Could not reach Deepgram billing. Try Refresh or check the Deepgram Console." : "Balance connection is not set up. Check credits in the Deepgram Console."} <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--text-accent)] underline underline-offset-2">Open Deepgram Console</a></p>}
  </>;
}
