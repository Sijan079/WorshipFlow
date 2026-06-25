"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarCheck2,
  ChevronDown,
  ExternalLink,
  FileMusic,
  Smartphone,
} from "lucide-react";

const DASHBOARD_CHECKLIST_ITEMS = [
  "Confirm service details, theme, and participant assignments.",
  "Verify song lineup, keys, and order for the service.",
  "Confirm scripture reading and sermon notes are ready.",
  "Test booth audio, display, and media playback path.",
  "Check phone-transfer or media handoff availability.",
  "Verify livestream device readiness before going on air.",
] as const;

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
    title: "Open Facebook",
    href: "https://www.facebook.com/",
    icon: ExternalLink,
    external: true,
  },
] as const;

export default function WorshipServicePlannerClient() {
  const [checklistOpen, setChecklistOpen] = useState(true);

  return (
    <main className="min-h-full space-y-8 py-3 text-[var(--color-brand-ink)] lg:px-2">
      <section className="space-y-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold leading-tight text-[var(--color-brand-ink)] md:text-5xl">
            Production Dashboard
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)] md:text-lg md:leading-8">
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
                  className="pressable block rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4 transition hover:bg-[var(--surface-panel-strong)]"
                >
                  {content}
                </a>
              ) : (
                <Link
                  key={action.title}
                  href={action.href}
                  className="pressable block rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4 transition hover:bg-[var(--surface-panel-strong)]"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="production-panel p-5">
          <button
            type="button"
            onClick={() => setChecklistOpen((current) => !current)}
            className="pressable flex w-full items-start justify-between gap-4 text-left"
            aria-expanded={checklistOpen}
          >
            <span>
              <span className="technical-label">PRE-SERVICE CHECKLIST</span>
              <span className="mt-1 block text-2xl font-semibold text-[var(--color-brand-ink)]">
                Before every worship service
              </span>
              {checklistOpen ? (
                <span className="mt-2 block max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                  A read-only booth reference for the recurring prep work before service starts.
                </span>
              ) : null}
            </span>
            <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] text-[var(--text-secondary)]">
              <ChevronDown className={`h-4 w-4 transition-transform ${checklistOpen ? "rotate-180" : ""}`} />
            </span>
          </button>

          {checklistOpen ? (
            <ol className="mt-5 divide-y divide-[var(--border-default)] border-y border-[var(--border-default)]">
              {DASHBOARD_CHECKLIST_ITEMS.map((item, index) => (
                <li key={item} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-panel-strong)] font-[var(--font-mono)] text-xs font-semibold text-[var(--text-accent)]">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-[var(--color-brand-ink)]">{item}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </section>
    </main>
  );
}
