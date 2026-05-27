"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BlockType, JobStatus } from "@prisma/client";
import {
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  Music4,
  RefreshCcw,
  Sparkles,
  Users,
} from "lucide-react";
import { apiFetch, type ServiceRecord } from "@/lib/api-client";
import { BLOCK_LABELS, SONG_BLOCK_TYPES, STRICT_BLOCK_ORDER } from "@/lib/service-data";

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

  if (blockType === BlockType.DETAILS) {
    return block.details.length > 0 || service.details.length > 0;
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

function statusTone(ready: boolean) {
  return ready
    ? "border-[#d9f3e1] bg-[#d9f3e1] text-[#1aae39]"
    : "border-[#ffe8d4] bg-[#ffe8d4] text-[#793400]";
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

    const readyBlocks = STRICT_BLOCK_ORDER.filter((blockType) =>
      isBlockReady(selectedService, blockType)
    ).length;
    const doneJobs = selectedService.jobs.filter((job) => job.status === JobStatus.DONE).length;

    return {
      readyBlocks,
      participants: countParticipants(selectedService),
      songs: countServiceSongs(selectedService),
      assets: selectedService.assets.length,
      doneJobs,
    };
  }, [selectedService]);

  const prepLanes = useMemo(() => {
    if (!selectedService) {
      return [];
    }

    const callToWorship = getBlockByType(selectedService, BlockType.CALL_TO_WORSHIP);
    const scripture = getBlockByType(selectedService, BlockType.SCRIPTURE_READING);
    const sermon = getBlockByType(selectedService, BlockType.SERMON);
    const details = getBlockByType(selectedService, BlockType.DETAILS);

    return [
      {
        title: "People",
        icon: Users,
        tint: "bg-[#d9f3e1]",
        checks: [
          { label: "Call to Worship assigned", done: Boolean(callToWorship?.people.length) },
          { label: "MC assigned", done: isBlockReady(selectedService, BlockType.MC) },
          { label: "Offering team assigned", done: isBlockReady(selectedService, BlockType.OFFERING) },
          {
            label: "Flowers team assigned",
            done: isBlockReady(selectedService, BlockType.FLOWERS_FOR_THE_LORD),
          },
        ],
      },
      {
        title: "Music",
        icon: Music4,
        tint: "bg-[#e6e0f5]",
        checks: [
          {
            label: "Praise & Worship songs selected",
            done: isBlockReady(selectedService, BlockType.PRAISE_AND_WORSHIP),
          },
          {
            label: "Awit ng Pakikinig selected",
            done: isBlockReady(selectedService, BlockType.AWIT_NG_PAKIKINIG),
          },
          {
            label: "Awit ng Pagtugon selected",
            done: isBlockReady(selectedService, BlockType.AWIT_NG_PAGTUGON),
          },
        ],
      },
      {
        title: "Message",
        icon: ClipboardList,
        tint: "bg-[#dcecfa]",
        checks: [
          { label: "Scripture reader assigned", done: Boolean(scripture?.people.length) },
          { label: "Sermon preacher assigned", done: Boolean(sermon?.people.length) },
          {
            label: "Bible references captured",
            done: Boolean(scripture?.details.length || sermon?.details.length || details?.details.length),
          },
        ],
      },
      {
        title: "Files",
        icon: FileText,
        tint: "bg-[#fef7d6]",
        checks: [
          { label: "Service assets attached", done: selectedService.assets.length > 0 },
          { label: "Automation output available", done: selectedService.outputs.length > 0 },
          { label: "Completed automation job", done: selectedService.jobs.some((job) => job.status === JobStatus.DONE) },
        ],
      },
    ];
  }, [selectedService]);

  if (servicesQuery.isLoading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center rounded-xl border border-[#e5e3df] bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#5645d4]" />
      </main>
    );
  }

  return (
    <main className="min-h-full bg-white text-[#1a1a1a]">
      <section className="overflow-hidden rounded-xl bg-[#0a1530] text-white shadow-[rgba(15,15,15,0.20)_0px_24px_48px_-8px]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_420px] lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              <CalendarDays className="h-3.5 w-3.5" />
              Worship Service Planner
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
              Plan the service flow before Sunday pressure arrives.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#d8dce8]">
              Review the strict worship order, confirm assignments, and spot missing preparation work from one focused planner.
            </p>
          </div>

          <div className="rounded-xl border border-white/15 bg-white text-[#1a1a1a]">
            <div className="border-b border-[#e5e3df] px-4 py-3">
              <p className="text-sm font-semibold">Selected service</p>
            </div>
            <div className="max-h-[260px] space-y-2 overflow-y-auto p-3">
              {services.length === 0 ? (
                <p className="p-3 text-sm text-[#5d5b54]">No worship services yet.</p>
              ) : (
                services.map((service) => {
                  const active = selectedService?.id === service.id;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedServiceId(service.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm ${
                        active
                          ? "border-[#5645d4] bg-[#e6e0f5]"
                          : "border-[#e5e3df] bg-white text-[#37352f]"
                      }`}
                    >
                      <span>
                        <span className="block font-semibold">{service.ministryName}</span>
                        <span className="mt-1 block text-xs text-[#787671]">
                          {formatServiceDate(service.serviceDate)}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-[#787671]" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {selectedService && plannerStats ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-xl border border-[#e5e3df] bg-[#f6f5f4] p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-[#787671]">
                  {formatServiceDate(selectedService.serviceDate)}
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-[#1a1a1a]">
                  {selectedService.ministryName}
                </h2>
                <p className="mt-1 text-sm text-[#5d5b54]">
                  {selectedService.theme || "No theme recorded yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void servicesQuery.refetch()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c8c4be] bg-white px-3 text-sm font-medium text-[#37352f]"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              {[
                ["Ready blocks", `${plannerStats.readyBlocks}/10`],
                ["People", plannerStats.participants],
                ["Songs", plannerStats.songs],
                ["Assets", plannerStats.assets],
                ["Done jobs", plannerStats.doneJobs],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#e5e3df] bg-white p-3">
                  <p className="text-xs font-medium text-[#787671]">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-[#1a1a1a]">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-[#e5e3df] bg-white">
              <div className="grid grid-cols-[72px_1fr_140px] border-b border-[#e5e3df] px-4 py-3 text-xs font-semibold uppercase text-[#787671]">
                <span>Order</span>
                <span>Service block</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-[#ede9e4]">
                {STRICT_BLOCK_ORDER.map((blockType, index) => {
                  const block = getBlockByType(selectedService, blockType);
                  const ready = isBlockReady(selectedService, blockType);

                  return (
                    <div
                      key={blockType}
                      className="grid grid-cols-[72px_1fr_140px] items-start gap-3 px-4 py-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0eeec] text-sm font-semibold text-[#37352f]">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-[#1a1a1a]">{BLOCK_LABELS[blockType]}</p>
                        <p className="mt-1 text-sm text-[#5d5b54]">
                          {getBlockSummary(selectedService, blockType)}
                        </p>
                        {block?.songs.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {block.songs.map((serviceSong) => (
                              <span
                                key={serviceSong.id}
                                className="rounded-md bg-[#dcecfa] px-2 py-1 text-xs font-semibold text-[#005bab]"
                              >
                                {serviceSong.song.title}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(ready)}`}
                      >
                        {ready ? "Ready" : "Needs prep"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#e5e3df] bg-[#f9e79f] p-5 text-[#37352f]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Prep Focus</h2>
              </div>
              <p className="mt-3 text-sm leading-6">
                Work through the unchecked items first. The flow table stays locked to the approved worship order.
              </p>
            </section>

            {prepLanes.map((lane) => {
              const Icon = lane.icon;
              return (
                <section key={lane.title} className="rounded-xl border border-[#e5e3df] bg-white p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${lane.tint}`}>
                      <Icon className="h-4 w-4 text-[#37352f]" />
                    </div>
                    <h3 className="font-semibold text-[#1a1a1a]">{lane.title}</h3>
                  </div>
                  <div className="space-y-2">
                    {lane.checks.map((check) => (
                      <div key={check.label} className="flex items-center gap-2 text-sm text-[#37352f]">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                            check.done
                              ? "border-[#1aae39] bg-[#d9f3e1] text-[#1aae39]"
                              : "border-[#c8c4be] bg-[#f6f5f4] text-transparent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        {check.label}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </aside>
        </div>
      ) : (
        <section className="mt-4 rounded-xl border border-[#e5e3df] bg-white p-8 text-center">
          <h2 className="text-2xl font-semibold">No service to plan yet</h2>
          <p className="mt-2 text-sm text-[#5d5b54]">
            Create or seed a worship service, then return here to review the preparation flow.
          </p>
        </section>
      )}
    </main>
  );
}
