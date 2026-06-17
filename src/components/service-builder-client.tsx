"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CloudUpload,
  Copy,
  FileText,
  History,
  ListMusic,
  Loader2,
  Plus,
  RefreshCcw,
  Redo2,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  apiFetch,
  type CreateAutomationJobPayload,
  type CreateParticipantPayload,
  type CreateSongTagPresetPayload,
  type CreateServicePayload,
  type CreateServiceSongPayload,
  type CreateSongPayload,
  type LyricsExtractorEditableResponse,
  type ServiceRecord,
  type SongTagPresetRecord,
  type UpdateParticipantPayload,
  type UpdateServicePayload,
  type UpdateSongTagPresetPayload,
  type UpsertServiceDetailPayload,
  generateLyricsDocx,
  runAiLyricsExtractorRetry,
  runAiLyricsReformat,
  runPasteLyricsExtractor,
  runUploadLyricsExtractor,
  triggerBrowserDownload,
} from "@/lib/api-client";
import { BLOCK_LABELS, SONG_BLOCK_TYPES, STRICT_BLOCK_ORDER, getServiceBlockOrder } from "@/lib/service-display";
import {
  BlockType,
  JobStatus,
  JobType,
  ServiceStatus,
  ServiceStatusValues,
  ServiceVariant,
  ServiceVariantValues,
  SongRole,
} from "@/lib/service-constants";
import type { LyricsExtractorAiRetryDescriptor, LyricsExtractorSafeOutput } from "@/lib/extractor-types";
import PAPDesktopClient from "@/features/pap/components/pap-desktop-client";
import { PAPToastViewport, usePAPToasts } from "@/features/pap/components/pap-toasts";
import QRGeneratorTool from "@/components/qr-generator-tool";
import BackgroundGeneratorTool from "@/components/background-generator-tool";
import {
  analyzeServiceText,
  type AnalyzedServiceDetail,
  type AnalyzedServiceDraft,
  type AnalyzedServiceParticipant,
} from "@/lib/service-text-analysis";

const createServiceFormSchema = z.object({
  serviceDate: z.string().min(1, "Service date is required"),
  ministryName: z.string().min(1, "Ministry name is required"),
  theme: z.string().optional(),
  serviceVariant: z.enum(ServiceVariantValues),
});

const updateServiceFormSchema = z.object({
  serviceDate: z.string().min(1, "Service date is required"),
  ministryName: z.string().min(1, "Ministry name is required"),
  theme: z.string().optional(),
  status: z.enum(ServiceStatusValues),
});

type CreateServiceFormValues = z.infer<typeof createServiceFormSchema>;
type UpdateServiceFormValues = z.infer<typeof updateServiceFormSchema>;
type WorkspaceModule = "services" | "songs" | "assets" | "automation";
type SongWorkflowStep = "upload" | "extraction" | "format";
type ServiceWorkflowStep = "setup" | "flow" | "review";
export type MediaTool = "phone-transfer" | "qr-generator" | "background-generator";

const SERVICE_WORKFLOW_STEPS: Array<{ id: ServiceWorkflowStep; label: string; description: string }> = [
  { id: "setup", label: "Service Setup", description: "Edit service info and import production notes." },
  { id: "flow", label: "Flow Hub", description: "Assign people, songs, and details by block." },
  { id: "review", label: "Run of Service", description: "Scan the complete service in strict order." },
];

const MEDIA_TOOLS: Array<{ id: MediaTool; href: string; label: string; description: string }> = [
  {
    id: "phone-transfer",
    href: "/assets/phone-transfer",
    label: "Phone Transfer",
    description:
      "Send screenshots from a phone, retrieve them here in original quality, then download or manage only the ones you need.",
  },
  { id: "qr-generator", href: "/assets/qr-generator", label: "QR Generator", description: "Create a code for giving links, forms, or service resources." },
  {
    id: "background-generator",
    href: "/assets/background-generator",
    label: "Background Generator",
    description: "Generate projection-ready workspace image backgrounds with cost validation.",
  },
];

const MEDIA_TOOLS_HOME_COPY = {
  title: "Media Tools",
  description:
    "Prepare worship production media in one focused workspace. Move phone captures to the booth and generate QR codes for service resources.",
};

const DEFAULT_SONG_TAG_COLOR = "#CFE8F6";

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

type SerializeTaggedDraftOptions = {
  preserveWhitespace?: boolean;
};

function serializeTaggedDraft(sections: TaggedDraftSection[], options: SerializeTaggedDraftOptions = {}) {
  const preserveWhitespace = options.preserveWhitespace ?? false;
  const serializedSections = sections
    .map((section) => {
      const body = preserveWhitespace ? section.lines.join("\n") : section.lines.join("\n").trim();
      return section.tag ? [`[${section.tag}]`, body].filter(Boolean).join("\n") : body;
    })
    .filter((section) => section.trim().length > 0);

  if (!preserveWhitespace) {
    return serializedSections.join("\n\n").trim();
  }

  return serializedSections.reduce((draft, section) => {
    if (!draft) {
      return section;
    }

    return `${draft}${draft.endsWith("\n") ? "" : "\n"}${section}`;
  }, "").trimStart();
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
  BACKGROUND_IMAGE_GENERATE: "Generate a worship presentation image background.",
  BACKGROUND_VIDEO_GENERATE: "Generate a 15-second 480p worship background loop.",
};

const MODULE_CONTENT: Record<
  WorkspaceModule,
  { title: string; description: string }
> = {
  services: {
    title: "Service Flow Hub",
    description:
      "Build the run of service in the exact worship order, keep participants and songs attached to their proper blocks, and prepare production handoffs.",
  },
  songs: {
    title: "Worship Song Formatter",
    description:
      "Start from uploaded lyrics or pasted text, review extraction, then finish the document in the interactive editor.",
  },
  assets: {
    title: "Production Media Tools",
    description:
      "Attach and review service media, screenshots, PDFs, and supporting production documents.",
  },
  automation: {
    title: "Live Captions & Outputs",
    description:
      "Queue caption, translation, and export jobs while keeping generated outputs as service records.",
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
    typeof record.sectionCount === "number" ? ` - ${record.sectionCount} sections` : "";
  return `${record.extractedLineCount} extracted lines${sectionText}`;
}

function getExtractorParser(outputJson: unknown) {
  if (!outputJson || typeof outputJson !== "object") {
    return null;
  }

  const parser = (outputJson as Partial<LyricsExtractorSafeOutput>).parser;
  return parser ? parser.toUpperCase() : null;
}

function getExtractorSource(inputJson: unknown) {
  if (!inputJson || typeof inputJson !== "object") {
    return "Formatter";
  }

  const sourceMode = (inputJson as { sourceMode?: unknown }).sourceMode;
  return sourceMode === "paste" ? "Pasted lyrics" : sourceMode === "upload" ? "Uploaded file" : "Formatter";
}

function getExtractorSourceLabel(inputJson: unknown) {
  if (!inputJson || typeof inputJson !== "object") {
    return null;
  }

  const sourceLabel = (inputJson as { sourceLabel?: unknown }).sourceLabel;
  return typeof sourceLabel === "string" && sourceLabel.trim() ? sourceLabel.trim() : null;
}

function isUploadedExtractorJob(inputJson: unknown) {
  return Boolean(inputJson && typeof inputJson === "object" && (inputJson as { sourceMode?: unknown }).sourceMode === "upload");
}

function getFileNameWithoutExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "").trim();
}

function formatRecentConversionTime(value: string, now: number) {
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) {
    return "Recently";
  }

  const minutesAgo = Math.max(0, Math.floor((now - createdAt) / 60000));
  if (minutesAgo < 1) {
    return "Just now";
  }
  if (minutesAgo < 60) {
    return `${minutesAgo}m ago`;
  }

  return `${Math.floor(minutesAgo / 60)}h ago`;
}

function formatSavedStatus(savedAt: number | null, now: number) {
  if (!savedAt) {
    return "Not saved";
  }

  const minutesAgo = Math.max(0, Math.floor((now - savedAt) / 60000));
  if (minutesAgo < 1) {
    return "Saved just now";
  }
  if (minutesAgo === 1) {
    return "Saved 1m ago";
  }

  return `Saved ${minutesAgo}m ago`;
}

function replaceDraftParticipant(
  draft: AnalyzedServiceDraft,
  index: number,
  participant: AnalyzedServiceParticipant
) {
  return {
    ...draft,
    participants: draft.participants.map((item, itemIndex) => (itemIndex === index ? participant : item)),
  };
}

function replaceDraftDetail(draft: AnalyzedServiceDraft, index: number, detail: AnalyzedServiceDetail) {
  return {
    ...draft,
    details: draft.details.map((item, itemIndex) => (itemIndex === index ? detail : item)),
  };
}

function getSongWorkflowStep(pathname: string, fallback: SongWorkflowStep = "upload") {
  const segment = pathname.split("/").filter(Boolean).at(-1);
  if (segment === "upload" || segment === "extraction" || segment === "format") {
    return segment;
  }

  return fallback;
}

export default function ServiceBuilderClient({
  module,
  mediaTool,
  songStep,
}: {
  module: WorkspaceModule;
  mediaTool?: MediaTool;
  songStep?: SongWorkflowStep;
}) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const activeSongStep = songStep ?? getSongWorkflowStep(pathname);
  const { dismissToast, showToast, toasts } = usePAPToasts();
  const [activeServiceStep, setActiveServiceStep] = useState<ServiceWorkflowStep>("setup");
  const [activeServiceBlockType, setActiveServiceBlockType] = useState<BlockType>(STRICT_BLOCK_ORDER[0]);
  const [recentConversionNow] = useState(() => Date.now());
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [newServiceModalOpen, setNewServiceModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [serviceAnalysisText, setServiceAnalysisText] = useState("");
  const [serviceAnalysisDraft, setServiceAnalysisDraft] = useState<AnalyzedServiceDraft | null>(null);
  const [extractorSourceMode, setExtractorSourceMode] = useState<"upload" | "paste">("upload");
  const [extractorStatus, setExtractorStatus] = useState<string | null>(null);
  const [extractorSelectedFile, setExtractorSelectedFile] = useState<File | null>(null);
  const [extractorFileLabel, setExtractorFileLabel] = useState<string | null>(null);
  const [extractorSongTitle, setExtractorSongTitle] = useState("");
  const [extractorPastedText, setExtractorPastedText] = useState("");
  const [extractorAiRetry, setExtractorAiRetry] = useState<LyricsExtractorAiRetryDescriptor | null>(null);
  const [directAiReformatUsed, setDirectAiReformatUsed] = useState(false);
  const [extractorDraftText, setExtractorDraftText] = useState("");
  const [extractorUndoStack, setExtractorUndoStack] = useState<string[]>([]);
  const [extractorRedoStack, setExtractorRedoStack] = useState<string[]>([]);
  const [extractorLastSavedAt, setExtractorLastSavedAt] = useState<number | null>(null);
  const [editorClock, setEditorClock] = useState(() => Date.now());
  const [editorDraftSections, setEditorDraftSections] = useState<TaggedDraftSection[]>([]);
  const [draggedEditorSectionIndex, setDraggedEditorSectionIndex] = useState<number | null>(null);
  const [sectionFormatTag, setSectionFormatTag] = useState("Verse");
  const [sectionLineGroupSize, setSectionLineGroupSize] = useState<2 | 3>(2);
  const [editorControlsWidth, setEditorControlsWidth] = useState(360);
  const [tagSettingsOpen, setTagSettingsOpen] = useState(false);
  const [tagForm, setTagForm] = useState<CreateSongTagPresetPayload>({
    label: "",
    token: "",
    color: DEFAULT_SONG_TAG_COLOR,
    order: 10,
  });
  const extractorEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const extractorFileInputRef = useRef<HTMLInputElement | null>(null);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const editorDraftTextFromSectionsRef = useRef<string | null>(null);

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

  const createSongTagMutation = useMutation({
    mutationFn: (payload: CreateSongTagPresetPayload) =>
      apiFetch<SongTagPresetRecord>("/api/song-tags", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (tag) => {
      await queryClient.invalidateQueries({ queryKey: ["song-tags"] });
      setSectionFormatTag(tag.token);
      setTagForm({ label: "", token: "", color: DEFAULT_SONG_TAG_COLOR, order: tag.order + 1 });
      showToast(`${tag.label} tag added.`, "success");
    },
    onError: (error: Error) => {
      showToast(error.message);
    },
  });

  const updateSongTagMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSongTagPresetPayload }) =>
      apiFetch<SongTagPresetRecord>(`/api/song-tags/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (tag) => {
      await queryClient.invalidateQueries({ queryKey: ["song-tags"] });
      showToast(`${tag.label} tag updated.`, "success");
    },
    onError: (error: Error) => {
      showToast(error.message);
    },
  });

  const deleteSongTagMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/song-tags/${id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["song-tags"] });
      showToast("Tag deleted.");
    },
    onError: (error: Error) => {
      showToast(error.message);
    },
  });

  useEffect(() => {
    const interval = window.setInterval(() => setEditorClock(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (editorDraftTextFromSectionsRef.current === extractorDraftText) {
      return;
    }

    setEditorDraftSections(parseTaggedDraft(extractorDraftText));
  }, [extractorDraftText]);

  const commitExtractorDraftText = (nextText: string) => {
    setExtractorDraftText((currentText) => {
      if (currentText === nextText) {
        return currentText;
      }

      setExtractorUndoStack((currentStack) => [...currentStack.slice(-49), currentText]);
      setExtractorRedoStack([]);
      setExtractorLastSavedAt(Date.now());
      setEditorClock(Date.now());
      return nextText;
    });
  };

  const undoExtractorDraft = () => {
    setExtractorUndoStack((currentStack) => {
      const previousText = currentStack.at(-1);
      if (previousText === undefined) {
        return currentStack;
      }

      setExtractorRedoStack((currentRedoStack) => [...currentRedoStack, extractorDraftText]);
      setExtractorDraftText(previousText);
      setExtractorLastSavedAt(Date.now());
      setEditorClock(Date.now());
      return currentStack.slice(0, -1);
    });
  };

  const redoExtractorDraft = () => {
    setExtractorRedoStack((currentStack) => {
      const nextText = currentStack.at(-1);
      if (nextText === undefined) {
        return currentStack;
      }

      setExtractorUndoStack((currentUndoStack) => [...currentUndoStack, extractorDraftText]);
      setExtractorDraftText(nextText);
      setExtractorLastSavedAt(Date.now());
      setEditorClock(Date.now());
      return currentStack.slice(0, -1);
    });
  };

  const createServiceForm = useForm<CreateServiceFormValues>({
    resolver: zodResolver(createServiceFormSchema),
    defaultValues: {
      serviceDate: new Date().toISOString().slice(0, 10),
      ministryName: "",
      theme: "",
      serviceVariant: ServiceVariant.STANDARD,
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
        serviceVariant: ServiceVariant.STANDARD,
      });
      setFeedback("Service created.");
      setNewServiceModalOpen(false);
      showToast("Service created.", "success");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (serviceId: string) =>
      apiFetch(`/api/services/${serviceId}`, {
        method: "DELETE",
      }),
    onSuccess: async (_result, serviceId) => {
      await invalidateServices();
      setSelectedServiceId((currentServiceId) => (currentServiceId === serviceId ? null : currentServiceId));
      setFeedback("Service deleted.");
      showToast("Service deleted.", "success");
    },
    onError: (error: Error) => {
      setFeedback(error.message);
      showToast(error.message);
    },
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

  const quickAddServiceSongMutation = useMutation({
    mutationFn: async ({
      serviceId,
      blockId,
      payload,
      pageRef,
      order,
    }: {
      serviceId: string;
      blockId: string;
      payload: CreateSongPayload;
      pageRef?: string | null;
      order: number;
    }) => {
      const song = await apiFetch<{ id: string }>("/api/songs", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return apiFetch(`/api/services/${serviceId}/songs`, {
        method: "POST",
        body: JSON.stringify({
          songId: song.id,
          blockId,
          order,
          songRole: SongRole.CUSTOM,
          pageRef,
        } satisfies CreateServiceSongPayload),
      });
    },
    onSuccess: async () => {
      await invalidateServices();
      setFeedback("Song record added to the service block.");
      showToast("Song added for record keeping.", "success");
    },
    onError: (error: Error) => {
      setFeedback(error.message);
      showToast(error.message);
    },
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

  const applySongTagToDraft = (tag: SongTagPresetRecord) => {
    const editor = extractorEditorRef.current;
    const marker = `[${tag.token}]`;

    if (!editor) {
      commitExtractorDraftText(`${extractorDraftText}${extractorDraftText.endsWith("\n") || !extractorDraftText ? "" : "\n"}${marker}\n`);
      showToast(`${tag.label} tag inserted.`, "success");
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

    commitExtractorDraftText(nextText);
    showToast(`${tag.label} tag applied.`, "success");
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const applyExtractorResult = (result: LyricsExtractorEditableResponse) => {
    setExtractorDraftText(result.text);
    setExtractorUndoStack([]);
    setExtractorRedoStack([]);
    setExtractorLastSavedAt(Date.now());
    setEditorClock(Date.now());
    setDirectAiReformatUsed(false);
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
    mutationFn: async ({
      serviceId,
      file,
      songTitle,
    }: {
      serviceId?: string;
      file: File;
      songTitle?: string;
      useAi?: boolean;
    }) => {
      const extractingTimer = window.setTimeout(() => {
        setExtractorStatus("Extracting...");
      }, 500);

      try {
        return applyExtractorResult(await runUploadLyricsExtractor({ serviceId, file, songTitle }));
      } finally {
        window.clearTimeout(extractingTimer);
      }
    },
    onSuccess: async (result, variables) => {
      if (variables.serviceId) {
        await invalidateServices();
      }
      setFeedback(
        result.retry
          ? "Lyrics extracted with warnings. Review the draft or use AI cleanup before generating DOCX."
          : "Lyrics extracted into the editor. Review your draft before generating DOCX."
      );
      showToast(result.retry ? "Lyrics extracted with warnings." : "Lyrics extracted into the editor.", result.retry ? "info" : "success");
      setExtractorSelectedFile(null);
      setExtractorFileLabel(null);
      if (variables.useAi && result.retry) {
        setExtractorStatus("Running AI cleanup...");
        aiExtractorRetryMutation.mutate({
          serviceId: variables.serviceId,
          retryToken: result.retry.retryToken,
        });
        return;
      }
      router.push("/songs/format");
    },
    onError: (error: Error) => {
      setExtractorStatus("Extraction failed.");
      setFeedback(error.message);
      showToast(error.message);
    },
  });

  const pasteExtractorMutation = useMutation({
    mutationFn: async ({
      serviceId,
      pastedText,
      songTitle,
    }: {
      serviceId?: string;
      pastedText: string;
      songTitle?: string;
      useAi?: boolean;
    }) => {
      return applyExtractorResult(await runPasteLyricsExtractor({ serviceId, pastedText, songTitle }));
    },
    onSuccess: async (result, variables) => {
      if (variables.serviceId) {
        await invalidateServices();
      }
      setFeedback(
        result.retry
          ? "Pasted lyrics were normalized with warnings. Review the draft before generating DOCX."
          : "Pasted lyrics were normalized into the editor."
      );
      showToast(result.retry ? "Pasted lyrics normalized with warnings." : "Pasted lyrics normalized.", result.retry ? "info" : "success");
      if (variables.useAi && result.retry) {
        setExtractorStatus("Running AI cleanup...");
        aiExtractorRetryMutation.mutate({
          serviceId: variables.serviceId,
          retryToken: result.retry.retryToken,
        });
        return;
      }
      router.push("/songs/format");
    },
    onError: (error: Error) => {
      setExtractorStatus("Extraction failed.");
      setFeedback(error.message);
      showToast(error.message);
    },
  });

  const aiExtractorRetryMutation = useMutation({
    mutationFn: async ({ serviceId, retryToken }: { serviceId?: string; retryToken: string }) => {
      return applyExtractorResult(await runAiLyricsExtractorRetry({ serviceId, retryToken }));
    },
    onSuccess: async (_result, variables) => {
      setExtractorAiRetry(null);
      setExtractorStatus("AI-cleaned lyrics are ready for review.");
      if (variables.serviceId) {
        await invalidateServices();
      }
      setFeedback("AI cleanup completed for this one-time extraction. Review before generating DOCX.");
      showToast("AI cleanup completed.", "success");
      router.push("/songs/format");
    },
    onError: (error: Error) => {
      setExtractorStatus(error.message);
      setFeedback(error.message);
      showToast(error.message);
    },
  });

  const aiLyricsReformatMutation = useMutation({
    mutationFn: async ({ serviceId, text, songTitle }: { serviceId?: string; text: string; songTitle?: string }) => {
      return applyExtractorResult(await runAiLyricsReformat({ serviceId, text, songTitle }));
    },
    onSuccess: async (_result, variables) => {
      setDirectAiReformatUsed(true);
      setExtractorAiRetry(null);
      setExtractorStatus("AI reformat applied.");
      if (variables.serviceId) {
        await invalidateServices();
      }
      setFeedback("AI reformat completed for this draft.");
      showToast("AI reformat completed.", "success");
      router.push("/songs/format");
    },
    onError: (error: Error) => {
      setExtractorStatus(error.message);
      setFeedback(error.message);
      showToast(error.message);
    },
  });

  const generateLyricsDocxMutation = useMutation({
    mutationFn: async ({ serviceId, text, songTitle }: { serviceId?: string; text: string; songTitle?: string }) => {
      const result = await generateLyricsDocx({ serviceId, text, songTitle });
      triggerBrowserDownload(result.blob, result.fileName);
      return result.fileName;
    },
    onSuccess: (fileName) => {
      setExtractorStatus(`DOCX generated: ${fileName}`);
      setFeedback("Reviewed lyrics downloaded as DOCX. Edited lyrics were not stored.");
      showToast(`${fileName} downloaded.`, "success");
    },
    onError: (error: Error) => {
      setExtractorStatus("DOCX generation failed.");
      setFeedback(error.message);
      showToast(error.message);
    },
  });

  const resolvedSelectedServiceId =
    selectedServiceId && services.some((service) => service.id === selectedServiceId)
      ? selectedServiceId
      : (services.find((service) => service.ministryName === "Ladies Ministry") ?? services[0])?.id ?? null;

  const selectedService =
    services.find((service) => service.id === resolvedSelectedServiceId) ?? null;
  const selectedServiceBlockOrder = selectedService ? getServiceBlockOrder(selectedService.serviceVariant) : STRICT_BLOCK_ORDER;
  const effectiveActiveServiceBlockType = selectedServiceBlockOrder.includes(activeServiceBlockType)
    ? activeServiceBlockType
    : selectedServiceBlockOrder[0];
  const activeServiceBlock = selectedService ? getBlockByType(selectedService, effectiveActiveServiceBlockType) : null;
  const recentSongConversions = selectedService
    ? selectedService.jobs
        .filter((job) => job.jobType === JobType.TRANSPOSE && isUploadedExtractorJob(job.inputJson))
        .slice(0, 5)
    : [];
  const isFormatterProcessing =
    uploadExtractorMutation.isPending || pasteExtractorMutation.isPending || aiExtractorRetryMutation.isPending;
  const editorSections = editorDraftSections;

  const commitEditorSections = (nextSections: TaggedDraftSection[], options: SerializeTaggedDraftOptions = {}) => {
    const nextText = serializeTaggedDraft(nextSections, options);
    setEditorDraftSections(nextSections);
    editorDraftTextFromSectionsRef.current = nextText;
    commitExtractorDraftText(nextText);
  };

  const updateEditorSection = (sectionIndex: number, section: TaggedDraftSection) => {
    const nextSections = editorSections.map((item, index) => (index === sectionIndex ? section : item));
    commitEditorSections(nextSections, { preserveWhitespace: true });
  };

  const reorderEditorSection = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return;
    }

    const nextSections = [...editorSections];
    const [movedSection] = nextSections.splice(fromIndex, 1);
    if (!movedSection) {
      return;
    }

    nextSections.splice(toIndex, 0, movedSection);
    commitEditorSections(nextSections);
    setDraggedEditorSectionIndex(null);
    showToast("Section reordered.", "success");
  };

  const autoScrollEditorDuringDrag = (clientY: number) => {
    const container = editorScrollRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const edgeSize = 96;
    const maxStep = 22;

    if (clientY < rect.top + edgeSize) {
      const intensity = (rect.top + edgeSize - clientY) / edgeSize;
      container.scrollTop -= Math.ceil(maxStep * intensity);
      return;
    }

    if (clientY > rect.bottom - edgeSize) {
      const intensity = (clientY - (rect.bottom - edgeSize)) / edgeSize;
      container.scrollTop += Math.ceil(maxStep * intensity);
    }
  };

  const startEditorControlsResize = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = editorControlsWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(520, Math.max(320, startWidth + moveEvent.clientX - startX));
      setEditorControlsWidth(nextWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const processFormatterSource = (useAi: boolean) => {
    if (isFormatterProcessing) {
      return;
    }

    setFeedback(null);
    setExtractorAiRetry(null);

    if (extractorSourceMode === "paste") {
      const pastedText = extractorPastedText.trim();
      if (!pastedText) {
        setFeedback("Paste lyrics before processing.");
        showToast("Paste lyrics before processing.");
        return;
      }

      setExtractorDraftText("");
      setExtractorStatus(useAi ? "Preparing AI-assisted processing..." : "Processing locally...");
      showToast(useAi ? "Processing pasted lyrics with AI assist." : "Processing pasted lyrics locally.");
      pasteExtractorMutation.mutate({
        serviceId: selectedService?.id,
        pastedText,
        songTitle: extractorSongTitle || undefined,
        useAi,
      });
      return;
    }

    if (!extractorSelectedFile) {
      setFeedback("Select a song file before processing.");
      showToast("Select a song file before processing.");
      return;
    }

    setExtractorDraftText("");
    setExtractorStatus(useAi ? "Preparing AI-assisted processing..." : "Processing locally...");
    showToast(useAi ? "Processing selected file with AI assist." : "Processing selected file locally.");
    uploadExtractorMutation.mutate({
      serviceId: selectedService?.id,
      file: extractorSelectedFile,
      songTitle: extractorSongTitle || undefined,
      useAi,
    });
  };

  const applyServiceAnalysisDraft = async () => {
    if (!selectedService || !serviceAnalysisDraft) {
      showToast("Analyze text and select a service first.");
      return;
    }

    setFeedback(null);

    try {
      await apiFetch<ServiceRecord>(`/api/services/${selectedService.id}`, {
        method: "PUT",
        body: JSON.stringify({
          serviceDate: serviceAnalysisDraft.serviceDate
            ? new Date(serviceAnalysisDraft.serviceDate).toISOString()
            : selectedService.serviceDate,
          ministryName: serviceAnalysisDraft.ministryName || selectedService.ministryName,
          theme: serviceAnalysisDraft.theme ?? selectedService.theme,
          status: serviceAnalysisDraft.status,
        } satisfies UpdateServicePayload),
      });

      for (const participant of serviceAnalysisDraft.participants) {
        const block = getBlockByType(selectedService, participant.blockType);
        if (!block) continue;

        await apiFetch(`/api/services/${selectedService.id}/blocks/${block.id}/people`, {
          method: "POST",
          body: JSON.stringify({
            personName: participant.personName,
            personTitle: participant.personTitle || null,
            order: participant.order,
          } satisfies CreateParticipantPayload),
        });
      }

      for (const detail of serviceAnalysisDraft.details) {
        const block = getBlockByType(selectedService, detail.blockType);
        if (!block) continue;

        await apiFetch(`/api/services/${selectedService.id}/details`, {
          method: "POST",
          body: JSON.stringify({
            key: detail.key,
            value: detail.value,
            blockId: block.id,
          } satisfies UpsertServiceDetailPayload),
        });
      }

      await invalidateServices();
      setFeedback("Analysis applied to the selected service.");
      showToast("Analysis applied to service.", "success");
      setActiveServiceStep("review");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to apply analysis.";
      setFeedback(message);
      showToast(message);
    }
  };

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
  const activeMediaToolCopy = mediaTool ? MEDIA_TOOLS.find((tool) => tool.id === mediaTool) : null;
  const mediaHeaderCopy = activeMediaToolCopy
    ? { title: activeMediaToolCopy.label, description: activeMediaToolCopy.description }
    : MEDIA_TOOLS_HOME_COPY;

  return (
    <div className="min-h-full space-y-5">
      {module === "songs" || module === "assets" ? null : module === "services" ? (
        <section className="production-panel-strong px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="technical-label">SERVICE FLOW HUB</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-[var(--color-brand-ink)]">
                Service Flow Hub
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Prepare the worship run, keep blocks in the approved order, and attach participants, songs, and details where they belong.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNewServiceModalOpen(true)}
              className="pressable inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-ink)]"
            >
              <Plus className="h-4 w-4" />
              New service
            </button>
          </div>
        </section>
      ) : (
        <section className="production-panel-strong px-4 py-4">
          <div>
            <p className="technical-label">LIVE CAPTIONS & OUTPUTS</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-[var(--color-brand-ink)]">
              {moduleCopy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              {moduleCopy.description}
            </p>
          </div>
        </section>
      )}

      <div className={showServiceSidebar ? "flex min-h-full flex-col items-stretch gap-5 lg:flex-row lg:items-start" : "block"}>
        {showServiceSidebar ? (
          <aside className="production-panel flex w-full flex-col overflow-hidden lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-[320px]">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-brand-border)] px-4 py-3">
              <div>
                <p className="technical-label">SERVICE INDEX</p>
                <h2 className="mt-1 text-sm font-semibold text-[var(--color-brand-ink)]">Worship services</h2>
              </div>
              <button
                type="button"
                onClick={() => void invalidateServices()}
                className="rounded-md border border-[var(--color-brand-border)] p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-panel-alt)] hover:text-[var(--color-brand-ink)]"
                aria-label="Refresh services"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 divide-y divide-[var(--color-brand-border)] overflow-y-auto">
            {services.map((service) => (
              <div
                key={service.id}
                className={`w-full px-4 py-3 text-left transition ${
                  selectedService?.id === service.id
                    ? "production-stripe bg-[var(--color-brand-panel-strong)] pl-5"
                    : "bg-[var(--color-brand-panel)] hover:bg-[var(--color-brand-panel-alt)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    setExtractorStatus(null);
                    setExtractorFileLabel(null);
                    setExtractorAiRetry(null);
                  }}
                  className="block w-full text-left"
                >
                  <p className="technical-label">
                    {formatServiceDate(service.serviceDate)}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                    <span className="status-pip status-pip-ready" />
                    {service.ministryName}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {service.theme || "No theme yet"}
                  </p>
                </button>
                <button
                  type="button"
                  disabled={deleteServiceMutation.isPending}
                  onClick={() => {
                    const confirmed = window.confirm(`Delete ${service.ministryName} on ${formatServiceDate(service.serviceDate)}?`);
                    if (!confirmed) return;
                    showToast("Deleting service.");
                    deleteServiceMutation.mutate(service.id);
                  }}
                  className="pressable mt-3 inline-flex items-center gap-2 rounded-md border border-[var(--color-danger)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-danger)] disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="shrink-0 border-t border-[var(--color-brand-border)] p-4">
          <button
            type="button"
            onClick={() => setNewServiceModalOpen(true)}
            className="pressable flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-ink)]"
          >
            <Plus className="h-4 w-4" />
            New Service
          </button>
        </div>
      </aside>
        ) : null}

      {newServiceModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-brand-ink)]/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Create worship service</h2>
              </div>
              <button
                type="button"
                onClick={() => setNewServiceModalOpen(false)}
                className="pressable rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-2 text-[var(--color-text-secondary)]"
                aria-label="Close new service modal"
              >
                <X className="h-4 w-4" />
              </button>
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
                serviceVariant: values.serviceVariant,
              });
            })}
          >
            <label className="block text-sm text-[var(--color-text-secondary)]">
              Service date
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2"
                {...createServiceForm.register("serviceDate")}
              />
            </label>
            <label className="block text-sm text-[var(--color-text-secondary)]">
              Ministry
              <input
                type="text"
                placeholder="Ladies Ministry"
                className="mt-1 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2"
                {...createServiceForm.register("ministryName")}
              />
            </label>
            <label className="block text-sm text-[var(--color-text-secondary)]">
              Theme
              <input
                type="text"
                placeholder="Optional theme"
                className="mt-1 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2"
                {...createServiceForm.register("theme")}
              />
            </label>
            <label className="block text-sm text-[var(--color-text-secondary)]">
              Template
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2"
                {...createServiceForm.register("serviceVariant")}
              >
                <option value={ServiceVariant.STANDARD}>Standard Worship Service</option>
                <option value={ServiceVariant.EXTENDED}>Extended Worship Service</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={createServiceMutation.isPending}
              className="pressable flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {createServiceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create service
            </button>
          </form>
          </div>
        </div>
      ) : null}

      {module === "services" ? (
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <section className="production-panel overflow-hidden">
            {feedback ? (
              <div className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                {feedback}
              </div>
            ) : null}

            {pageBusy ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-accent)]" />
              </div>
            ) : selectedService ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-brand-border)] px-5 py-4">
                  <div>
                    <p className="technical-label">SELECTED SERVICE</p>
                    <h2 className="mt-2 text-xl font-semibold">
                      {formatServiceDate(selectedService.serviceDate)} - {selectedService.ministryName}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                      {selectedService.theme || "No theme yet"}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-strong)] px-3 py-2 font-[var(--font-plex-mono)] text-xs text-[var(--color-text-secondary)]">
                    <span className="status-pip status-pip-ready" />
                    {selectedService.status} / {selectedService.serviceVariant === ServiceVariant.EXTENDED ? "EXTENDED" : "STANDARD"}
                  </div>
                </div>

                <div className="grid border-b border-[var(--color-brand-border)] md:grid-cols-3">
                  {SERVICE_WORKFLOW_STEPS.map((step) => {
                    const active = activeServiceStep === step.id;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => {
                          setActiveServiceStep(step.id);
                          showToast(`${step.label} step opened.`);
                        }}
                        className={`pressable border-b-2 border-r border-[var(--color-brand-border)] p-4 text-left last:border-r-0 ${
                          active
                            ? "border-b-[var(--color-brand-accent)] bg-[var(--color-brand-panel-strong)] text-[var(--color-brand-ink)]"
                            : "bg-[var(--color-brand-panel)] text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-panel-alt)]"
                        }`}
                      >
                        <p className="text-sm font-semibold">{step.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                          {step.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {activeServiceStep === "setup" ? (
                  <section className="space-y-5 p-5">
                    <form
                      className="grid gap-4 border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4 md:grid-cols-2"
                      onSubmit={serviceHeaderForm.handleSubmit((values) => {
                        setFeedback(null);
                        showToast("Saving service info.");
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
                      <div className="md:col-span-2">
                        <h3 className="text-base font-semibold">Header and status</h3>
                      </div>
                      <label className="text-sm text-[var(--color-text-secondary)]">
                        Date
                        <input
                          type="date"
                          className="mt-1 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2"
                          {...serviceHeaderForm.register("serviceDate")}
                        />
                      </label>
                      <label className="text-sm text-[var(--color-text-secondary)]">
                        Ministry
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2"
                          {...serviceHeaderForm.register("ministryName")}
                        />
                      </label>
                      <label className="text-sm text-[var(--color-text-secondary)]">
                        Theme
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2"
                          {...serviceHeaderForm.register("theme")}
                        />
                      </label>
                      <label className="text-sm text-[var(--color-text-secondary)]">
                        Status
                        <select
                          className="mt-1 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2"
                          {...serviceHeaderForm.register("status")}
                        >
                          {Object.values(ServiceStatus).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="md:col-span-2">
                        <button
                          type="submit"
                          disabled={updateServiceMutation.isPending}
                          className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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

                    <div className="border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold">Import WS participants and details</h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                        Paste the service prep text. The analyzer creates a review draft and does not save until you apply it.
                      </p>
                    </div>
                    <textarea
                      value={serviceAnalysisText}
                      onChange={(event) => setServiceAnalysisText(event.target.value)}
                      rows={12}
                      placeholder="Paste WS PARTICIPANTS text here..."
                      className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-[var(--color-brand-accent)]"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const draft = analyzeServiceText(serviceAnalysisText);
                          setServiceAnalysisDraft(draft);
                          if (draft.serviceDate || draft.ministryName) {
                            serviceHeaderForm.reset({
                              serviceDate: draft.serviceDate ?? toDateInputValue(selectedService.serviceDate),
                              ministryName: draft.ministryName ?? selectedService.ministryName,
                              theme: draft.theme ?? selectedService.theme ?? "",
                              status: draft.status,
                            });
                          }
                          showToast("Text analyzed. Review before applying.", "success");
                        }}
                        className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-ink)] px-4 py-2.5 text-sm font-semibold text-white"
                      >
                        <WandSparkles className="h-4 w-4" />
                        Analyze text
                      </button>
                      <button
                        type="button"
                        onClick={() => void applyServiceAnalysisDraft()}
                        disabled={!serviceAnalysisDraft}
                        className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        Apply analysis
                      </button>
                    </div>

                    {serviceAnalysisDraft ? (
                      <div className="mt-5 grid gap-4 xl:grid-cols-3">
                        <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
                          <h4 className="text-sm font-semibold text-[var(--color-brand-ink)]">
                            Service info
                          </h4>
                          <input
                            type="date"
                            value={serviceAnalysisDraft.serviceDate ?? ""}
                            onChange={(event) =>
                              setServiceAnalysisDraft({ ...serviceAnalysisDraft, serviceDate: event.target.value })
                            }
                            className="mt-3 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                          />
                          <input
                            value={serviceAnalysisDraft.ministryName ?? ""}
                            onChange={(event) =>
                              setServiceAnalysisDraft({ ...serviceAnalysisDraft, ministryName: event.target.value })
                            }
                            className="mt-3 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
                          <h4 className="text-sm font-semibold text-[var(--color-brand-ink)]">
                            Participants
                          </h4>
                          <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto">
                            {serviceAnalysisDraft.participants.map((participant, index) => (
                              <div key={`${participant.blockType}-${index}`} className="rounded-md bg-[var(--color-brand-panel-alt)] p-3">
                                <p className="text-xs font-semibold text-[var(--color-brand-olive)]">{BLOCK_LABELS[participant.blockType]}</p>
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  <input
                                    value={participant.personTitle ?? ""}
                                    onChange={(event) =>
                                      setServiceAnalysisDraft(
                                        replaceDraftParticipant(serviceAnalysisDraft, index, {
                                          ...participant,
                                          personTitle: event.target.value || null,
                                        })
                                      )
                                    }
                                    className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={participant.personName}
                                    onChange={(event) =>
                                      setServiceAnalysisDraft(
                                        replaceDraftParticipant(serviceAnalysisDraft, index, {
                                          ...participant,
                                          personName: event.target.value,
                                        })
                                      )
                                    }
                                    className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
                          <h4 className="text-sm font-semibold text-[var(--color-brand-ink)]">
                            Details and warnings
                          </h4>
                          <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto">
                            {serviceAnalysisDraft.details.map((detail, index) => (
                              <div key={`${detail.blockType}-${index}`} className="rounded-md bg-[var(--color-brand-panel-alt)] p-3">
                                <p className="text-xs font-semibold text-[var(--color-brand-olive)]">{BLOCK_LABELS[detail.blockType]}</p>
                                <input
                                  value={detail.key}
                                  onChange={(event) =>
                                    setServiceAnalysisDraft(
                                      replaceDraftDetail(serviceAnalysisDraft, index, {
                                        ...detail,
                                        key: event.target.value,
                                      })
                                    )
                                  }
                                  className="mt-2 w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                />
                                <textarea
                                  value={detail.value}
                                  onChange={(event) =>
                                    setServiceAnalysisDraft(
                                      replaceDraftDetail(serviceAnalysisDraft, index, {
                                        ...detail,
                                        value: event.target.value,
                                      })
                                    )
                                  }
                                  rows={2}
                                  className="mt-2 w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                />
                              </div>
                            ))}
                            {serviceAnalysisDraft.warnings.map((warning) => (
                              <p key={warning} className="rounded-lg bg-[var(--color-card-yellow)] p-3 text-xs text-[var(--color-text-secondary)]">
                                {warning}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    </div>
                  </section>
                ) : null}

                {activeServiceStep === "flow" || activeServiceStep === "review" ? (
                <div className="space-y-4">
                  {activeServiceStep === "flow" ? (
                    <div className="animate-fade-in border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                        <div>
                          <h3 className="text-lg font-semibold">Choose a Service Block</h3>
                        </div>
                        <span className="rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 font-[var(--font-plex-mono)] text-xs text-[var(--color-text-secondary)]">
                          {activeServiceBlock ? `Block ${activeServiceBlock.order + 1}` : "Select block"}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {selectedServiceBlockOrder.map((blockType) => {
                          const block = getBlockByType(selectedService, blockType);
                          const active = effectiveActiveServiceBlockType === blockType;
                          return (
                            <button
                              key={blockType}
                              type="button"
                              onClick={() => {
                                setActiveServiceBlockType(blockType);
                                showToast(`${BLOCK_LABELS[blockType]} opened.`);
                              }}
                              className={`pressable rounded-lg border px-3 py-3 text-left transition ${
                                active
                                  ? "border-[var(--color-brand-ink)] bg-[var(--color-brand-ink)] text-white"
                                  : "border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] hover:border-[var(--color-brand-accent)]"
                              }`}
                            >
                              <span className="block font-[var(--font-plex-mono)] text-[11px] opacity-75">
                                Block {(block?.order ?? selectedServiceBlockOrder.indexOf(blockType)) + 1}
                              </span>
                              <span className="mt-1 block text-sm font-semibold">{BLOCK_LABELS[blockType]}</span>
                              <span className="mt-2 block text-xs opacity-75">
                                {block ? `${block.people.length} people / ${block.songs.length} songs / ${block.details.length} details` : "No data yet"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {(activeServiceStep === "flow" ? [effectiveActiveServiceBlockType] : selectedServiceBlockOrder).map((blockType) => {
                    const block = getBlockByType(selectedService, blockType);
                    if (!block) {
                      return null;
                    }

                    return (
                      <section
                        key={block.id}
                        className="animate-fade-in border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-5"
                      >
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-[var(--font-plex-mono)] text-xs text-[var(--color-text-muted)]">
                              Block {block.order + 1}
                            </p>
                            <h3 className="mt-1 text-xl font-semibold">
                              {BLOCK_LABELS[block.blockType]}
                            </h3>
                          </div>
                          <div className="rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 font-[var(--font-plex-mono)] text-xs text-[var(--color-text-secondary)]">
                            {block.people.length} people - {block.songs.length} songs - {block.details.length} details
                          </div>
                        </div>

                        <div className={`grid gap-4 ${activeServiceStep === "review" ? "xl:grid-cols-1" : "xl:grid-cols-3"}`}>
                          {activeServiceStep === "flow" ? (
                          <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
                            <h4 className="mb-3 text-sm font-semibold text-[var(--color-brand-ink)]">
                              Participants
                            </h4>
                            <div className="space-y-3">
                              {block.people.map((person) => (
                                <form
                                  key={person.id}
                                  className="space-y-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-3"
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
                                    className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                  />
                                  <input type="hidden" name="order" value={person.order} />
                                  <input
                                    name="personTitle"
                                    defaultValue={person.personTitle ?? ""}
                                    placeholder="Role or title"
                                    className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <button type="submit" className="rounded-md bg-[var(--color-brand-ink)] px-3 py-2 text-sm font-semibold text-white">
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
                                      className="rounded-md border border-[var(--color-brand-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </form>
                              ))}

                              <form
                                className="space-y-2 rounded-lg border border-dashed border-[var(--color-brand-border)] p-3"
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
                                  className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                />
                                <input type="hidden" name="order" value={block.people.length} />
                                <input
                                  name="personTitle"
                                  placeholder="Role or title"
                                  className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                />
                                <button type="submit" className="rounded-md border border-[var(--color-brand-border)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-ink)]">
                                  Add participant
                                </button>
                              </form>
                            </div>
                          </div>
                          ) : null}

                          {activeServiceStep === "flow" ? (
                          <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
                            <h4 className="mb-3 text-sm font-semibold text-[var(--color-brand-ink)]">
                              Songs
                            </h4>
                            {block.songs.length === 0 ? (
                              <p className="text-sm text-[var(--color-text-secondary)]">No songs attached to this block yet.</p>
                            ) : (
                              <div className="space-y-3">
                                {block.songs.map((serviceSong) => (
                                  <div
                                    key={serviceSong.id}
                                    className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-3"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-semibold">{serviceSong.song.title}</p>
                                        <p className="text-sm text-[var(--color-text-secondary)]">
                                          {serviceSong.song.author || "Unknown author"} - {serviceSong.songRole}
                                          {serviceSong.pageRef ? ` - ${serviceSong.pageRef}` : ""}
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
                                        className="rounded-md border border-[var(--color-brand-border)] p-2 text-[var(--color-text-secondary)]"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {SONG_BLOCK_TYPES.has(block.blockType) ? (
                              <form
                                className="mt-4 space-y-2 rounded-lg border border-dashed border-[var(--color-brand-border)] p-3"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const form = event.currentTarget;
                                  const formData = new FormData(form);
                                  const title = String(formData.get("title") ?? "").trim();
                                  if (!title) {
                                    showToast("Song title is required.");
                                    return;
                                  }

                                  showToast("Adding song record.");
                                  quickAddServiceSongMutation.mutate({
                                    serviceId: selectedService.id,
                                    blockId: block.id,
                                    order: block.songs.length,
                                    pageRef: null,
                                    payload: {
                                      title,
                                      author: null,
                                      defaultKey: null,
                                      bpm: null,
                                      language: String(formData.get("language") ?? "").trim() || null,
                                      isOriginal: false,
                                    },
                                  });
                                  form.reset();
                                }}
                              >
                                <p className="text-sm font-semibold text-[var(--color-brand-ink)]">
                                  Add song record
                                </p>
                                <div className="grid gap-2 md:grid-cols-2">
                                  <input
                                    name="title"
                                    placeholder="Song title"
                                    className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                  />
                                  <input
                                    name="language"
                                    placeholder="Language"
                                    className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                  />
                                </div>
                                <button
                                  type="submit"
                                  disabled={quickAddServiceSongMutation.isPending}
                                  className="pressable inline-flex items-center gap-2 rounded-md border border-[var(--color-brand-border)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-ink)] disabled:opacity-60"
                                >
                                  {quickAddServiceSongMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                  Add song
                                </button>
                              </form>
                            ) : (
                              <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                                Song records are only added in Praise and Worship, Awit ng Pakikinig, and Awit ng Pagtugon.
                              </p>
                            )}
                          </div>
                          ) : null}

                          {activeServiceStep === "flow" ? (
                          <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
                            <h4 className="mb-3 text-sm font-semibold text-[var(--color-brand-ink)]">
                              Details
                            </h4>
                            <div className="space-y-3">
                              {block.details.map((detail) => (
                                <form
                                  key={detail.id}
                                  className="space-y-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-3"
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
                                    className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                  />
                                  <textarea
                                    name="value"
                                    defaultValue={detail.value}
                                    rows={2}
                                    className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                  />
                                  <button type="submit" className="rounded-md bg-[var(--color-brand-ink)] px-3 py-2 text-sm font-semibold text-white">
                                    Save detail
                                  </button>
                                </form>
                              ))}

                              <form
                                className="space-y-2 rounded-lg border border-dashed border-[var(--color-brand-border)] p-3"
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
                                  className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                />
                                <textarea
                                  name="value"
                                  rows={2}
                                  placeholder="Detail value"
                                  className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                                />
                                <button type="submit" className="rounded-md border border-[var(--color-brand-border)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-ink)]">
                                  Add detail
                                </button>
                              </form>
                            </div>
                          </div>
                          ) : null}

                          {activeServiceStep === "review" ? (
                            <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
                              <div className="grid gap-3 md:grid-cols-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-[var(--color-brand-ink)]">
                                    Participants
                                  </h4>
                                  <div className="mt-3 space-y-2">
                                    {block.people.length > 0 ? block.people.map((person) => (
                                      <p key={person.id} className="rounded-md bg-[var(--color-brand-panel-alt)] px-3 py-2 text-sm">
                                        {person.personTitle ? `${person.personTitle} ` : ""}{person.personName}
                                      </p>
                                    )) : <p className="text-sm text-[var(--color-text-secondary)]">None yet.</p>}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-sm font-semibold text-[var(--color-brand-ink)]">
                                    Songs
                                  </h4>
                                  <div className="mt-3 space-y-2">
                                    {block.songs.length > 0 ? block.songs.map((serviceSong) => (
                                      <p key={serviceSong.id} className="rounded-md bg-[var(--color-brand-panel-alt)] px-3 py-2 text-sm">
                                        {serviceSong.song.title}
                                      </p>
                                    )) : <p className="text-sm text-[var(--color-text-secondary)]">None yet.</p>}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-sm font-semibold text-[var(--color-brand-ink)]">
                                    Details
                                  </h4>
                                  <div className="mt-3 space-y-2">
                                    {block.details.length > 0 ? block.details.map((detail) => (
                                      <p key={detail.id} className="rounded-md bg-[var(--color-brand-panel-alt)] px-3 py-2 text-sm">
                                        <span className="font-semibold">{detail.key}:</span> {detail.value}
                                      </p>
                                    )) : <p className="text-sm text-[var(--color-text-secondary)]">None yet.</p>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </section>
                    );
                  })}
                </div>
                ) : null}
              </>
            ) : (
              <div className="border border-dashed border-[var(--color-brand-border)] p-10 text-center">
                <h2 className="text-xl font-semibold">No worship service selected</h2>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Create a service from the service index or seed the database, then start building the worship flow.
                </p>
              </div>
            )}
          </section>
        </main>
      ) : null}

      <aside className={`${module === "services" ? "hidden" : "flex"} w-full flex-1 flex-col gap-4`}>
        {module === "songs" ? (
          <div className="space-y-5">
            <>
                {activeSongStep === "upload" ? (
                  <section className="space-y-10 py-3 lg:px-2">
                    <div className="mx-auto max-w-3xl text-center">
                      <h2 className="text-5xl font-bold leading-tight text-[var(--color-brand-ink)]">
                        Song Formatter
                      </h2>
                      <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--color-brand-ink)]">
                        Instant church-ready formatting for any song file. Upload your chord sheets or lyrics and let our AI engine structure them for ProPresenter, Planning Center, or PDF lead sheets.
                      </p>
                    </div>

                    <div className="mx-auto max-w-6xl">
                      <div className="group flex min-h-[300px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-[var(--color-focus)] hover:bg-[var(--color-brand-panel-strong)]">
                        {extractorSourceMode === "paste" ? (
                          <div className="w-full max-w-5xl text-left">
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xl font-bold text-[var(--color-brand-ink)]">Paste lyrics</p>
                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                  Paste a chord sheet or lyric text. It is processed temporarily and not stored.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setExtractorSourceMode("upload");
                                  setExtractorStatus(null);
                                  showToast("Upload mode selected.");
                                }}
                                className="pressable rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-elevated)] px-4 py-2 text-sm font-bold text-[var(--color-brand-ink)]"
                              >
                                Back to file
                              </button>
                            </div>
                            <textarea
                              value={extractorPastedText}
                              onChange={(event) => setExtractorPastedText(event.target.value)}
                              rows={10}
                              placeholder="Paste your chord sheet here. This text is processed temporarily and not stored."
                              className="max-h-[320px] min-h-[220px] w-full resize-y overflow-y-auto rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-4 py-3 text-sm leading-6 text-[var(--color-brand-ink)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-focus)]"
                            />
                          </div>
                        ) : (
                          <>
                            <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-brand-panel-strong)] text-[var(--color-focus)] transition group-hover:scale-105">
                              <CloudUpload className="h-10 w-10" />
                            </span>
                            <span className="text-2xl font-bold text-[var(--color-brand-ink)]">
                              Drag & drop your song files
                            </span>
                            <span className="mt-2 text-base font-semibold text-[var(--color-text-secondary)]">
                              PDF, TXT, or DOCX up to 25MB
                            </span>
                            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => {
                                  setExtractorSourceMode("upload");
                                  setExtractorAiRetry(null);
                                  setExtractorStatus(null);
                                  extractorFileInputRef.current?.click();
                                }}
                                className="pressable inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-elevated)] px-8 py-3 text-sm font-bold text-[var(--color-brand-ink)]"
                              >
                                <Upload className="h-4 w-4" />
                                Select File
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setExtractorSourceMode("paste");
                                  setExtractorAiRetry(null);
                                  setExtractorStatus(null);
                                  showToast("Paste mode selected.");
                                }}
                                className="text-sm font-semibold italic text-[var(--color-text-secondary)] hover:text-[var(--color-focus)]"
                              >
                                or copy/paste lyrics
                              </button>
                            </div>
                            {extractorFileLabel ? (
                              <span className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[var(--color-focus)] bg-[var(--color-brand-panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-ink)]">
                                <FileText className="h-4 w-4 text-[var(--color-focus)]" />
                                {extractorFileLabel}
                              </span>
                            ) : null}
                          </>
                        )}
                        <input
                          ref={extractorFileInputRef}
                          name="file"
                          type="file"
                          accept=".txt,text/plain,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf"
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              setExtractorSelectedFile(null);
                              setExtractorFileLabel(null);
                              setExtractorStatus("No file selected.");
                              setExtractorAiRetry(null);
                              return;
                            }

                            setExtractorSourceMode("upload");
                            setFeedback(null);
                            setExtractorAiRetry(null);
                            setExtractorSelectedFile(file);
                            setExtractorFileLabel(`${file.name} - ${Math.ceil(file.size / 1024)} KB`);
                            setExtractorSongTitle(getFileNameWithoutExtension(file.name));
                            setExtractorDraftText("");
                            setExtractorStatus("File selected. Choose a processing mode.");
                            showToast(`${file.name} selected.`);
                            event.currentTarget.value = "";
                          }}
                        />
                      </div>

                      <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => processFormatterSource(false)}
                          disabled={isFormatterProcessing}
                          className="ui-btn-primary pressable min-w-48 px-10 py-4 text-sm font-bold disabled:opacity-60"
                        >
                          Process Locally
                        </button>
                        <button
                          type="button"
                          onClick={() => processFormatterSource(true)}
                          disabled={isFormatterProcessing}
                          className="pressable min-w-48 rounded-xl border border-[var(--color-brand-border)] bg-transparent px-10 py-4 text-sm font-bold text-[var(--color-brand-ink)] hover:bg-[var(--color-brand-panel)] disabled:opacity-60"
                        >
                          Process with AI
                        </button>
                      </div>
                      {extractorStatus || isFormatterProcessing ? (
                        <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                          {isFormatterProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-focus)]" />
                          ) : null}
                          {extractorStatus ?? "Processing lyrics..."}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                      <section className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="h-5 w-5 text-[var(--color-secondary)]" />
                          <h3 className="font-[var(--font-mono)] text-xs font-bold uppercase tracking-widest text-[var(--color-secondary)]">
                            Supported Output
                          </h3>
                        </div>
                        <ul className="mt-5 space-y-3 text-sm font-semibold text-[var(--color-text-secondary)]">
                          {["Planning Center XML", "ProPresenter 7 Slides", "Standard PDF Chords", "Markdown Text"].map((output) => (
                            <li key={output} className="flex items-center gap-3">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-secondary)]" />
                              {output}
                            </li>
                          ))}
                        </ul>
                      </section>

                      <section className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:col-span-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <History className="h-5 w-5 text-[var(--color-focus)]" />
                            <h3 className="font-[var(--font-mono)] text-xs font-bold uppercase tracking-widest text-[var(--color-focus)]">
                              Recent Conversions
                            </h3>
                          </div>
                          <button type="button" className="text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-focus)]">
                            View All
                          </button>
                        </div>
                        <div className="mt-4 space-y-2">
                          {recentSongConversions.length > 0 ? (
                            recentSongConversions.map((job) => {
                              const parser = getExtractorParser(job.outputJson);
                              const summary = getExtractorSummary(job.outputJson);
                              const source = getExtractorSourceLabel(job.inputJson) ?? getExtractorSource(job.inputJson);

                              return (
                                <div key={job.id} className="group flex items-center justify-between rounded-lg p-3 transition hover:bg-[var(--color-brand-panel-strong)]">
                                  <div className="flex items-center gap-4">
                                    <span className="flex h-10 w-10 items-center justify-center rounded bg-[var(--color-brand-panel-strong)] text-[var(--color-text-secondary)]">
                                      <FileText className="h-5 w-5" />
                                    </span>
                                    <div>
                                      <p className="text-sm font-bold text-[var(--color-brand-ink)]">
                                        {source}{parser ? ` - ${parser}` : ""}
                                      </p>
                                      <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                                        {formatRecentConversionTime(job.createdAt, recentConversionNow)} - {summary ?? job.status}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="rounded-md border border-[var(--color-brand-border)] px-2 py-1 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
                                    {job.status}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="rounded-lg border border-dashed border-[var(--color-brand-border)] bg-[var(--color-brand-panel-strong)] p-4 text-sm text-[var(--color-text-secondary)]">
                              No uploaded files tracked yet.
                            </div>
                          )}
                        </div>
                      </section>
                    </div>
                  </section>
                ) : null}

                {activeSongStep === "format" ? (
                  extractorDraftText ? (
                    <section className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)]">
                      <div className="flex flex-col gap-3 border-b border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-[var(--color-brand-ink)]">
                            Song Editor{extractorSongTitle ? `: ${extractorSongTitle}` : ""}
                          </h2>
                          <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                            Editing lyrics and structure blocks directly.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {extractorAiRetry ? (
                            <div className="group relative flex items-center">
                              <span
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-card-yellow-bold)] bg-[var(--color-card-yellow)] text-sm font-black text-[var(--color-brand-ink)]"
                                aria-label="Confidence warning"
                              >
                                !
                              </span>
                              <div className="pointer-events-none absolute right-0 top-10 z-20 hidden w-80 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-3 text-xs leading-5 text-[var(--color-text-secondary)] shadow-lg group-hover:block">
                                <p className="font-bold text-[var(--color-brand-ink)]">
                                  Confidence: {extractorAiRetry.confidence.toUpperCase()}
                                </p>
                                <p className="mt-1">
                                  {extractorAiRetry.warningCodes.join(", ")}
                                </p>
                              </div>
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              if (extractorAiRetry) {
                                aiExtractorRetryMutation.mutate({ serviceId: selectedService?.id, retryToken: extractorAiRetry.retryToken });
                                return;
                              }

                              if (directAiReformatUsed) {
                                showToast("AI reformat can only run once for this draft.");
                                return;
                              }

                              aiLyricsReformatMutation.mutate({
                                serviceId: selectedService?.id,
                                text: extractorDraftText,
                                songTitle: extractorSongTitle || undefined,
                              });
                            }}
                            disabled={aiExtractorRetryMutation.isPending || aiLyricsReformatMutation.isPending || (!extractorAiRetry && directAiReformatUsed)}
                            className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--color-brand-accent)] bg-[var(--color-brand-panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-focus)] disabled:opacity-60"
                          >
                            {aiExtractorRetryMutation.isPending || aiLyricsReformatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                            {directAiReformatUsed && !extractorAiRetry ? "AI Reformat Used" : "Reformat with AI"}
                          </button>
                          <button
                            type="button"
                            onClick={() => showToast("Library save will be connected to the song repository workflow later.")}
                            className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-ink)]"
                          >
                            <Save className="h-4 w-4" />
                            Save to Library
                          </button>
                        </div>
                      </div>

                      <div
                        className="grid min-h-[720px] items-stretch"
                        style={{ gridTemplateColumns: `${editorControlsWidth}px minmax(0, 1fr)` }}
                      >
                        <aside className="relative border-r border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] p-4">
                          <button
                            type="button"
                            onMouseDown={startEditorControlsResize}
                            className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize border-x border-transparent hover:border-[var(--color-focus)]"
                            aria-label="Resize section controls"
                          />
                          <section>
                            <p className="technical-label flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              File Name
                            </p>
                            <input
                              value={extractorSongTitle}
                              onChange={(event) => setExtractorSongTitle(event.target.value)}
                              placeholder="reviewed-song-lyrics"
                              className="mt-4 h-11 w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 text-sm font-semibold text-[var(--color-brand-ink)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-focus)]"
                            />
                            <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                              Used for DOCX export and defaults to the uploaded file name.
                            </p>
                          </section>

                          <section>
                            <p className="technical-label mt-8 flex items-center gap-2">
                              <ListMusic className="h-4 w-4" />
                              Section Segmentation
                            </p>
                            <div className="mt-4 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-3">
                              <p className="text-xs font-semibold text-[var(--color-brand-ink)]">Automatically divide blocks into slides:</p>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                {[2, 3].map((size) => (
                                  <button
                                    key={size}
                                    type="button"
                                    onClick={() => setSectionLineGroupSize(size as 2 | 3)}
                                    className={`pressable rounded-md border px-3 py-2 text-xs font-bold ${
                                      sectionLineGroupSize === size
                                        ? "border-[var(--color-focus)] bg-[var(--color-brand-panel-strong)] text-[var(--color-focus)]"
                                        : "border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] text-[var(--color-brand-ink)]"
                                    }`}
                                  >
                                    {size} Lines/Slide
                                  </button>
                                ))}
                              </div>
                              <label className="mt-3 block">
                                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                                  Apply to tag
                                </span>
                                <select
                                  value={sectionFormatTag}
                                  onChange={(event) => setSectionFormatTag(event.target.value)}
                                  className="mt-1 h-10 w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-3 text-sm font-semibold text-[var(--color-brand-ink)] outline-none focus:border-[var(--color-focus)]"
                                >
                                  {songTags.map((tag) => (
                                    <option key={tag.id} value={tag.token}>
                                      {tag.label}
                                    </option>
                                  ))}
                                  {songTags.some((tag) => tag.token === sectionFormatTag) ? null : (
                                    <option value={sectionFormatTag}>{sectionFormatTag}</option>
                                  )}
                                </select>
                              </label>
                              <div className="mt-3 flex items-center justify-between border-t border-[var(--color-brand-border)] pt-3">
                                <span className="text-xs font-semibold text-[var(--color-brand-ink)]">Smart Splitting</span>
                                <span className="flex h-5 w-10 items-center justify-end rounded-full bg-[var(--color-brand-accent)] p-1">
                                  <span className="h-3 w-3 rounded-full bg-[var(--color-accent-ink)]" />
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const tagToken = sectionFormatTag || songTags[0]?.token || "Verse";
                                  const nextDraft = regroupDraftTagSections(extractorDraftText, tagToken, sectionLineGroupSize);
                                  commitExtractorDraftText(nextDraft);
                                  setExtractorStatus(`${tagToken} sections regrouped into ${sectionLineGroupSize}-line blocks.`);
                                  showToast(`Applied ${sectionLineGroupSize}-line grouping.`, "success");
                                }}
                                className="pressable mt-3 h-10 w-full rounded-lg bg-[var(--color-brand-accent)] px-4 text-sm font-semibold text-[var(--color-accent-ink)]"
                              >
                                Apply splitting
                              </button>
                            </div>
                          </section>

                          <section className="mt-8">
                            <p className="technical-label">Quick Tagging</p>
                            <p className="mt-3 text-xs font-semibold text-[var(--color-text-secondary)]">Apply tag to selected block:</p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {songTags.slice(0, 6).map((tag) => (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => applySongTagToDraft(tag)}
                                  className="pressable flex items-center gap-2 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-xs font-semibold text-[var(--color-brand-ink)]"
                                >
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                  {tag.label}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setTagSettingsOpen((current) => !current)}
                              className="pressable mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)]"
                            >
                              <Settings2 className="h-4 w-4" />
                              Tag Settings
                            </button>
                            {tagSettingsOpen ? (
                              <div className="mt-3 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-3">
                                <form
                                  className="grid gap-2"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const label = tagForm.label.trim();
                                    const token = (tagForm.token || tagForm.label).trim();
                                    if (!label || !token) {
                                      showToast("Add a tag label first.");
                                      return;
                                    }

                                    createSongTagMutation.mutate({
                                      ...tagForm,
                                      label,
                                      token,
                                      order: Number(tagForm.order) || songTags.length + 1,
                                    });
                                  }}
                                >
                                  <div className="grid grid-cols-[1fr_auto] gap-2">
                                    <input
                                      value={tagForm.label}
                                      onChange={(event) => {
                                        const label = event.target.value;
                                        setTagForm((current) => ({
                                          ...current,
                                          label,
                                          token: current.token || label.replace(/\s+/g, "-"),
                                        }));
                                      }}
                                      placeholder="Tag label"
                                      className="h-9 min-w-0 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-2 text-xs font-semibold text-[var(--color-brand-ink)] outline-none focus:border-[var(--color-focus)]"
                                    />
                                    <input
                                      type="color"
                                      value={tagForm.color}
                                      onChange={(event) => setTagForm((current) => ({ ...current, color: event.target.value }))}
                                      className="h-9 w-10 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] p-1"
                                      aria-label="Tag color"
                                    />
                                  </div>
                                  <div className="grid grid-cols-[1fr_72px] gap-2">
                                    <input
                                      value={tagForm.token}
                                      onChange={(event) => setTagForm((current) => ({ ...current, token: event.target.value }))}
                                      placeholder="Token"
                                      className="h-9 min-w-0 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-2 text-xs font-semibold text-[var(--color-brand-ink)] outline-none focus:border-[var(--color-focus)]"
                                    />
                                    <input
                                      type="number"
                                      value={tagForm.order}
                                      onChange={(event) => setTagForm((current) => ({ ...current, order: Number(event.target.value) }))}
                                      className="h-9 min-w-0 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-2 text-xs font-semibold text-[var(--color-brand-ink)] outline-none focus:border-[var(--color-focus)]"
                                      aria-label="Tag order"
                                    />
                                  </div>
                                  <button
                                    type="submit"
                                    disabled={createSongTagMutation.isPending}
                                    className="pressable h-9 rounded-md bg-[var(--color-brand-accent)] px-3 text-xs font-bold text-[var(--color-accent-ink)] disabled:opacity-60"
                                  >
                                    {createSongTagMutation.isPending ? "Adding..." : "Add Tag"}
                                  </button>
                                </form>

                                <div className="mt-4 space-y-2">
                                  {songTags.map((tag) => (
                                    <div key={tag.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md bg-[var(--color-brand-bg)] p-2">
                                      <input
                                        type="color"
                                        value={tag.color}
                                        onChange={(event) =>
                                          updateSongTagMutation.mutate({
                                            id: tag.id,
                                            payload: { color: event.target.value },
                                          })
                                        }
                                        className="h-8 w-8 rounded border border-[var(--color-brand-border)] bg-transparent p-1"
                                        aria-label={`${tag.label} color`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setSectionFormatTag(tag.token)}
                                        className="min-w-0 text-left text-xs font-semibold text-[var(--color-brand-ink)]"
                                      >
                                        <span className="block truncate">{tag.label}</span>
                                        <span className="block truncate text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                                          {tag.token}
                                        </span>
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextLabel = window.prompt("Rename tag", tag.label)?.trim();
                                            if (!nextLabel) return;
                                            updateSongTagMutation.mutate({
                                              id: tag.id,
                                              payload: { label: nextLabel, token: nextLabel.replace(/\s+/g, "-") },
                                            });
                                          }}
                                          className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-focus)]"
                                          aria-label={`Rename ${tag.label}`}
                                        >
                                          <Settings2 className="h-3.5 w-3.5" />
                                        </button>
                                        {!tag.isDefault ? (
                                          <button
                                            type="button"
                                            onClick={() => deleteSongTagMutation.mutate(tag.id)}
                                            className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                                            aria-label={`Delete ${tag.label}`}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </section>

                        </aside>

                        <section className="flex min-w-0 flex-col bg-[var(--color-brand-panel-alt)]">
                          <div className="flex items-center justify-between border-b border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-6 py-3">
                            <div className="flex items-center gap-4">
                              <span className="technical-label">Interactive Block Editor</span>
                              <span className="h-4 w-px bg-[var(--color-brand-border)]" />
                              <button
                                type="button"
                                onClick={undoExtractorDraft}
                                disabled={extractorUndoStack.length === 0}
                                className="rounded p-1 text-[var(--color-brand-ink)] hover:bg-[var(--color-brand-panel-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Undo"
                                title="Undo"
                              >
                                <Undo2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={redoExtractorDraft}
                                disabled={extractorRedoStack.length === 0}
                                className="rounded p-1 text-[var(--color-brand-ink)] hover:bg-[var(--color-brand-panel-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Redo"
                                title="Redo"
                              >
                                <Redo2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                              <span className="h-2 w-2 rounded-full bg-[var(--color-secondary)]" />
                              {formatSavedStatus(extractorLastSavedAt, editorClock)}
                            </div>
                          </div>

                          <div
                            ref={editorScrollRef}
                            onDragOver={(event) => {
                              event.preventDefault();
                              autoScrollEditorDuringDrag(event.clientY);
                            }}
                            className="max-h-[calc(100vh-14rem)] flex-1 overflow-y-auto p-6"
                          >
                            <div className="min-h-full space-y-4">
                            {editorSections.map((section, index) => {
                              const tag = section.tag ?? "Section";
                              const matchingTag = songTags.find((item) => item.token.toLowerCase() === tag.toLowerCase());
                              const borderColor = matchingTag?.color ?? "var(--color-focus)";

                              return (
                                <article
                                  key={`${tag}-${index}`}
                                  onDragOver={(event) => {
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = "move";
                                    autoScrollEditorDuringDrag(event.clientY);
                                  }}
                                  onDrop={(event) => {
                                    event.preventDefault();
                                    const sourceIndex = draggedEditorSectionIndex ?? Number(event.dataTransfer.getData("text/plain"));
                                    if (Number.isFinite(sourceIndex)) {
                                      reorderEditorSection(sourceIndex, index);
                                    }
                                  }}
                                  onDragEnd={() => setDraggedEditorSectionIndex(null)}
                                  className={`rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4 shadow-sm transition ${
                                    draggedEditorSectionIndex === index ? "opacity-50" : ""
                                  }`}
                                  style={{ borderLeft: `4px solid ${borderColor}` }}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        draggable
                                        onDragStart={(event) => {
                                          setDraggedEditorSectionIndex(index);
                                          event.dataTransfer.effectAllowed = "move";
                                          event.dataTransfer.setData("text/plain", String(index));
                                        }}
                                        className="cursor-grab select-none rounded p-1 text-lg leading-none text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-panel-strong)] active:cursor-grabbing"
                                        aria-label="Drag section"
                                        title="Drag section"
                                      >
                                        ::
                                      </button>
                                      <select
                                        value={tag}
                                        onChange={(event) => updateEditorSection(index, { ...section, tag: event.target.value })}
                                        className="h-8 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-strong)] px-2 text-xs font-bold text-[var(--color-brand-ink)] outline-none focus:border-[var(--color-focus)]"
                                      >
                                        {songTags.map((item) => (
                                          <option key={item.id} value={item.token}>{item.label}</option>
                                        ))}
                                        {!matchingTag ? <option value={tag}>{tag}</option> : null}
                                      </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                                        {section.lines.filter((line) => line.trim()).length} lines
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextSections = [
                                            ...editorSections.slice(0, index + 1),
                                            { ...section, lines: [...section.lines] },
                                            ...editorSections.slice(index + 1),
                                          ];
                                          commitEditorSections(nextSections);
                                          showToast("Section duplicated.", "success");
                                        }}
                                        className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-panel-strong)] hover:text-[var(--color-focus)]"
                                        aria-label="Duplicate section"
                                        title="Duplicate section"
                                      >
                                        <Copy className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextSections = editorSections.filter((_, itemIndex) => itemIndex !== index);
                                          commitEditorSections(nextSections);
                                          showToast("Section deleted.");
                                        }}
                                        className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-panel-strong)] hover:text-[var(--color-danger)]"
                                        aria-label="Delete section"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <textarea
                                    value={section.lines.join("\n")}
                                    onChange={(event) => updateEditorSection(index, { ...section, lines: event.target.value.split("\n") })}
                                    rows={Math.max(3, Math.min(8, section.lines.length + 1))}
                                    spellCheck={false}
                                    className="mt-4 w-full resize-y rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-3 py-2 text-sm leading-6 text-[var(--color-brand-ink)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-focus)]"
                                    aria-label={`${tag} lyrics`}
                                  />
                                </article>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() => commitEditorSections([...editorSections, { tag: "Verse", lines: [""] }])}
                              className="pressable flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] py-8 text-sm font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-focus)] hover:text-[var(--color-focus)]"
                            >
                              <Plus className="h-7 w-7" />
                              Click to add a new song section
                            </button>
                            </div>

                          </div>
                          <div className="flex flex-col gap-3 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                commitExtractorDraftText("");
                                setExtractorAiRetry(null);
                                setExtractorStatus("Draft cleared.");
                                showToast("Draft cleared.");
                                router.push("/songs/upload");
                              }}
                              className="pressable inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-strong)] px-4 py-3 text-sm font-semibold text-[var(--color-text-secondary)]"
                            >
                              <X className="h-4 w-4" />
                              Clear draft
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!extractorDraftText.trim()) {
                                  setFeedback("Extract or enter lyrics before generating DOCX.");
                                  showToast("Extract or enter lyrics before generating DOCX.");
                                  return;
                                }

                                setExtractorStatus("Generating DOCX...");
                                showToast("Generating DOCX...");
                                generateLyricsDocxMutation.mutate({
                                  serviceId: selectedService?.id,
                                  text: extractorDraftText,
                                  songTitle: extractorSongTitle || undefined,
                                });
                              }}
                              disabled={generateLyricsDocxMutation.isPending}
                              className="pressable inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-accent)] px-4 py-3 text-sm font-semibold text-[var(--color-accent-ink)] disabled:opacity-60"
                            >
                              {generateLyricsDocxMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              {generateLyricsDocxMutation.isPending ? "Generating DOCX..." : "Generate DOCX"}
                            </button>
                          </div>
                        </section>
                      </div>
                    </section>
                  ) : (
                    <section className="rounded-lg border border-dashed border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-8 text-center">
                      <p className="text-sm font-semibold text-[var(--color-brand-ink)]">No extracted draft yet</p>
                      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                        Start on Upload or paste lyrics, then the processed draft will open here.
                      </p>
                      <Link
                        href="/songs/upload"
                        className="pressable mt-4 inline-flex rounded-lg bg-[var(--color-brand-ink)] px-4 py-3 text-sm font-semibold text-white"
                      >
                        Go to Upload
                      </Link>
                    </section>
                  )
                ) : null}

            </>
          </div>
        ) : null}

        {module === "assets" ? (
          <div className="space-y-5">
            <div className="mx-auto max-w-3xl py-3 text-center">
              <h2 className="text-5xl font-bold leading-tight text-[var(--color-brand-ink)]">
                {mediaHeaderCopy.title}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--color-brand-ink)]">
                {mediaHeaderCopy.description}
              </p>
            </div>

            {!mediaTool ? (
              <div className="grid gap-4 md:grid-cols-3">
                {MEDIA_TOOLS.map((tool) => (
                  <Link
                    key={tool.id}
                    href={tool.href}
                    className="pressable rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-5 hover:border-[var(--color-focus)] hover:bg-[var(--color-brand-panel-strong)]"
                  >
                    <span className="block text-base font-semibold text-[var(--color-brand-ink)]">{tool.label}</span>
                    <span className="mt-2 block text-sm leading-6 text-[var(--color-text-secondary)]">{tool.description}</span>
                  </Link>
                ))}
              </div>
            ) : null}

            {mediaTool === "phone-transfer" ? (
              <section className="production-panel p-5">
                <PAPDesktopClient embedded hideHeader />
              </section>
            ) : null}

            {mediaTool === "qr-generator" ? (
              <QRGeneratorTool showToast={showToast} />
            ) : null}

            {mediaTool === "background-generator" ? (
              <BackgroundGeneratorTool showToast={showToast} />
            ) : null}

          </div>
        ) : null}
        {module === "automation" ? (
          <section className="production-panel p-5">
            <div className="mb-4">
              <p className="technical-label">LIVE CAPTIONS & OUTPUTS</p>
              <h2 className="mt-2 text-lg font-semibold">Output queue</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Persist job history and generated outputs while keeping the workflow simple.
              </p>
            </div>

            {selectedService ? (
              <>
                <form
                  className="space-y-3 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4"
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
                    className="w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
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
                    className="w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={createJobMutation.isPending}
                    className="pressable flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-accent)] px-4 py-3 text-sm font-semibold text-[var(--color-accent-ink)] hover:bg-[var(--color-brand-accent-hover)] disabled:opacity-60"
                  >
                    <WandSparkles className="h-4 w-4" />
                    Queue job
                  </button>
                </form>

                <div className="mt-4 max-h-[420px] divide-y divide-[var(--color-brand-border)] overflow-y-auto rounded-lg border border-[var(--color-brand-border)]">
                  {selectedService.jobs.map((job) => (
                    <div
                      key={job.id}
                      className="bg-[var(--color-brand-panel)] p-4 hover:bg-[var(--color-brand-panel-alt)]"
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
                        <span className="inline-flex items-center gap-2 font-[var(--font-plex-mono)] text-xs text-[var(--color-brand-olive)]">
                          <span className={`status-pip ${job.status === JobStatus.DONE ? "status-pip-ready" : job.status === JobStatus.FAILED ? "status-pip-alert" : ""}`} />
                          {job.status}
                        </span>
                      </div>
                      {job.outputs.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {job.outputs.map((output) => (
                            <a
                              key={output.id}
                              href={`/api/services/${selectedService.id}/outputs/${output.id}/download`}
                              className="block rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-accent)]"
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
      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </div>
  );
}


