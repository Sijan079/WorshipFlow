"use client";

import { useState } from "react";
import type { UsagePoint } from "./caption-usage";
import UsageBarChart from "./usage-bar-chart";
import { azureHourBuckets, dayBuckets, shortCount, utcWeekBuckets, utcWeekRangeLabel, viewRangeLabel, type UsageView } from "./usage-buckets";

export type AzureUsage = { cap: number; estimatedCharacters: number; daily: UsagePoint[]; hourly: Array<[number, number]>; monthStart: string };

const VIEWS: Array<{ id: UsageView; label: string; level: number }> = [{ id: "day", label: "Per day", level: 0 }, { id: "week", label: "Per week", level: 1 }, { id: "month", label: "Per month", level: 2 }];
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 });

// The Microsoft Azure mark (from the open Simple Icons set), then the characters left this month, with the
// same Per day / Per week / Per month switch and zooming chart as the Deepgram card. The day view is by the hour
// in this computer's time; the week and month are UTC days, as Azure counts. Hours are recorded from the day
// the hourly record began, so earlier hours show as empty.
export default function AzureUsageCard({ azure }: { azure: AzureUsage }) {
  const [view, setView] = useState<UsageView>("day");
  const left = Math.max(0, azure.cap - azure.estimatedCharacters);
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const raw = view === "day" ? azureHourBuckets(azure.hourly, now) : view === "week" ? utcWeekBuckets(azure.daily, today) : dayBuckets(azure.monthStart, azure.daily, today, true);
  const buckets = raw.map((bucket) => ({ ...bucket, text: bucket.value === null || bucket.future ? undefined : `${whole.format(bucket.value)} characters` }));
  const range = view === "day" ? viewRangeLabel("day", now) : view === "week" ? utcWeekRangeLabel(today) : `${new Date(azure.monthStart).toLocaleDateString(undefined, { timeZone: "UTC", month: "long", year: "numeric" })} (UTC)`;
  const used = azure.daily.filter((point) => point.day.startsWith(azure.monthStart.slice(0, 7))).reduce((sum, point) => sum + point.value, 0);
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-md bg-[var(--surface-panel-alt)] text-[var(--action-secondary-accent-bg)]" role="img" aria-label="Microsoft Azure">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M22.379 23.343a1.62 1.62 0 0 0 1.536-2.14v.002L17.35 1.76A1.62 1.62 0 0 0 15.816.657H8.184A1.62 1.62 0 0 0 6.65 1.76L.086 21.204a1.62 1.62 0 0 0 1.536 2.139h4.741a1.62 1.62 0 0 0 1.535-1.103l.977-2.892 4.947 3.675c.28.208.618.32.966.32m-3.084-12.531 3.624 10.739a.54.54 0 0 1-.51.713v-.001h-.03a.54.54 0 0 1-.322-.106l-9.287-6.9h4.853m6.313 7.006c.116-.326.13-.694.007-1.058L9.79 1.76a1.722 1.722 0 0 0-.007-.02h6.034a.54.54 0 0 1 .512.366l6.562 19.445a.54.54 0 0 1-.338.684" /></svg>
        </span>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <strong className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]" title={`${whole.format(left)} characters left`}>{shortCount(left)}</strong>
          <span className="text-sm text-[var(--text-secondary)]">characters left</span>
        </p>
      </div>
      <div role="radiogroup" aria-label="Chart view" className="relative grid grid-cols-3 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] p-0.5">
        <span aria-hidden="true" className="absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded bg-[var(--action-secondary-accent-bg)] shadow-[var(--elevation-subtle)] transition-transform duration-300 ease-out" style={{ transform: `translateX(${VIEWS.findIndex((item) => item.id === view) * 100}%)` }} />
        {VIEWS.map((item) => <button key={item.id} type="button" role="radio" aria-checked={view === item.id} onClick={() => setView(item.id)} className={`relative min-h-9 whitespace-nowrap rounded px-4 text-sm font-medium transition-colors duration-300 ${view === item.id ? "text-[var(--action-secondary-accent-ink)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>{item.label}</button>)}
      </div>
    </div>
    <UsageBarChart range={range} buckets={buckets} level={VIEWS.find((item) => item.id === view)?.level ?? 0} unit="Used" format={(value) => compact.format(value)} ariaSummary={`Azure Translator characters used, ${range}: ${whole.format(used)} this month`} />
  </>;
}
