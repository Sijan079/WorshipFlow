"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { apiFetch, type ChecklistPresetRecord } from "@/lib/api-client";

export default function WorshipServicePlannerClient() {
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [completedChecklistItemIds, setCompletedChecklistItemIds] = useState<Set<string>>(() => new Set());
  const checklistQuery = useQuery({
    queryKey: ["settings", "checklists"],
    queryFn: () => apiFetch<ChecklistPresetRecord[]>("/api/settings/checklists"),
  });
  const activeChecklist = checklistQuery.data?.find((checklist) => checklist.isActive);
  const checklistItems = (activeChecklist?.items ?? [])
    .filter((item) => item.active)
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
  const completedCount = checklistItems.filter((item) => completedChecklistItemIds.has(item.id)).length;

  function toggleChecklistItem(id: string) {
    setCompletedChecklistItemIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="dashboard-page min-h-full space-y-6 py-1 text-[var(--text-primary)] lg:px-2">
      <section className="dashboard-header ui-stage-enter pb-6">
        <p className="technical-label">SERVICE PREPARATION</p>
        <h1 className="mt-2 text-3xl font-semibold leading-10 text-[var(--text-primary)]">
          Prepare this Sunday&apos;s worship service
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
          Review the planned service and complete the preparation checklist.
        </p>
      </section>

      <section aria-label="Preparation checklist">
        <section
          className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--elevation-subtle)]"
          aria-labelledby="dashboard-checklist-heading"
        >
          <button
            type="button"
            onClick={() => setChecklistOpen((current) => !current)}
            className="pressable flex w-full items-start justify-between gap-4 text-left"
            aria-expanded={checklistOpen}
            aria-controls="dashboard-checklist-items"
          >
            <span>
              <span className="technical-label">PRE-SERVICE CHECKLIST</span>
              <span id="dashboard-checklist-heading" className="mt-1 block text-xl font-semibold text-[var(--text-primary)]">
                {activeChecklist?.name ?? "Pre-service checklist"}
              </span>
              <span className="mt-2 block text-sm text-[var(--text-secondary)]">
                {completedCount} of {checklistItems.length} marked done for this dashboard session.
              </span>
            </span>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] text-[var(--text-secondary)]">
              <ChevronDown className={`h-4 w-4 transition-transform ${checklistOpen ? "rotate-180" : ""}`} />
            </span>
          </button>

          <div id="dashboard-checklist-items" className="ui-collapse" data-open={checklistOpen}>
            <div>
              {checklistQuery.isLoading ? (
                <p className="mt-5 border-t border-[var(--border-default)] pt-4 text-sm text-[var(--text-secondary)]">
                  Loading checklist...
                </p>
              ) : checklistItems.length === 0 ? (
                <p className="mt-5 border-t border-[var(--border-default)] pt-4 text-sm text-[var(--text-secondary)]">
                  No active checklist items are configured.
                </p>
              ) : (
                <ol className="mt-5 divide-y divide-[var(--border-default)] border-y border-[var(--border-default)]">
                  {checklistItems.map((item, index) => {
                    const isCompleted = completedChecklistItemIds.has(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggleChecklistItem(item.id)}
                          aria-pressed={isCompleted}
                          className={`pressable flex w-full items-center gap-3 px-1 py-3 text-left ${
                            isCompleted ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                              isCompleted
                                ? "border-[var(--border-default)] bg-[var(--surface-panel-alt)]"
                                : "border-[var(--border-strong)] bg-[var(--surface-panel-strong)] text-[var(--text-accent)]"
                            }`}
                          >
                            {isCompleted ? <Check className="h-4 w-4" /> : <span className="font-[var(--font-mono)] text-xs font-semibold">{index + 1}</span>}
                          </span>
                          <span className={`text-sm leading-6 ${isCompleted ? "line-through" : ""}`}>{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </section>

        {/*
        <section className="max-w-6xl py-1">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="technical-label">CURRENT SERVICE</p>
              {servicesQuery.isLoading ? (
                <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading Sunday&apos;s service...</p>
              ) : currentService ? (
                <>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{formatServiceDate(currentService.serviceDate)}</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {currentService.ministryName || currentService.assignedMinistry || "Worship service"} · {currentService.status.toLowerCase()}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">No service prepared</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">There is no service prepared for this Sunday yet.</p>
                </>
              )}
            </div>
            <Link href="/services" className="ui-btn-primary pressable inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold">
              {currentService ? "Open service" : "Create service"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {currentService && serviceBlocks.length > 0 ? (
            <div className="mt-5">
              <div className="mb-3 flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-[var(--text-accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Service order</h3>
              </div>
              <ol className="divide-y divide-[var(--border-default)] border-t border-[var(--border-default)]">
                {serviceBlocks.map((block, index) => {
                  const displayValues = getServiceBlockDisplayValues(block);
                  return (
                    <li key={block.id} className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[2rem_minmax(9rem,0.65fr)_minmax(0,1.85fr)]">
                      <span className="font-[var(--font-mono)] text-xs leading-6 text-[var(--text-muted)]">{String(index + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 text-sm font-medium leading-6 text-[var(--text-primary)]">{block.label}</span>
                      <span className="min-w-0 text-sm leading-6 text-[var(--text-secondary)]">
                        {displayValues.length > 0 ? displayValues.join(" · ") : "No content added"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : currentService && !servicesQuery.isLoading ? (
            <p className="mt-5 border-t border-[var(--rule-default)] pt-4 text-sm text-[var(--text-secondary)]">
              This service does not have any stored blocks yet.
            </p>
          ) : null}
        </section>
        */}
      </section>
    </div>
  );
}
