"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BlockType, JobStatus } from "@prisma/client";
import {
  Check,
  ClipboardList,
  Eye,
  Loader2,
  Play,
  RefreshCcw,
} from "lucide-react";
import { apiFetch, type ServiceRecord } from "@/lib/api-client";
import { BLOCK_LABELS, SONG_BLOCK_TYPES, getServiceBlockOrder } from "@/lib/service-data";

function formatServiceDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

function getBlockByType(service: ServiceRecord, blockType: BlockType) {
  return service.blocks.find((block) => block.blockType === blockType);
}

function countParticipants(service: ServiceRecord) {
  return service.blocks.reduce((total, block) => total + block.people.length, 0);
}

function countServiceSongs(service: ServiceRecord) {
  return service.blocks.reduce((total, block) => total + block.songs.length, 0);
}

function isBlockReady(service: ServiceRecord, blockType: BlockType) {
  const block = getBlockByType(service, blockType);
  if (!block) {
    return false;
  }

  if (SONG_BLOCK_TYPES.has(blockType)) {
    return block.songs.length > 0;
  }

  return block.people.length > 0 || block.details.length > 0;
}

function getBlockSummary(service: ServiceRecord, blockType: BlockType) {
  const block = getBlockByType(service, blockType);
  if (!block) {
    return "Missing block";
  }

  const parts = [
    block.people.length ? `${block.people.length} people` : null,
    block.songs.length ? `${block.songs.length} songs` : null,
    block.details.length ? `${block.details.length} details` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "Needs content";
}

export default function WorshipServicePlannerClient() {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => apiFetch<ServiceRecord[]>("/api/services"),
  });

  const services = servicesQuery.data ?? [];
  const fallbackService =
    services.find((service) => service.ministryName === "Ladies Ministry") ?? services[0] ?? null;
  const resolvedSelectedServiceId =
    selectedServiceId && services.some((service) => service.id === selectedServiceId)
      ? selectedServiceId
      : fallbackService?.id ?? null;
  const selectedService =
    services.find((service) => service.id === resolvedSelectedServiceId) ?? null;

  const plannerStats = useMemo(() => {
    if (!selectedService) {
      return null;
    }

    const serviceBlockOrder = getServiceBlockOrder(selectedService.serviceVariant);
    const readyBlocks = serviceBlockOrder.filter((blockType) =>
      isBlockReady(selectedService, blockType)
    ).length;
    const doneJobs = selectedService.jobs.filter((job) => job.status === JobStatus.DONE).length;

    return {
      readyBlocks,
      totalBlocks: serviceBlockOrder.length,
      participants: countParticipants(selectedService),
      songs: countServiceSongs(selectedService),
      assets: selectedService.assets.length,
      doneJobs,
    };
  }, [selectedService]);

  if (servicesQuery.isLoading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-accent)]" />
      </main>
    );
  }

  return (
    <main className="min-h-full text-[var(--color-brand-ink)]">
      <header className="production-panel-strong flex flex-col gap-4 px-4 py-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="technical-label">SERVICE FLOW HUB</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em]">Run of service control</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
            Review the run of service and finish the remaining production preparation.
          </p>
        </div>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
          Worship service
          <select
            value={resolvedSelectedServiceId ?? ""}
            onChange={(event) => setSelectedServiceId(event.target.value)}
            className="min-h-10 min-w-[240px] rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 text-sm text-[var(--color-brand-ink)]"
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.ministryName} / {formatServiceDate(service.serviceDate)}
              </option>
            ))}
          </select>
        </label>
      </header>

      {services.length === 0 ? (
        <section className="mt-5 border border-dashed border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-8 text-center">
          <p className="text-sm font-semibold">No worship services yet.</p>
        </section>
      ) : null}

      {selectedService && plannerStats ? (
        <div className="mt-5 animate-fade-in">
          <section className="production-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[var(--color-brand-border)] px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="status-pip status-pip-ready" />
                  <h2 className="text-base font-semibold text-[var(--color-brand-ink)]">
                    {selectedService.ministryName}
                  </h2>
                  <p className="font-[var(--font-plex-mono)] text-xs text-[var(--color-text-muted)]">
                    {formatServiceDate(selectedService.serviceDate)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {selectedService.theme || "No theme recorded yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void servicesQuery.refetch()}
                className="pressable inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-strong)] px-3 text-sm font-medium text-[var(--color-brand-ink)]"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-brand-border)] md:grid-cols-5 md:divide-y-0">
              {[
                ["Ready blocks", `${plannerStats.readyBlocks}/${plannerStats.totalBlocks}`],
                ["People", plannerStats.participants],
                ["Songs", plannerStats.songs],
                ["Assets", plannerStats.assets],
                ["Done jobs", plannerStats.doneJobs],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 bg-[var(--color-brand-panel)]/60 px-4 py-3">
                  <p className="technical-label">{label}</p>
                  <p className="mt-1 font-[var(--font-plex-mono)] text-lg font-semibold text-[var(--color-brand-ink)]">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="technical-label tracking-[0.2em] text-[var(--color-focus)]">SERVICE TIMELINE</p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-[var(--color-brand-ink)]">
                    Live Execution Flow
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-danger)]">
                    <span className="status-pip status-pip-live" />
                    Live
                  </span>
                  <span className="font-[var(--font-mono)] text-sm text-[var(--color-text-secondary)]">
                    Elapsed: <span className="text-[var(--color-brand-ink)]">14:22</span>
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {getServiceBlockOrder(selectedService.serviceVariant).map((blockType, index) => {
                  const block = getBlockByType(selectedService, blockType);
                  const ready = isBlockReady(selectedService, blockType);
                  const active = index === 1;
                  const time = `09:${String(index * 4).padStart(2, "0")}`;

                  return (
                    <div key={blockType} className={`flex gap-4 ${index === 0 ? "opacity-55" : ""}`}>
                      <div className="flex w-16 flex-col items-center pt-2">
                        <span className={`font-[var(--font-mono)] text-xs ${active ? "text-[var(--color-focus)]" : "text-[var(--color-text-muted)]"}`}>
                          {time}
                        </span>
                        <div className="my-2 w-px flex-1 bg-[var(--color-brand-border)]" />
                      </div>
                      <article
                        className={`flex min-h-20 flex-1 items-center justify-between rounded-xl border p-4 ${
                          active
                            ? "border-[var(--color-focus)]/40 bg-[var(--color-brand-panel-strong)] shadow-[inset_4px_0_0_var(--color-focus)]"
                            : "border-[var(--color-brand-border)] bg-[var(--color-brand-panel)]"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[var(--color-brand-panel-elevated)] text-[var(--color-focus)]" : "bg-[var(--color-brand-panel-strong)] text-[var(--color-text-secondary)]"}`}>
                            {active ? <Play className="h-5 w-5" /> : ready ? <Check className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <h3 className={`${active ? "text-2xl" : "text-lg"} font-bold text-[var(--color-brand-ink)]`}>
                              {BLOCK_LABELS[blockType]}
                            </h3>
                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                              {getBlockSummary(selectedService, blockType)}
                            </p>
                            {block?.songs.length ? (
                              <p className="mt-2 inline-flex rounded-md bg-[var(--color-brand-panel-elevated)] px-2 py-1 font-[var(--font-mono)] text-xs text-[var(--color-text-secondary)]">
                                {block.songs[0]?.song.title}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          {active ? (
                            <>
                              <p className="font-[var(--font-mono)] text-3xl font-bold text-[var(--color-focus)]">03:41</p>
                              <p className="mt-1 text-[10px] font-bold uppercase text-[var(--color-text-secondary)]">Remaining</p>
                            </>
                          ) : (
                            <span className={`inline-flex items-center gap-2 text-xs font-semibold ${ready ? "text-[var(--color-success)]" : "text-[var(--color-clay)]"}`}>
                              <span className={`status-pip ${ready ? "status-pip-ready" : "status-pip-alert"}`} />
                              {ready ? "Ready" : "Prep"}
                            </span>
                          )}
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>

              <section className="mt-8 rounded-xl border border-[var(--color-brand-border)] bg-[#14151d] p-8">
                <div className="grid gap-5 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-[var(--color-brand-ink)]">Production Quick Actions</h2>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--color-text-secondary)]">
                      Instantly trigger global service states from the booth.
                    </p>
                  </div>
                  <button className="pressable rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-soft)]/35 px-5 py-3 text-sm font-bold uppercase text-[var(--color-danger)]">
                    Emergency Reset
                  </button>
                  <button className="pressable rounded-xl border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-5 py-3 text-sm font-bold uppercase text-[var(--color-secondary)]">
                    Blackout
                  </button>
                </div>
              </section>
            </section>

            <aside className="space-y-6 border-l border-[var(--color-brand-border)] pl-5">
              <section>
                <p className="technical-label">NEXT UP PREVIEW</p>
                <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-[#060e20]">
                  <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_center,#3b235f,#060e20_62%)]">
                    <Eye className="h-10 w-10 text-[var(--color-focus)]" />
                  </div>
                  <p className="px-4 py-3 text-sm font-bold text-[var(--color-brand-ink)]">Pastor Dave Standby</p>
                </div>
              </section>

              <section className="space-y-4">
                <p className="technical-label">ITEM DETAILS</p>
                <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
                  <p className="technical-label">SONG KEY</p>
                  <p className="mt-2 text-xl font-bold">B Minor <span className="text-sm font-medium text-[var(--color-text-secondary)]">/ 74 BPM</span></p>
                </div>
                <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
                  <p className="technical-label">LYRICS & CHORDS</p>
                  <p className="mt-2 text-sm text-[var(--color-brand-ink)]">glorious_day_chart.pdf</p>
                </div>
              </section>

              <section>
                <p className="technical-label">SYNC STATUS</p>
                <div className="mt-4 space-y-3">
                  {["Main FOH Console", "ProPresenter 7", "Lighting MIDI"].map((item, index) => (
                    <div key={item} className="flex items-center justify-between rounded-lg bg-[var(--color-brand-panel)] px-3 py-2 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <span className={`status-pip ${index < 2 ? "status-pip-ready" : ""}`} />
                        {item}
                      </span>
                      <span className="font-[var(--font-mono)] text-[10px] uppercase text-[var(--color-text-secondary)]">
                        {index < 2 ? "Linked" : "Idle"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      ) : (
        <section className="mt-4 border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-8 text-center">
          <h2 className="text-2xl font-semibold">No service to plan yet</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Create or seed a worship service, then return here to review the preparation flow.
          </p>
        </section>
      )}
    </main>
  );
}
