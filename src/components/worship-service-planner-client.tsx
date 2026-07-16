"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarCheck2,
  ChevronDown,
  ExternalLink,
  FileMusic,
  Smartphone,
} from "lucide-react";
import { apiFetch, type ChecklistPresetRecord } from "@/lib/api-client";

const DASHBOARD_QUICK_ACTIONS = [
  {
    title: "Prepare Service",
    href: "/services",
    icon: CalendarCheck2,
    external: false,
  },
  {
    title: "Song Formatter",
    href: "/songs/upload",
    icon: FileMusic,
    external: false,
  },
  {
    title: "Phone Transfer",
    href: "/media-tools/phone-transfer",
    icon: Smartphone,
    external: false,
  },
  {
    title: "Facebook Live",
    href: "https://www.facebook.com/",
    icon: ExternalLink,
    external: true,
  },
] as const;

export default function WorshipServicePlannerClient() {
  const [checklistOpen, setChecklistOpen] = useState(true);
  const checklistQuery = useQuery({
    queryKey: ["settings", "checklists"],
    queryFn: () => apiFetch<ChecklistPresetRecord[]>("/api/settings/checklists"),
  });
  const activeChecklist = checklistQuery.data?.find((checklist) => checklist.isActive);
  const checklistItems = (activeChecklist?.items ?? [])
    .filter((item) => item.active)
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));

  return (
    <div className="min-h-full space-y-6 py-1 text-[var(--color-brand-ink)] lg:px-2">
      <section className="ui-stage-enter">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold leading-10 text-[var(--color-brand-ink)]">
            Production Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] md:text-base">
            Keep the booth team oriented before service starts, then jump into the core preparation tools.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-5">
        <div>
          <div className="mb-3">
            <p className="technical-label">QUICK ACTIONS</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--color-brand-ink)]">
              Core workflows
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {DASHBOARD_QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              const content = (
                <span className="flex min-h-14 items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-panel-strong)] text-[var(--text-accent)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="truncate text-base font-semibold text-[var(--color-brand-ink)]">
                      {action.title}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                </span>
              );

              return action.external ? (
                <a
                  key={action.title}
                  href={action.href}
                  target="_blank"
                  rel="noreferrer"
                  className="pressable-subtle block rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4 transition hover:bg-[var(--surface-panel-strong)]"
                >
                  {content}
                </a>
              ) : (
                <Link
                  key={action.title}
                  href={action.href}
                  className="pressable-subtle block rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4 transition hover:bg-[var(--surface-panel-strong)]"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="production-panel ui-stage-enter p-5">
          <button
            type="button"
            onClick={() => setChecklistOpen((current) => !current)}
            className="pressable flex w-full items-start justify-between gap-4 text-left"
            aria-expanded={checklistOpen}
            aria-controls="dashboard-checklist-items"
          >
            <span>
              <span className="technical-label">PRE-SERVICE CHECKLIST</span>
              <span className="mt-1 block text-2xl font-semibold text-[var(--color-brand-ink)]">
                {activeChecklist?.name ?? "Pre-service checklist"}
              </span>
              {checklistOpen ? (
                <span className="mt-2 block max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                  A read-only booth reference for the recurring prep work before service starts.
                </span>
              ) : null}
            </span>
            <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] text-[var(--text-secondary)]">
              <ChevronDown className={`h-4 w-4 transition-transform ${checklistOpen ? "rotate-180" : ""}`} />
            </span>
          </button>

          <div id="dashboard-checklist-items" className="ui-collapse" data-open={checklistOpen}>
            <div>
              {checklistQuery.isLoading ? (
                <p className="mt-5 border-y border-[var(--border-default)] py-4 text-sm text-[var(--text-secondary)]">Loading checklist...</p>
              ) : checklistQuery.error ? (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--border-default)] py-4 text-sm text-[var(--text-danger)]">
                  <span>Checklist is unavailable.</span>
                  <button type="button" onClick={() => void checklistQuery.refetch()} className="ui-btn-secondary pressable px-3 py-1.5 text-xs font-semibold">Retry</button>
                </div>
              ) : checklistItems.length === 0 ? (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--border-default)] py-4 text-sm text-[var(--text-secondary)]">
                  <span>No active checklist items are configured.</span>
                  <Link href="/settings?tab=checklist" className="font-semibold text-[var(--text-accent)] hover:text-[var(--text-primary)]">Open Settings</Link>
                </div>
              ) : (
                <ol className="mt-5 divide-y divide-[var(--border-default)] border-y border-[var(--border-default)]">
                  {checklistItems.map((item, index) => (
                    <li key={item.id} className="animate-fade-in flex items-start gap-3 py-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-panel-strong)] font-[var(--font-mono)] text-xs font-semibold text-[var(--text-accent)]">
                        {index + 1}
                      </span>
                      <span className="text-sm leading-6 text-[var(--color-brand-ink)]">{item.label}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
