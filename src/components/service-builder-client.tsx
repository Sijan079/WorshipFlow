"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { AssetType, BlockType, JobType, ServiceStatus } from "@prisma/client";
import { Loader2, Plus, RefreshCcw, Save, Settings2, Upload, WandSparkles, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  apiFetch,
  type CreateAssetMetadataPayload,
  type CreateAutomationJobPayload,
  type CreateParticipantPayload,
  type CreateServicePayload,
  type CreateSongTagPresetPayload,
  type LyricsExtractorEditableResponse,
  type ServiceRecord,
  type SongTagPresetRecord,
  type UpdateParticipantPayload,
  type UpdateServicePayload,
  type UpdateSongTagPresetPayload,
  type UpsertServiceDetailPayload,
  generateLyricsDocx,
  runAiLyricsExtractorRetry,
  runPasteLyricsExtractor,
  runUploadLyricsExtractor,
  triggerBrowserDownload,
} from "@/lib/api-client";
import { BLOCK_LABELS, SONG_BLOCK_TYPES, STRICT_BLOCK_ORDER } from "@/lib/service-data";
import type { LyricsExtractorAiRetryDescriptor, LyricsExtractorSafeOutput } from "@/lib/extractor-types";

const createServiceFormSchema = z.object({
  serviceDate: z.string().min(1, "Service date is required"),
  ministryName: z.string().min(1, "Ministry name is required"),
  theme: z.string().optional(),
});

const updateServiceFormSchema = z.object({
  serviceDate: z.string().min(1, "Service date is required"),
  ministryName: z.string().min(1, "Ministry name is required"),
  theme: z.string().optional(),
  status: z.nativeEnum(ServiceStatus),
});

type CreateServiceFormValues = z.infer<typeof createServiceFormSchema>;
type UpdateServiceFormValues = z.infer<typeof updateServiceFormSchema>;
type WorkspaceModule = "services" | "songs" | "assets" | "automation";

const PASTEL_TAG_COLORS = ["#DDECCB", "#F7E7B2", "#FFDCC8", "#CFE8F6", "#E8D7F1", "#F7D7DF", "#D6F0E4"];
const NEUTRAL_TAG_COLOR = "#E8E1D4";

function normalizeTagToken(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

function getReadableTextColor(hexColor: string) {
  const normalized = hexColor.replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.7 ? "#1f2a24" : "#ffffff";
}

function buildTaggedEditorBackground(text: string, tags: SongTagPresetRecord[]) {
  const tagColorByToken = new Map(tags.map((tag) => [tag.token.toLowerCase(), tag.color]));
  const lineHeight = 24;
  const paddingTop = 12;
  const segments: string[] = [];
  let cursor = 0;
  let currentColor = "transparent";

  text.split("\n").forEach((line, index) => {
    const match = /^\[([^\]]+)\]\s*$/.exec(line.trim());
    if (match) {
      const tag = match[1].trim();
      currentColor = tagColorByToken.get(tag.toLowerCase()) ?? NEUTRAL_TAG_COLOR;
    }

    if (currentColor !== "transparent") {
      const top = paddingTop + index * lineHeight;
      const bottom = top + lineHeight;
      if (cursor < top) {
        segments.push(`transparent ${cursor}px ${top}px`);
      }
      segments.push(`${currentColor} ${top}px ${bottom}px`);
      cursor = bottom;
    }
  });

  return segments.length ? `linear-gradient(to bottom, ${segments.join(", ")}, transparent)` : undefined;
}

type TaggedDraftSection = {
  tag: string | null;
  lines: string[];
};

function normalizeEditorTag(value: string) {
  return value.trim().toLowerCase();
}

function parseTaggedDraft(text: string) {
  const sections: TaggedDraftSection[] = [];
  let current: TaggedDraftSection = { tag: null, lines: [] };

  for (const line of text.split(/\r?\n/)) {
    const tagMatch = line.trim().match(/^\[([^\]]+)\]$/);
    if (tagMatch) {
      if (current.tag !== null || current.lines.some((entry) => entry.trim().length > 0)) {
        sections.push(current);
      }
      current = { tag: tagMatch[1].trim(), lines: [] };
      continue;
    }

    current.lines.push(line);
  }

  if (current.tag !== null || current.lines.some((entry) => entry.trim().length > 0)) {
    sections.push(current);
  }

  return sections;
}

function serializeTaggedDraft(sections: TaggedDraftSection[]) {
  return sections
    .map((section) => {
      const body = section.lines.join("\n").trim();
      return section.tag ? [`[${section.tag}]`, body].filter(Boolean).join("\n") : body;
    })
    .filter((section) => section.trim().length > 0)
    .join("\n\n")
    .trim();
}

function regroupDraftTagSections(text: string, tagToken: string, groupSize: 2 | 3) {
  const targetTag = normalizeEditorTag(tagToken);
  const sourceSections = parseTaggedDraft(text);
  const regrouped: TaggedDraftSection[] = [];
  let index = 0;

  while (index < sourceSections.length) {
    const section = sourceSections[index];
    if (!section.tag || normalizeEditorTag(section.tag) !== targetTag) {
      regrouped.push(section);
      index += 1;
      continue;
    }

    const run: TaggedDraftSection[] = [];
    while (
      index < sourceSections.length &&
      sourceSections[index].tag &&
      normalizeEditorTag(sourceSections[index].tag ?? "") === targetTag
    ) {
      run.push(sourceSections[index]);
      index += 1;
    }

    const lyricLines = run
      .flatMap((entry) => entry.lines)
      .map((line) => line.trim())
      .filter(Boolean);

    for (let lineIndex = 0; lineIndex < lyricLines.length; lineIndex += groupSize) {
      regrouped.push({
        tag: run[0].tag,
        lines: lyricLines.slice(lineIndex, lineIndex + groupSize),
      });
    }
  }

  return serializeTaggedDraft(regrouped);
}

const JOB_DESCRIPTIONS: Record<JobType, string> = {
  TRANSPOSE: "Extract lyrics from a secure temporary chord-sheet input.",
  FREESHOW_GENERATE: "Generate a mock FreeShow export artifact.",
  CAPTION_GENERATE: "Generate a mock caption output package.",
};

const MODULE_CONTENT: Record<
  WorkspaceModule,
  { eyebrow: string; title: string; description: string }
> = {
  services: {
    eyebrow: "Service Builder",
    title: "Worship Service Flow",
    description:
      "Build the service flow in the exact worship order, keep participants and songs attached to their proper blocks, and prepare outputs for the tech team.",
  },
  songs: {
    eyebrow: "Songs",
    title: "Song Lyrics Extractor",
    description:
      "Securely extract lyrics and chord-sheet text from one temporary file or pasted text with zero persistence.",
  },
  assets: {
    eyebrow: "Assets",
    title: "Service Files",
    description:
      "Attach and review persistent service assets such as PDFs, screenshots, media files, and supporting documents.",
  },
  automation: {
    eyebrow: "Automation",
    title: "Automation Modules",
    description:
      "Run export workflows and review safe automation job history without embedding the extractor workflow here.",
  },
};

function toDateInputValue(dateString: string) {
  return new Date(dateString).toISOString().slice(0, 10);
}

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

function getExtractorSummary(outputJson: unknown) {
  if (!outputJson || typeof outputJson !== "object") {
    return null;
  }

  const record = outputJson as Partial<LyricsExtractorSafeOutput>;
  if (typeof record.extractedLineCount !== "number") {
    return null;
  }

  const sectionText =
    typeof record.sectionCount === "number" ? ` · ${record.sectionCount} sections` : "";
  return `${record.extractedLineCount} extracted lines${sectionText}`;
}

export default function ServiceBuilderClient({ module }: { module: WorkspaceModule }) {
  const queryClient = useQueryClient();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [extractorSourceMode, setExtractorSourceMode] = useState<"upload" | "paste">("upload");
  const [extractorStatus, setExtractorStatus] = useState<string | null>(null);
  const [extractorFileLabel, setExtractorFileLabel] = useState<string | null>(null);
  const [extractorSongTitle, setExtractorSongTitle] = useState("");
  const [extractorPastedText, setExtractorPastedText] = useState("");
  const [extractorAiRetry, setExtractorAiRetry] = useState<LyricsExtractorAiRetryDescriptor | null>(null);
  const [extractorDraftText, setExtractorDraftText] = useState("");
  const [extractorDraftMeta, setExtractorDraftMeta] = useState<LyricsExtractorSafeOutput | null>(null);
  const [tagSettingsOpen, setTagSettingsOpen] = useState(false);
  const [sectionFormatTag, setSectionFormatTag] = useState("Verse");
  const [sectionLineGroupSize, setSectionLineGroupSize] = useState<2 | 3>(2);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(PASTEL_TAG_COLORS[0]);
  const extractorEditorRef = useRef<HTMLTextAreaElement | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => apiFetch<ServiceRecord[]>("/api/services"),
  });

  const songTagsQuery = useQuery({
    queryKey: ["song-tags"],
    queryFn: () => apiFetch<SongTagPresetRecord[]>("/api/song-tags"),
  });

  const services = servicesQuery.data ?? [];
  const songTags = songTagsQuery.data ?? [];

  const createServiceForm = useForm<CreateServiceFormValues>({
    resolver: zodResolver(createServiceFormSchema),
    defaultValues: {
      serviceDate: new Date().toISOString().slice(0, 10),
      ministryName: "",
      theme: "",
    },
  });

  const serviceHeaderForm = useForm<UpdateServiceFormValues>({
    resolver: zodResolver(updateServiceFormSchema),
    defaultValues: {
      serviceDate: new Date().toISOString().slice(0, 10),
      ministryName: "",
      theme: "",
      status: ServiceStatus.DRAFT,
    },
  });

  const invalidateServices = async () => {
    await queryClient.invalidateQueries({ queryKey: ["services"] });
  };

  const invalidateSongTags = async () => {
    await queryClient.invalidateQueries({ queryKey: ["song-tags"] });
  };

  const createServiceMutation = useMutation({
    mutationFn: (payload: CreateServicePayload) =>
      apiFetch<ServiceRecord>("/api/services", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (service) => {
      await invalidateServices();
      setSelectedServiceId(service.id);
      createServiceForm.reset({
        serviceDate: new Date().toISOString().slice(0, 10),
        ministryName: "",
        theme: "",
      });
      setFeedback("Service created.");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateServicePayload }) =>
      apiFetch<ServiceRecord>(`/api/services/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await invalidateServices();
      setFeedback("Service updated.");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const participantMutation = useMutation({
    mutationFn: ({
      serviceId,
      blockId,
      personId,
      payload,
    }: {
      serviceId: string;
      blockId: string;
      personId?: string;
      payload: CreateParticipantPayload | UpdateParticipantPayload;
    }) =>
      apiFetch(
        personId
          ? `/api/services/${serviceId}/blocks/${blockId}/people/${personId}`
          : `/api/services/${serviceId}/blocks/${blockId}/people`,
        {
          method: personId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: async () => {
      await invalidateServices();
      setFeedback("Participant saved.");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const deleteParticipantMutation = useMutation({
    mutationFn: ({
      serviceId,
      blockId,
      personId,
    }: {
      serviceId: string;
      blockId: string;
      personId: string;
    }) =>
      apiFetch(`/api/services/${serviceId}/blocks/${blockId}/people/${personId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await invalidateServices();
      setFeedback("Participant removed.");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const deleteServiceSongMutation = useMutation({
    mutationFn: ({
      serviceId,
      serviceSongId,
    }: {
      serviceId: string;
      serviceSongId: string;
    }) =>
      apiFetch(`/api/services/${serviceId}/songs/${serviceSongId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await invalidateServices();
      setFeedback("Song removed from service.");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const upsertDetailMutation = useMutation({
    mutationFn: ({
      serviceId,
      payload,
    }: {
      serviceId: string;
      payload: UpsertServiceDetailPayload;
    }) =>
      apiFetch(`/api/services/${serviceId}/details`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await invalidateServices();
      setFeedback("Detail saved.");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const uploadAssetMutation = useMutation({
    mutationFn: ({
      serviceId,
      formData,
      jsonPayload,
    }: {
      serviceId: string;
      formData?: FormData;
      jsonPayload?: CreateAssetMetadataPayload;
    }) =>
      apiFetch(`/api/services/${serviceId}/assets`, {
        method: "POST",
        body: formData ?? JSON.stringify(jsonPayload),
      }),
    onSuccess: async () => {
      await invalidateServices();
      setFeedback("Asset stored.");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const createJobMutation = useMutation({
    mutationFn: ({
      serviceId,
      payload,
    }: {
      serviceId: string;
      payload: CreateAutomationJobPayload;
    }) =>
      apiFetch(`/api/services/${serviceId}/jobs`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setFeedback("Automation queued.");
      await invalidateServices();
      window.setTimeout(() => {
        void invalidateServices();
      }, 2500);
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const createSongTagMutation = useMutation({
    mutationFn: (payload: CreateSongTagPresetPayload) =>
      apiFetch<SongTagPresetRecord>("/api/song-tags", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setNewTagLabel("");
      await invalidateSongTags();
      setFeedback("Song tag preset created.");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const updateSongTagMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSongTagPresetPayload }) =>
      apiFetch<SongTagPresetRecord>(`/api/song-tags/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await invalidateSongTags();
      setFeedback("Song tag preset updated.");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const deleteSongTagMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/song-tags/${id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await invalidateSongTags();
      setFeedback("Song tag preset deleted.");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const applySongTagToDraft = (tag: SongTagPresetRecord) => {
    const editor = extractorEditorRef.current;
    const marker = `[${tag.token}]`;

    if (!editor) {
      setExtractorDraftText((current) => `${current}${current.endsWith("\n") || !current ? "" : "\n"}${marker}\n`);
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const before = extractorDraftText.slice(0, start);
    const selected = extractorDraftText.slice(start, end);
    const after = extractorDraftText.slice(end);
    const needsLeadingBreak = before.length > 0 && !before.endsWith("\n");
    const insertion = selected ? `${marker}\n${selected}` : `${marker}\n`;
    const nextText = `${before}${needsLeadingBreak ? "\n" : ""}${insertion}${after}`;
    const cursorPosition = before.length + (needsLeadingBreak ? 1 : 0) + insertion.length;

    setExtractorDraftText(nextText);
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const applyExtractorResult = (result: LyricsExtractorEditableResponse) => {
    setExtractorDraftText(result.text);
    setExtractorDraftMeta(result.outputJson);
    setExtractorAiRetry(result.retry ?? null);

    if (result.retry) {
      setExtractorStatus("Local extraction is ready for review, but confidence is low.");
      setFeedback(
        "This file may contain multiple embedded versions or unclear structure. Use AI cleanup only if you want a one-time assisted retry."
      );
      return result;
    }

    setExtractorStatus("Lyrics extracted. Review and edit before generating DOCX.");
    return result;
  };

  const uploadExtractorMutation = useMutation({
    mutationFn: async ({ serviceId, file, songTitle }: { serviceId: string; file: File; songTitle?: string }) => {
      const extractingTimer = window.setTimeout(() => {
        setExtractorStatus("Extracting...");
      }, 500);

      try {
        return applyExtractorResult(await runUploadLyricsExtractor({ serviceId, file, songTitle }));
      } finally {
        window.clearTimeout(extractingTimer);
      }
    },
    onSuccess: async (result) => {
      await invalidateServices();
      setFeedback(
        result.retry
          ? "Lyrics extracted with warnings. Review the draft or use AI cleanup before generating DOCX."
          : "Lyrics extracted into the editor. Review your draft before generating DOCX."
      );
    },
    onError: (error: Error) => {
      setExtractorStatus("Extraction failed.");
      setFeedback(error.message);
    },
  });

  const pasteExtractorMutation = useMutation({
    mutationFn: async ({
      serviceId,
      pastedText,
      songTitle,
    }: {
      serviceId: string;
      pastedText: string;
      songTitle?: string;
    }) => {
      return applyExtractorResult(await runPasteLyricsExtractor({ serviceId, pastedText, songTitle }));
    },
    onSuccess: async (result) => {
      await invalidateServices();
      setFeedback(
        result.retry
          ? "Pasted lyrics were normalized with warnings. Review the draft before generating DOCX."
          : "Pasted lyrics were normalized into the editor."
      );
    },
    onError: (error: Error) => {
      setExtractorStatus("Extraction failed.");
      setFeedback(error.message);
    },
  });

  const aiExtractorRetryMutation = useMutation({
    mutationFn: async ({ serviceId, retryToken }: { serviceId: string; retryToken: string }) => {
      return applyExtractorResult(await runAiLyricsExtractorRetry({ serviceId, retryToken }));
    },
    onSuccess: async () => {
      setExtractorAiRetry(null);
      setExtractorStatus("AI-cleaned lyrics are ready for review.");
      await invalidateServices();
      setFeedback("AI cleanup completed for this one-time extraction. Review before generating DOCX.");
    },
    onError: (error: Error) => {
      setExtractorStatus(error.message);
      setFeedback(error.message);
    },
  });

  const generateLyricsDocxMutation = useMutation({
    mutationFn: async ({ serviceId, text, songTitle }: { serviceId: string; text: string; songTitle?: string }) => {
      const result = await generateLyricsDocx({ serviceId, text, songTitle });
      triggerBrowserDownload(result.blob, result.fileName);
      return result.fileName;
    },
    onSuccess: (fileName) => {
      setExtractorStatus(`DOCX generated: ${fileName}`);
      setFeedback("Reviewed lyrics downloaded as DOCX. Edited lyrics were not stored.");
    },
    onError: (error: Error) => {
      setExtractorStatus("DOCX generation failed.");
      setFeedback(error.message);
    },
  });

  const resolvedSelectedServiceId =
    selectedServiceId && services.some((service) => service.id === selectedServiceId)
      ? selectedServiceId
      : (services.find((service) => service.ministryName === "Ladies Ministry") ?? services[0])?.id ?? null;

  const selectedService =
    services.find((service) => service.id === resolvedSelectedServiceId) ?? null;

  useEffect(() => {
    if (!selectedService) {
      return;
    }

    serviceHeaderForm.reset({
      serviceDate: toDateInputValue(selectedService.serviceDate),
      ministryName: selectedService.ministryName,
      theme: selectedService.theme ?? "",
      status: selectedService.status,
    });
  }, [selectedService, serviceHeaderForm]);

  const pageBusy = servicesQuery.isLoading;
  const moduleCopy = MODULE_CONTENT[module];
  const showServiceSidebar = module === "services";

  return (
    <div className="min-h-full space-y-5">
      {module === "songs" ? (
        <section className="border-b border-black/10 pb-8">
          <h1 className="font-serif text-4xl font-semibold tracking-[-0.04em] text-black md:text-5xl">
            Song Formatter
          </h1>
          <p className="mt-2 text-lg text-black/60">
            Upload a song file and get a clean FreeShow-ready lyrics file downloaded automatically.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl bg-[var(--color-brand-navy)] text-white shadow-[rgba(15,15,15,0.20)_0px_24px_48px_-8px]">
          <div className="relative p-6 lg:p-8">
            <div className="absolute right-8 top-8 h-16 w-16 rounded-xl bg-[#f9e79f] opacity-90" />
            <div className="absolute bottom-8 right-28 h-10 w-10 rounded-lg bg-[#ff64c8] opacity-80" />
            <div className="absolute right-48 top-20 h-8 w-8 rounded-lg bg-[#2a9d99] opacity-80" />
            <p className="relative z-10 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              {moduleCopy.eyebrow}
            </p>
            <h1 className="relative z-10 mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] md:text-5xl">
              {moduleCopy.title}
            </h1>
            <p className="relative z-10 mt-4 max-w-2xl text-base leading-7 text-white/75">
              {moduleCopy.description}
            </p>
          </div>
        </section>
      )}

      <div className={showServiceSidebar ? "flex min-h-full gap-4" : "block"}>
        {showServiceSidebar ? (
          <aside className="flex w-full max-w-xs flex-col rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-5">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-olive)]">
                Service Index
              </p>
              <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">Worship services</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                Select or create the worship service you are preparing.
              </p>
            </div>

        <section className="flex-1 overflow-hidden">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-olive)]">
              Services
            </h2>
            <button
              type="button"
              onClick={() => void invalidateServices()}
              className="rounded-lg border border-[var(--color-brand-border)] p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-brand-accent)]"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => {
                  setSelectedServiceId(service.id);
                  setExtractorStatus(null);
                  setExtractorFileLabel(null);
                  setExtractorAiRetry(null);
                }}
                className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                  selectedService?.id === service.id
                    ? "border-[var(--color-brand-accent)] bg-[var(--color-brand-panel-alt)]"
                    : "border-[var(--color-brand-border)] bg-white/70 hover:border-[var(--color-brand-accent)]"
                }`}
              >
                <p className="font-[var(--font-plex-mono)] text-xs uppercase tracking-[0.16em] text-[var(--color-brand-olive)]">
                  {formatServiceDate(service.serviceDate)}
                </p>
                <p className="mt-2 text-base font-semibold">{service.ministryName}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {service.theme || "No theme yet"}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-[var(--color-brand-accent)]" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-olive)]">
              New Service
            </h2>
          </div>
          <form
            className="space-y-3"
            onSubmit={createServiceForm.handleSubmit((values) => {
              setFeedback(null);
              createServiceMutation.mutate({
                serviceDate: new Date(values.serviceDate).toISOString(),
                ministryName: values.ministryName,
                theme: values.theme || null,
                status: ServiceStatus.DRAFT,
              });
            })}
          >
            <label className="block text-sm text-[var(--color-text-secondary)]">
              Service date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2"
                {...createServiceForm.register("serviceDate")}
              />
            </label>
            <label className="block text-sm text-[var(--color-text-secondary)]">
              Ministry
              <input
                type="text"
                placeholder="Ladies Ministry"
                className="mt-1 w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2"
                {...createServiceForm.register("ministryName")}
              />
            </label>
            <label className="block text-sm text-[var(--color-text-secondary)]">
              Theme
              <input
                type="text"
                placeholder="Optional theme"
                className="mt-1 w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2"
                {...createServiceForm.register("theme")}
              />
            </label>
            <button
              type="submit"
              disabled={createServiceMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-accent-hover)] disabled:opacity-60"
            >
              {createServiceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create service
            </button>
          </form>
        </section>
      </aside>
        ) : null}

      {module === "services" ? (
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <section className="rounded-[28px] border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-5 shadow-[0_24px_80px_rgba(61,49,31,0.08)]">
            {feedback ? (
              <div className="mb-4 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                {feedback}
              </div>
            ) : null}

            {pageBusy ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-accent)]" />
              </div>
            ) : selectedService ? (
              <>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-brand-border)] pb-6">
                  <div>
                    <p className="font-[var(--font-plex-mono)] text-xs uppercase tracking-[0.24em] text-[var(--color-brand-olive)]">
                      Service Builder
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold">
                      {formatServiceDate(selectedService.serviceDate)} - {selectedService.ministryName}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                      Build the service flow in the exact worship order, keep participants and songs attached to their proper blocks, and prepare outputs for the tech team.
                    </p>
                  </div>
                  <div className="rounded-full border border-[var(--color-brand-border)] bg-white px-4 py-2 font-[var(--font-plex-mono)] text-xs uppercase tracking-[0.16em] text-[var(--color-brand-olive)]">
                    {selectedService.status}
                  </div>
                </div>

                <form
                  className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
                  onSubmit={serviceHeaderForm.handleSubmit((values) => {
                    setFeedback(null);
                    updateServiceMutation.mutate({
                      id: selectedService.id,
                      payload: {
                        serviceDate: new Date(values.serviceDate).toISOString(),
                        ministryName: values.ministryName,
                        theme: values.theme || null,
                        status: values.status,
                      },
                    });
                  })}
                >
                  <label className="text-sm text-[var(--color-text-secondary)]">
                    Date
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2"
                      {...serviceHeaderForm.register("serviceDate")}
                    />
                  </label>
                  <label className="text-sm text-[var(--color-text-secondary)]">
                    Ministry
                    <input
                      type="text"
                      className="mt-1 w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2"
                      {...serviceHeaderForm.register("ministryName")}
                    />
                  </label>
                  <label className="text-sm text-[var(--color-text-secondary)]">
                    Theme
                    <input
                      type="text"
                      className="mt-1 w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2"
                      {...serviceHeaderForm.register("theme")}
                    />
                  </label>
                  <label className="text-sm text-[var(--color-text-secondary)]">
                    Status
                    <select
                      className="mt-1 w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2"
                      {...serviceHeaderForm.register("status")}
                    >
                      {Object.values(ServiceStatus).map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="md:col-span-2 xl:col-span-4">
                    <button
                      type="submit"
                      disabled={updateServiceMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-accent-hover)] disabled:opacity-60"
                    >
                      {updateServiceMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save service header
                    </button>
                  </div>
                </form>

                <div className="space-y-4">
                  {STRICT_BLOCK_ORDER.map((blockType) => {
                    const block = getBlockByType(selectedService, blockType);
                    if (!block) {
                      return null;
                    }

                    return (
                      <section
                        key={block.id}
                        className="animate-fade-in rounded-[24px] border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-5"
                      >
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-[var(--font-plex-mono)] text-xs uppercase tracking-[0.22em] text-[var(--color-brand-olive)]">
                              Block {block.order + 1}
                            </p>
                            <h3 className="mt-2 text-xl font-semibold">
                              {BLOCK_LABELS[block.blockType]}
                            </h3>
                          </div>
                          <div className="rounded-full border border-[var(--color-brand-border)] bg-white px-3 py-2 font-[var(--font-plex-mono)] text-xs uppercase tracking-[0.16em] text-[var(--color-brand-olive)]">
                            {block.people.length} people · {block.songs.length} songs · {block.details.length} details
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-3">
                          <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-4">
                            <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-olive)]">
                              Participants
                            </h4>
                            <div className="space-y-3">
                              {block.people.map((person) => (
                                <form
                                  key={person.id}
                                  className="space-y-2 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-3"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const formData = new FormData(event.currentTarget);
                                    participantMutation.mutate({
                                      serviceId: selectedService.id,
                                      blockId: block.id,
                                      personId: person.id,
                                      payload: {
                                        personName: String(formData.get("personName") ?? ""),
                                        personTitle: String(formData.get("personTitle") ?? "") || null,
                                        order: Number(formData.get("order") ?? person.order),
                                      },
                                    });
                                  }}
                                >
                                  <input
                                    name="personName"
                                    defaultValue={person.personName}
                                    className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                                  />
                                  <div className="grid gap-2 md:grid-cols-[1fr_96px]">
                                    <input
                                      name="personTitle"
                                      defaultValue={person.personTitle ?? ""}
                                      placeholder="Role or title"
                                      className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                                    />
                                    <input
                                      name="order"
                                      type="number"
                                      defaultValue={person.order}
                                      className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button type="submit" className="rounded-xl bg-[var(--color-brand-accent)] px-3 py-2 text-sm font-semibold text-white">
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteParticipantMutation.mutate({
                                          serviceId: selectedService.id,
                                          blockId: block.id,
                                          personId: person.id,
                                        })
                                      }
                                      className="rounded-xl border border-[var(--color-brand-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </form>
                              ))}

                              <form
                                className="space-y-2 rounded-2xl border border-dashed border-[var(--color-brand-border)] p-3"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const formData = new FormData(event.currentTarget);
                                  participantMutation.mutate({
                                    serviceId: selectedService.id,
                                    blockId: block.id,
                                    payload: {
                                      personName: String(formData.get("personName") ?? ""),
                                      personTitle: String(formData.get("personTitle") ?? "") || null,
                                      order: Number(formData.get("order") ?? block.people.length),
                                    },
                                  });
                                  event.currentTarget.reset();
                                }}
                              >
                                <input
                                  name="personName"
                                  placeholder="Add participant"
                                  className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                                />
                                <div className="grid gap-2 md:grid-cols-[1fr_96px]">
                                  <input
                                    name="personTitle"
                                    placeholder="Role or title"
                                    className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                                  />
                                  <input
                                    name="order"
                                    type="number"
                                    defaultValue={block.people.length}
                                    className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                                  />
                                </div>
                                <button type="submit" className="rounded-xl border border-[var(--color-brand-border)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-accent)]">
                                  Add participant
                                </button>
                              </form>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-4">
                            <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-olive)]">
                              Songs
                            </h4>
                            {block.songs.length === 0 ? (
                              <p className="text-sm text-[var(--color-text-secondary)]">No songs attached to this block yet.</p>
                            ) : (
                              <div className="space-y-3">
                                {block.songs.map((serviceSong) => (
                                  <div
                                    key={serviceSong.id}
                                    className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-3"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-semibold">{serviceSong.song.title}</p>
                                        <p className="text-sm text-[var(--color-text-secondary)]">
                                          {serviceSong.song.author || "Unknown author"} · {serviceSong.songRole}
                                          {serviceSong.pageRef ? ` · ${serviceSong.pageRef}` : ""}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteServiceSongMutation.mutate({
                                            serviceId: selectedService.id,
                                            serviceSongId: serviceSong.id,
                                          })
                                        }
                                        className="rounded-full border border-[var(--color-brand-border)] p-2 text-[var(--color-text-secondary)]"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {!SONG_BLOCK_TYPES.has(block.blockType) ? (
                              <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                                Use the secure extractor from the Songs page when you need temporary chord-sheet processing.
                              </p>
                            ) : null}
                          </div>

                          <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-4">
                            <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-olive)]">
                              Details
                            </h4>
                            <div className="space-y-3">
                              {block.details.map((detail) => (
                                <form
                                  key={detail.id}
                                  className="space-y-2 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-3"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const formData = new FormData(event.currentTarget);
                                    upsertDetailMutation.mutate({
                                      serviceId: selectedService.id,
                                      payload: {
                                        key: String(formData.get("key") ?? ""),
                                        value: String(formData.get("value") ?? ""),
                                        blockId: block.id,
                                      },
                                    });
                                  }}
                                >
                                  <input
                                    name="key"
                                    defaultValue={detail.key}
                                    className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                                  />
                                  <textarea
                                    name="value"
                                    defaultValue={detail.value}
                                    rows={2}
                                    className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                                  />
                                  <button type="submit" className="rounded-xl bg-[var(--color-brand-accent)] px-3 py-2 text-sm font-semibold text-white">
                                    Save detail
                                  </button>
                                </form>
                              ))}

                              <form
                                className="space-y-2 rounded-2xl border border-dashed border-[var(--color-brand-border)] p-3"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const formData = new FormData(event.currentTarget);
                                  upsertDetailMutation.mutate({
                                    serviceId: selectedService.id,
                                    payload: {
                                      key: String(formData.get("key") ?? ""),
                                      value: String(formData.get("value") ?? ""),
                                      blockId: block.id,
                                    },
                                  });
                                  event.currentTarget.reset();
                                }}
                              >
                                <input
                                  name="key"
                                  placeholder="Detail key"
                                  className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                                />
                                <textarea
                                  name="value"
                                  rows={2}
                                  placeholder="Detail value"
                                  className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                                />
                                <button type="submit" className="rounded-xl border border-[var(--color-brand-border)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-accent)]">
                                  Add detail
                                </button>
                              </form>
                            </div>
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[var(--color-brand-border)] p-10 text-center">
                <h2 className="text-2xl font-semibold">No worship service selected</h2>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Create a service from the left sidebar or seed the database, then start building the worship flow.
                </p>
              </div>
            )}
          </section>
        </main>
      ) : null}

      <aside className={`${module === "services" ? "hidden" : "flex"} w-full flex-1 flex-col gap-4`}>
        {module === "songs" ? (
          <div className="space-y-5">
            {selectedService ? (
              <>
                {feedback ? (
                  <div className="rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black">
                    {feedback}
                  </div>
                ) : null}

                <section className="rounded-xl border border-black/10 bg-white p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExtractorSourceMode("upload");
                      setExtractorAiRetry(null);
                      setExtractorStatus(null);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                      extractorSourceMode === "upload"
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-white text-black/60"
                    }`}
                  >
                    Upload file
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExtractorSourceMode("paste");
                      setExtractorAiRetry(null);
                      setExtractorStatus(null);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                      extractorSourceMode === "paste"
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-white text-black/60"
                    }`}
                  >
                    Paste text
                  </button>
                  </div>
                  <input
                    value={extractorSongTitle}
                    onChange={(event) => setExtractorSongTitle(event.target.value)}
                    placeholder="Song title (optional)"
                    className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-black placeholder:text-black/40 md:w-[260px]"
                  />
                </div>

                {extractorSourceMode === "upload" ? (
                  <div className="mx-auto flex min-h-[300px] max-w-3xl flex-col items-center justify-center rounded-xl border border-dashed border-black/10 bg-white px-6 py-12 text-center">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-xl bg-black/5 text-black">
                      <Upload className="h-9 w-9" />
                    </div>
                    <p className="text-2xl font-semibold text-black">Upload a song file</p>
                    <p className="mt-3 text-base text-black/60">.txt, .docx, or .pdf - chords, notes, and all</p>
                    <input
                      name="file"
                      type="file"
                        accept=".txt,text/plain,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf"
                      className="mt-6 max-w-xs rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          setExtractorFileLabel(null);
                          setExtractorStatus("No file selected.");
                          setExtractorAiRetry(null);
                          return;
                        }

                        setFeedback(null);
                        setExtractorAiRetry(null);
                        setExtractorFileLabel(`${file.name} - ${Math.ceil(file.size / 1024)} KB`);
                        setExtractorDraftText("");
                        setExtractorDraftMeta(null);
                        setExtractorStatus("Uploading...");
                        uploadExtractorMutation.mutate({
                          serviceId: selectedService.id,
                          file,
                          songTitle: extractorSongTitle || undefined,
                        });
                        event.currentTarget.value = "";
                      }}
                    />
                  </div>
                ) : null}
                </section>

                <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
                  <p className="text-sm font-semibold">Extractor status</p>
                  <p className="mt-2 text-xs text-black/50">
                    Files are processed temporarily and removed after extraction. Lyrics appear here only for review and are not saved to the database.
                  </p>
                  <p className="mt-3 text-sm font-medium text-black">
                    {extractorStatus ??
                      (extractorSourceMode === "upload"
                        ? "No file selected."
                        : "Ready to extract pasted text.")}
                  </p>
                  {extractorFileLabel ? (
                    <div className="mt-3 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm">
                      {extractorFileLabel}
                    </div>
                  ) : null}
                  {extractorAiRetry ? (
                    <div className="mt-3 rounded-lg border border-black/10 bg-black/[0.04] px-3 py-3 text-sm text-black">
                      <p className="font-semibold">Manual AI cleanup available</p>
                      <p className="mt-1 text-xs leading-5 text-black/65">
                        The local parser found warning signals in this file. AI cleanup sends only the temporary extracted text for this one run and does not store lyrics.
                      </p>
                      <p className="mt-2 text-xs">
                        Confidence: {extractorAiRetry.confidence.toUpperCase()} Â· Warnings: {extractorAiRetry.warningCodes.join(", ")}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          selectedService &&
                          aiExtractorRetryMutation.mutate({
                            serviceId: selectedService.id,
                            retryToken: extractorAiRetry.retryToken,
                          })
                        }
                        disabled={aiExtractorRetryMutation.isPending}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {aiExtractorRetryMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <WandSparkles className="h-4 w-4" />
                        )}
                        {aiExtractorRetryMutation.isPending ? "Cleaning with AI..." : "Use AI cleanup"}
                      </button>
                    </div>
                  ) : null}
                </div>

                <section className="rounded-xl border border-black/10 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/60">
                        Quick tags
                      </p>
                      <p className="mt-1 text-xs text-black/50">
                        {extractorDraftText
                          ? "Select lines, then click a tag. No selection inserts the tag at the cursor."
                          : "Extract lyrics first, then use these tags to mark verses, choruses, and sections."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTagSettingsOpen((current) => !current)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/60"
                    >
                      <Settings2 className="h-4 w-4" />
                      {tagSettingsOpen ? "Hide settings" : "Tag settings"}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {songTagsQuery.isLoading ? (
                      <span className="text-sm text-black/50">Loading tag presets...</span>
                    ) : null}
                    {songTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => extractorDraftText && applySongTagToDraft(tag)}
                        disabled={!extractorDraftText}
                        className="rounded-full border border-black/5 px-3 py-2 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                        style={{
                          backgroundColor: tag.color,
                          color: getReadableTextColor(tag.color),
                        }}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>

                  {tagSettingsOpen ? (
                    <div className="mt-4 space-y-3 rounded-xl border border-black/10 bg-black/[0.02] p-3">
                      <form
                        className="grid gap-2 md:grid-cols-[1fr_auto_auto]"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const label = newTagLabel.trim();
                          const token = normalizeTagToken(label);
                          if (!label || !token) {
                            setFeedback("Enter a valid tag label.");
                            return;
                          }

                          createSongTagMutation.mutate({
                            label,
                            token,
                            color: newTagColor,
                            order: songTags.length,
                          });
                        }}
                      >
                        <input
                          value={newTagLabel}
                          onChange={(event) => setNewTagLabel(event.target.value)}
                          placeholder="Custom tag label"
                          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                        />
                        <select
                          value={newTagColor}
                          onChange={(event) => setNewTagColor(event.target.value)}
                          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                        >
                          {PASTEL_TAG_COLORS.map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          disabled={createSongTagMutation.isPending}
                          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          Add tag
                        </button>
                      </form>

                      <div className="grid gap-2">
                        {songTags.map((tag, index) => (
                          <div
                            key={tag.id}
                            className="grid gap-2 rounded-lg border border-black/10 bg-white p-2 md:grid-cols-[1fr_1fr_auto_auto]"
                          >
                            <input
                              defaultValue={tag.label}
                              onBlur={(event) => {
                                const label = event.target.value;
                                if (label === tag.label) {
                                  return;
                                }

                                updateSongTagMutation.mutate({
                                  id: tag.id,
                                  payload: {
                                    label,
                                    token: normalizeTagToken(label) || tag.token,
                                  },
                                });
                              }}
                              disabled={tag.isDefault}
                              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                            />
                            <select
                              value={tag.color}
                              onChange={(event) =>
                                updateSongTagMutation.mutate({
                                  id: tag.id,
                                  payload: { color: event.target.value },
                                })
                              }
                              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                            >
                              {PASTEL_TAG_COLORS.map((color) => (
                                <option key={color} value={color}>
                                  {color}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() =>
                                  updateSongTagMutation.mutate({
                                    id: tag.id,
                                    payload: { order: Math.max(0, tag.order - 1) },
                                  })
                                }
                                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs disabled:opacity-40"
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSongTagMutation.mutate({
                                    id: tag.id,
                                    payload: { order: tag.order + 1 },
                                  })
                                }
                                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"
                              >
                                Down
                              </button>
                            </div>
                            <button
                              type="button"
                              disabled={tag.isDefault || deleteSongTagMutation.isPending}
                              onClick={() => deleteSongTagMutation.mutate(tag.id)}
                              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/60 disabled:opacity-40"
                            >
                              {tag.isDefault ? "Default" : "Delete"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>

                {extractorDraftText ? (
                  <section className="mt-4 rounded-2xl border border-[var(--color-brand-border)] bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold">Review extracted lyrics</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                          Edit the structured text before generating the Word document. Tags like [Title], [Verse], and [Chorus] will be preserved in the DOCX.
                        </p>
                      </div>
                      {extractorDraftMeta ? (
                        <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                          {extractorDraftMeta.parser.toUpperCase()} / {extractorDraftMeta.confidence.toUpperCase()} confidence / {extractorDraftMeta.extractedLineCount} lines
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.02] p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/60">
                            Line grouping
                          </p>
                          <p className="mt-1 text-xs leading-5 text-black/50">
                            Choose a tag, then regroup consecutive sections into two-line or three-line singing blocks.
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            value={sectionFormatTag}
                            onChange={(event) => setSectionFormatTag(event.target.value)}
                            className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm font-semibold text-black"
                          >
                            {songTags.map((tag) => (
                              <option key={tag.id} value={tag.token}>
                                {tag.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex rounded-lg border border-black/10 bg-white p-1">
                            {[2, 3].map((size) => (
                              <button
                                key={size}
                                type="button"
                                onClick={() => setSectionLineGroupSize(size as 2 | 3)}
                                className={`rounded-md px-3 py-2 text-xs font-semibold ${
                                  sectionLineGroupSize === size
                                    ? "bg-black text-white"
                                    : "text-black/60 hover:bg-black/[0.04]"
                                }`}
                              >
                                {size} lines
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextDraft = regroupDraftTagSections(
                                extractorDraftText,
                                sectionFormatTag,
                                sectionLineGroupSize
                              );
                              setExtractorDraftText(nextDraft);
                              setExtractorStatus(
                                `${sectionFormatTag} sections regrouped into ${sectionLineGroupSize}-line blocks.`
                              );
                            }}
                            className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white"
                          >
                            Apply grouping
                          </button>
                        </div>
                      </div>
                    </div>

                    <textarea
                      ref={extractorEditorRef}
                      value={extractorDraftText}
                      onChange={(event) => setExtractorDraftText(event.target.value)}
                      rows={16}
                      spellCheck={false}
                      style={{
                        backgroundImage: buildTaggedEditorBackground(extractorDraftText, songTags),
                        backgroundAttachment: "local",
                        lineHeight: "24px",
                      }}
                      className="mt-4 min-h-[420px] w-full resize-y rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-4 py-3 font-mono text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-accent)]"
                    />

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedService || !extractorDraftText.trim()) {
                            setFeedback("Extract or enter lyrics before generating DOCX.");
                            return;
                          }

                          setExtractorStatus("Generating DOCX...");
                          generateLyricsDocxMutation.mutate({
                            serviceId: selectedService.id,
                            text: extractorDraftText,
                            songTitle: extractorSongTitle || undefined,
                          });
                        }}
                        disabled={generateLyricsDocxMutation.isPending}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-accent-hover)] disabled:opacity-60"
                      >
                        {generateLyricsDocxMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {generateLyricsDocxMutation.isPending ? "Generating DOCX..." : "Generate DOCX"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExtractorDraftText("");
                          setExtractorDraftMeta(null);
                          setExtractorAiRetry(null);
                          setExtractorStatus("Draft cleared.");
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text-secondary)]"
                      >
                        <X className="h-4 w-4" />
                        Clear draft
                      </button>
                    </div>
                  </section>
                ) : null}

                {extractorSourceMode === "paste" ? (
                  <form
                    className="space-y-3 rounded-xl border border-[var(--color-brand-border)] bg-white p-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const pastedText = extractorPastedText.trim();
                      if (!pastedText) {
                        setFeedback("Paste a chord sheet first.");
                        return;
                      }

                      setFeedback(null);
                      setExtractorAiRetry(null);
                      setExtractorDraftText("");
                      setExtractorDraftMeta(null);
                      setExtractorStatus("Extracting...");
                      pasteExtractorMutation.mutate({
                        serviceId: selectedService.id,
                        pastedText,
                        songTitle: extractorSongTitle || undefined,
                      });
                    }}
                  >
                    <textarea
                      value={extractorPastedText}
                      onChange={(event) => setExtractorPastedText(event.target.value)}
                      rows={8}
                      placeholder="Paste your chord sheet here. This text is processed temporarily and not stored."
                      className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                    />

                    <button
                      type="submit"
                      disabled={pasteExtractorMutation.isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-accent-hover)] disabled:opacity-60"
                    >
                      {pasteExtractorMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <WandSparkles className="h-4 w-4" />
                      )}
                      {pasteExtractorMutation.isPending ? "Extracting..." : "Extract lyrics"}
                    </button>
                  </form>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Select a service to use the secure lyrics extractor.
              </p>
            )}
          </div>
        ) : null}

        {module === "assets" ? (
          <section className="rounded-[28px] border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-5 shadow-[0_24px_80px_rgba(61,49,31,0.08)]">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Assets</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Register service files and uploads for the selected worship service.
              </p>
            </div>

            {selectedService ? (
              <>
                <form
                  className="space-y-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    const file = formData.get("file");
                    const type = formData.get("type") as AssetType;
                    const manualName = String(formData.get("fileName") ?? "");
                    const manualPath = String(formData.get("filePath") ?? "");

                    if (file instanceof File && file.size > 0) {
                      const uploadData = new FormData();
                      uploadData.append("file", file);
                      uploadData.append("type", type);
                      uploadAssetMutation.mutate({
                        serviceId: selectedService.id,
                        formData: uploadData,
                      });
                    } else {
                      uploadAssetMutation.mutate({
                        serviceId: selectedService.id,
                        jsonPayload: {
                          type,
                          fileName: manualName,
                          filePath: manualPath,
                        },
                      });
                    }

                    event.currentTarget.reset();
                  }}
                >
                  <select
                    name="type"
                    className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                    defaultValue={AssetType.OTHER}
                  >
                    {Object.values(AssetType).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    name="file"
                    type="file"
                    className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                  />
                  <input
                    name="fileName"
                    placeholder="Manual file name"
                    className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                  />
                  <input
                    name="filePath"
                    placeholder="Manual file path or URL"
                    className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={uploadAssetMutation.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-accent-hover)] disabled:opacity-60"
                  >
                    <Upload className="h-4 w-4" />
                    Save asset
                  </button>
                </form>

                <div className="mt-4 max-h-[220px] space-y-3 overflow-y-auto pr-1">
                  {selectedService.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{asset.fileName}</p>
                          <p className="text-sm text-[var(--color-text-secondary)]">{asset.type}</p>
                        </div>
                        <a
                          href={asset.filePath}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-[var(--color-brand-accent)]"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Select a service to manage assets.
              </p>
            )}
          </section>
        ) : null}

        {module === "automation" ? (
          <section className="rounded-[28px] border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-5 shadow-[0_24px_80px_rgba(61,49,31,0.08)]">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Automation</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Persist job history and generated outputs while keeping the workflow simple.
              </p>
            </div>

            {selectedService ? (
              <>
                <form
                  className="space-y-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    const jobType = formData.get("jobType") as JobType;
                    const rawInput = String(formData.get("inputJson") ?? "").trim();
                    let inputJson: unknown = {};

                    if (rawInput) {
                      try {
                        inputJson = JSON.parse(rawInput);
                      } catch {
                        setFeedback("Automation input JSON is invalid.");
                        return;
                      }
                    }

                    createJobMutation.mutate({
                      serviceId: selectedService.id,
                      payload: {
                        jobType,
                        inputJson,
                      },
                    });
                    event.currentTarget.reset();
                  }}
                >
                  <select
                    name="jobType"
                    className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                    defaultValue={JobType.FREESHOW_GENERATE}
                  >
                    {Object.values(JobType).filter((jobType) => jobType !== JobType.TRANSPOSE).map((jobType) => (
                      <option key={jobType} value={jobType}>
                        {jobType}
                      </option>
                    ))}
                  </select>
                  <textarea
                    name="inputJson"
                    rows={4}
                    placeholder='Optional JSON input, e.g. {"resolution":"1080p"}'
                    className="w-full rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={createJobMutation.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-accent-hover)] disabled:opacity-60"
                  >
                    <WandSparkles className="h-4 w-4" />
                    Queue job
                  </button>
                </form>

                <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {selectedService.jobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{job.jobType}</p>
                          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            {job.jobType === JobType.TRANSPOSE
                              ? "Secure lyrics extraction history."
                              : JOB_DESCRIPTIONS[job.jobType]}
                          </p>
                          {job.jobType === JobType.TRANSPOSE && getExtractorSummary(job.outputJson) ? (
                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                              {getExtractorSummary(job.outputJson)}
                            </p>
                          ) : null}
                        </div>
                        <span className="rounded-full border border-[var(--color-brand-border)] bg-white px-3 py-1 font-[var(--font-plex-mono)] text-xs uppercase tracking-[0.14em] text-[var(--color-brand-olive)]">
                          {job.status}
                        </span>
                      </div>
                      {job.outputs.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {job.outputs.map((output) => (
                            <a
                              key={output.id}
                              href={output.filePath}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-xl border border-[var(--color-brand-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-brand-accent)]"
                            >
                              {output.type} output
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Select a service to queue automation work.
              </p>
            )}
          </section>
        ) : null}
      </aside>
      </div>
    </div>
  );
}
