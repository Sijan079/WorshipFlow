"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useServerDraft } from "@/features/song-formatter/use-server-draft";
import { formatLastTouchedAge } from "@/features/song-formatter/recent-conversion";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Popover } from "radix-ui";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  CloudUpload,
  FileText,
  History,
  Info,
  Loader2,
  Maximize2,
  Eraser,
  Plus,
  Pencil,
  QrCode,
  RefreshCcw,
  Save,
  Smartphone,
  Trash2,
  Upload,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  apiFetch,
  type CreateAutomationJobPayload,
  type CreateParticipantPayload,
  type CreateServicePayload,
  type CreateServiceSongPayload,
  type CreateSongPayload,
  type LyricsExtractorEditableResponse,
  type ServiceDetailRecord,
  type UpdateServiceBlocksPayload,
  type ServiceRecord,
  type SongTagPresetRecord,
  type UpdateParticipantPayload,
  type UpdateServicePayload,
  type UpsertServiceDetailPayload,
  generateLyricsDocx,
  runAiLyricsExtractorRetry,
  runAiLyricsReformat,
  runUploadLyricsExtractor,
  triggerBrowserDownload,
} from "@/lib/api-client";
import { BLOCK_LABELS, SONG_BLOCK_TYPES } from "@/lib/service-display";
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
import type {
  ExtractorWarningCode,
  LyricsExtractorAiRetryDescriptor,
  LyricsExtractorSafeOutput,
} from "@/lib/extractor-types";
import { normalizeExtractorWarnings } from "@/lib/extractor-warnings";
import PAPDesktopClient from "@/features/pap/components/pap-desktop-client";
import { PAPToastViewport, usePAPToasts } from "@/features/pap/components/pap-toasts";
import QRGeneratorTool from "@/components/qr-generator-tool";
import BackgroundGeneratorTool from "@/components/background-generator-tool";
import ResizeImageTool from "@/components/resize-image-tool";
import BackgroundRemovalTool from "@/components/background-removal-tool";
import { MEDIA_TOOLS_MODULE, type WorkspaceModule } from "@/lib/workspace-modules";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProductionSelect } from "@/components/ui/production-select";
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
type SongWorkflowStep = "upload" | "extraction" | "format";
type ServiceWorkflowStep = "setup" | "flow" | "review";
export type MediaTool = "phone-transfer" | "qr-generator" | "background-generator" | "resize-image" | "background-removal";

const SERVICE_WORKFLOW_STEPS: Array<{ id: ServiceWorkflowStep; label: string; description: string }> = [
  { id: "setup", label: "Service Setup", description: "Edit service info and import production notes." },
  { id: "flow", label: "Flow Hub", description: "Assign people, songs, and details by block." },
  { id: "review", label: "Run of Service", description: "Scan the complete service in strict order." },
];

const MEDIA_TOOLS: Array<{ id: MediaTool; label: string; description: string; icon: LucideIcon }> = [
  {
    id: "phone-transfer",
    label: "Phone Transfer",
    description:
      "Send screenshots from a phone, retrieve them here in original quality, then download or manage only the ones you need.",
    icon: Smartphone,
  },
  {
    id: "qr-generator",
    label: "QR Generator",
    description: "Create a code for giving links, forms, or service resources.",
    icon: QrCode,
  },
  {
    id: "background-generator",
    label: "Background Generator",
    description: "Generate projection-ready workspace image backgrounds with cost validation.",
    icon: WandSparkles,
  },
  {
    id: "resize-image",
    label: "Resize Image",
    description: "Fit one image into a 1920x1080 presentation frame without cropping.",
    icon: Maximize2,
  },
  {
    id: "background-removal",
    label: "Remove Background",
    description: "Use AI to separate a subject from its background and export a transparent PNG.",
    icon: Eraser,
  },
];

const MEDIA_TOOLS_HOME_COPY = {
  title: "Media Tools",
  description:
    "Transfer, generate, and prepare worship-service media for projection and booth handoff.",
};

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
  teams: {
    title: "Servant Teams",
    description:
      "Keep a simple directory of worship servants so assignments can be picked faster across services.",
  },
  songs: {
    title: "Worship Song Formatter",
    description:
      "Start from uploaded lyrics or pasted text, review extraction, then finish the document in the interactive editor.",
  },
  [MEDIA_TOOLS_MODULE]: {
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

function getBlockByType(service: ServiceDetailRecord, blockType: BlockType) {
  return service.blocks.find((block) => block.blockType === blockType);
}

function getBlockLabel(block: ServiceDetailRecord["blocks"][number]) {
  return block.label || BLOCK_LABELS[block.blockType];
}

function getBlockDefinition(block: ServiceDetailRecord["blocks"][number]) {
  const definition = block.fieldDefinition ?? block.typeVersion?.definition;
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) return null;
  const fields = (definition as { fields?: unknown }).fields;
  return Array.isArray(fields) ? fields.filter((field): field is { key: string; label: string; type: string; required: boolean; options?: string[]; helpText?: string } => Boolean(field && typeof field === "object" && "key" in field && "label" in field && "type" in field)) : null;
}

function ProgrammableBlockFields({
  block,
  onSave,
  saving,
}: {
  block: ServiceDetailRecord["blocks"][number];
  onSave: (values: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const definition = getBlockDefinition(block);
  const [values, setValues] = useState<Record<string, unknown>>(
    block.fieldValues && typeof block.fieldValues === "object" && !Array.isArray(block.fieldValues) ? block.fieldValues as Record<string, unknown> : {},
  );
  const servantsQuery = useQuery({
    queryKey: ["servants", "block-picker"],
    queryFn: () => apiFetch<Array<{ id: string; name: string }>>("/api/servants"),
    enabled: block.kind === "PERSON",
  });
  const pathname = usePathname();
  const workspaceMatch = pathname.match(/^\/w\/([^/]+)/);
  const teamsHref = workspaceMatch ? `/w/${workspaceMatch[1]}/teams` : "/teams";
  const saveText = (text: string) => onSave({ text });
  const personIds = Array.isArray(values.personIds) ? values.personIds.filter((value): value is string => typeof value === "string") : [];
  if (block.kind === "TEXT") {
    return (
      <label className="block rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4 text-sm font-semibold text-[var(--text-secondary)]">
        {getBlockLabel(block)} notes
        <textarea value={typeof values.text === "string" ? values.text : ""} onChange={(event) => setValues({ text: event.target.value })} rows={4} className="mt-2 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-sm font-normal text-[var(--text-primary)]" placeholder="Add any notes or details for this service step." />
        <button type="button" onClick={() => saveText(typeof values.text === "string" ? values.text : "")} disabled={saving} className="ui-btn-primary pressable mt-3 px-3 text-xs font-semibold disabled:opacity-50">{saving ? "Saving…" : "Save text"}</button>
      </label>
    );
  }
  if (block.kind === "PERSON") {
    const people = servantsQuery.data ?? [];
    const savePeople = (next: string[]) => { setValues({ personIds: next }); onSave({ personIds: next }); };
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4">
        <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-[var(--text-primary)]">Assigned team</h4><Link href={teamsHref} className="text-xs font-semibold text-[var(--text-accent)] underline-offset-2 hover:underline">Manage Teams</Link></div>
        <div className="mt-3 flex flex-wrap gap-2">{personIds.map((id) => <button key={id} type="button" onClick={() => savePeople(personIds.filter((personId) => personId !== id))} className="rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-2 py-1 text-xs text-[var(--text-primary)]">{people.find((person) => person.id === id)?.name ?? "Unavailable person"} ×</button>)}</div>
        <select value="" onChange={(event) => { const id = event.target.value; if (id && !personIds.includes(id)) savePeople([...personIds, id]); }} disabled={servantsQuery.isLoading || saving} className="mt-3 min-h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-sm text-[var(--text-primary)]"><option value="">Add a Team member…</option>{people.filter((person) => !personIds.includes(person.id)).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
      </div>
    );
  }
  if (!definition || definition.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><h4 className="text-sm font-semibold text-[var(--color-brand-ink)]">Block fields</h4><p className="mt-1 text-xs text-[var(--color-text-secondary)]">Copied from this service&apos;s template.</p></div>
        <button type="button" onClick={() => onSave(values)} disabled={saving} className="rounded-md bg-[var(--color-brand-ink)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save fields"}</button>
      </div>
      <div className="space-y-3">
        {definition.map((field) => {
          const value = values[field.key];
          const update = (next: unknown) => setValues((current) => ({ ...current, [field.key]: next }));
          if (field.type === "checkbox") return <label key={field.key} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"><input type="checkbox" checked={Boolean(value)} onChange={(event) => update(event.target.checked)} />{field.label}{field.required ? " *" : ""}</label>;
          if (field.type === "long_text") return <label key={field.key} className="block text-xs font-semibold text-[var(--color-text-secondary)]">{field.label}{field.required ? " *" : ""}<textarea value={String(value ?? "")} onChange={(event) => update(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-3 py-2 text-sm font-normal text-[var(--color-brand-ink)]" placeholder={field.helpText} /></label>;
          if (field.type === "single_select") return <label key={field.key} className="block text-xs font-semibold text-[var(--color-text-secondary)]">{field.label}{field.required ? " *" : ""}<select value={String(value ?? "")} onChange={(event) => update(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-3 text-sm font-normal text-[var(--color-brand-ink)]"><option value="">Select...</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
          return <label key={field.key} className="block text-xs font-semibold text-[var(--color-text-secondary)]">{field.label}{field.required ? " *" : ""}<input value={String(value ?? "")} onChange={(event) => update(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-3 text-sm font-normal text-[var(--color-brand-ink)]" placeholder={field.helpText} /></label>;
        })}
      </div>
    </div>
  );
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

function getFileNameWithoutExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "").trim();
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

const SongDocumentEditor = dynamic(() => import("@/features/song-formatter/song-document-editor"), {
  ssr: false,
  loading: () => <p className="p-8 text-sm text-[var(--text-secondary)]" role="status">Loading song editor…</p>,
});

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
  const workspaceRoutePrefix = pathname.match(/^\/w\/[^/]+/)?.[0] ?? "";
  const workspaceFormatterPath = (step: "upload" | "format") =>
    `${workspaceRoutePrefix}/song-formatter/${step}`;
  const workspaceMediaToolsPath = (tool?: MediaTool) =>
    `${workspaceRoutePrefix}/media-tools${tool ? `/${tool}` : ""}`;
  const activeSongStep = songStep ?? getSongWorkflowStep(pathname);
  const { dismissToast, showToast, toasts } = usePAPToasts();
  const [activeServiceStep, setActiveServiceStep] = useState<ServiceWorkflowStep>("setup");
  const [activeServiceBlockId, setActiveServiceBlockId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [newServiceModalOpen, setNewServiceModalOpen] = useState(false);
  const [automationJobType, setAutomationJobType] = useState<JobType>(JobType.FREESHOW_GENERATE);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [serviceAnalysisText, setServiceAnalysisText] = useState("");
  const [serviceAnalysisDraft, setServiceAnalysisDraft] = useState<AnalyzedServiceDraft | null>(null);
  const [extractorStatus, setExtractorStatus] = useState<string | null>(null);
  const [extractorSelectedFile, setExtractorSelectedFile] = useState<File | null>(null);
  const [extractorFileLabel, setExtractorFileLabel] = useState<string | null>(null);
  const [extractorSongTitle, setExtractorSongTitle] = useState("");
  const [extractorAiRetry, setExtractorAiRetry] = useState<LyricsExtractorAiRetryDescriptor | null>(null);
  const [extractorWarningCodes, setExtractorWarningCodes] = useState<ExtractorWarningCode[]>([]);
  const [extractorWarningsDismissed, setExtractorWarningsDismissed] = useState(false);
  const [directAiReformatUsed, setDirectAiReformatUsed] = useState(false);
  const [extractorDraftText, setExtractorDraftText] = useState("");
  const [formatterDraftOpened, setFormatterDraftOpened] = useState(false);
  const extractorFileInputRef = useRef<HTMLInputElement | null>(null);
  const recoveryDraft = useMemo(() => ({
    text: extractorDraftText,
    songTitle: extractorSongTitle,
    warningCodes: extractorWarningCodes,
    warningsDismissed: extractorWarningsDismissed,
    directAiReformatUsed,
  }), [extractorDraftText, extractorSongTitle, extractorWarningCodes, extractorWarningsDismissed, directAiReformatUsed]);
  const recovery = useServerDraft({
    enabled: module === "songs",
    editing: module === "songs" && activeSongStep === "format",
    workspaceSlug: workspaceRoutePrefix.split("/")[2],
    draft: recoveryDraft,
    onRestore: draft => {
      setFormatterDraftOpened(Boolean(draft.text));
      setExtractorDraftText(draft.text);
      setExtractorSongTitle(draft.songTitle);
      setExtractorWarningCodes(draft.warningCodes);
      setExtractorWarningsDismissed(draft.warningsDismissed);
      setDirectAiReformatUsed(draft.directAiReformatUsed);
      setExtractorAiRetry(null);
    },
  });
  const normalizedExtractorWarnings = useMemo(
    () => normalizeExtractorWarnings(extractorWarningCodes),
    [extractorWarningCodes],
  );

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
      showToast(error.message, "error");
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

  const updateServiceBlocksMutation = useMutation({
    mutationFn: ({ serviceId, payload }: { serviceId: string; payload: UpdateServiceBlocksPayload }) =>
      apiFetch<ServiceDetailRecord>(`/api/services/${serviceId}/blocks`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (service) => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      await queryClient.invalidateQueries({ queryKey: ["service", service.id] });
      setActiveServiceBlockId((current) => service.blocks.some((block) => block.id === current) ? current : service.blocks[0]?.id ?? null);
      setFeedback("Service blocks updated.");
      showToast("Service blocks updated.", "success");
    },
    onError: (error: Error) => {
      setFeedback(error.message);
      showToast(error.message, "error");
    },
  });

  const saveBlockValuesMutation = useMutation({
    mutationFn: ({ serviceId, blockId, values }: { serviceId: string; blockId: string; values: Record<string, unknown> }) =>
      apiFetch(`/api/services/${serviceId}/blocks/${blockId}/values`, { method: "PUT", body: JSON.stringify({ values }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["service"] });
      setFeedback("Block fields saved.");
    },
    onError: (error: Error) => { setFeedback(error.message); showToast(error.message, "error"); },
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
      showToast(error.message, "error");
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

  const applyExtractorResult = (result: LyricsExtractorEditableResponse) => {
    setExtractorDraftText(result.text);
    setDirectAiReformatUsed(false);
    setExtractorAiRetry(result.retry ?? null);
    setExtractorWarningCodes(result.outputJson.warningCodes);
    setExtractorWarningsDismissed(false);

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
          conversionId: result.conversionId,
        });
        return;
      }
      router.push(workspaceFormatterPath("format"));
    },
    onError: (error: Error) => {
      setExtractorStatus("Extraction failed.");
      setFeedback(error.message);
      showToast(error.message, "error");
    },
  });

  const aiExtractorRetryMutation = useMutation({
    mutationFn: async ({ serviceId, retryToken, conversionId }: { serviceId?: string; retryToken: string; conversionId?: string }) => {
      const result = await runAiLyricsExtractorRetry({ serviceId, retryToken });
      await recovery.commitContent({ ...recoveryDraft, text: result.text, warningCodes: result.outputJson.warningCodes, warningsDismissed: false, directAiReformatUsed: true }, conversionId);
      return result;
    },
    onSuccess: async (_result, variables) => {
      setExtractorAiRetry(null);
      setExtractorStatus("AI-cleaned lyrics are ready for review.");
      if (variables.serviceId) {
        await invalidateServices();
      }
      setFeedback("AI cleanup completed for this one-time extraction. Review before generating DOCX.");
      showToast("AI cleanup completed.", "success");
      router.push(workspaceFormatterPath("format"));
    },
    onError: (error: Error) => {
      setExtractorStatus(error.message);
      setFeedback(error.message);
      showToast(error.message, "error");
    },
  });

  const aiLyricsReformatMutation = useMutation({
    mutationFn: async ({ serviceId, text, songTitle, conversionId }: { serviceId?: string; text: string; songTitle?: string; conversionId?: string }) => {
      const result = await runAiLyricsReformat({ serviceId, text, songTitle });
      await recovery.commitContent({ ...recoveryDraft, text: result.text, warningCodes: result.outputJson.warningCodes, warningsDismissed: false, directAiReformatUsed: true }, conversionId);
      return result;
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
      router.push(workspaceFormatterPath("format"));
    },
    onError: (error: Error) => {
      setExtractorStatus(error.message);
      setFeedback(error.message);
      showToast(error.message, "error");
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
      setFeedback("Reviewed lyrics downloaded as DOCX. Your temporary draft remains editable.");
      showToast(`${fileName} downloaded.`, "success");
    },
    onError: (error: Error) => {
      setExtractorStatus("DOCX generation failed.");
      setFeedback(error.message);
      showToast(error.message, "error");
    },
  });

  const resolvedSelectedServiceId =
    selectedServiceId && services.some((service) => service.id === selectedServiceId)
      ? selectedServiceId
      : (services.find((service) => service.ministryName === "Ladies Ministry") ?? services[0])?.id ?? null;
  const selectedServiceQuery = useQuery({
    queryKey: ["service", resolvedSelectedServiceId],
    queryFn: () => apiFetch<ServiceDetailRecord>(`/api/services/${resolvedSelectedServiceId}`),
    enabled: Boolean(resolvedSelectedServiceId),
  });

  const selectedService = selectedServiceQuery.data ?? null;
  const selectedServiceBlocks = selectedService?.blocks ?? [];
  const effectiveActiveServiceBlock = selectedServiceBlocks.find((block) => block.id === activeServiceBlockId)
    ?? selectedServiceBlocks[0]
    ?? null;
  const activeServiceBlock = effectiveActiveServiceBlock;
  const saveServiceBlocks = (blocks: ServiceDetailRecord["blocks"]) => {
    if (!selectedService) return;
    updateServiceBlocksMutation.mutate({
      serviceId: selectedService.id,
      payload: {
        blocks: blocks.map((block, order) => ({
          id: block.id || undefined,
          label: block.label || BLOCK_LABELS[block.blockType],
          code: block.code || undefined,
          blockType: block.blockType,
          order,
        })),
      },
    });
  };

  const moveActiveServiceBlock = (offset: number) => {
    if (!activeServiceBlock) return;
    const from = selectedServiceBlocks.findIndex((block) => block.id === activeServiceBlock.id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= selectedServiceBlocks.length) return;
    const next = [...selectedServiceBlocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    saveServiceBlocks(next);
  };

  const addCustomServiceBlock = () => {
    if (!selectedService) return;
    const label = window.prompt("New program block", "Custom program item")?.trim();
    if (!label) return;
    saveServiceBlocks([
      ...selectedServiceBlocks,
      {
        id: "",
        serviceId: selectedService.id,
        blockType: "CUSTOM",
        kind: "TEXT",
        label,
        code: null,
        order: selectedServiceBlocks.length,
        typeVersionId: null,
        typeVersion: null,
        fieldDefinition: { fields: [] },
        fieldValues: {},
        createdAt: new Date().toISOString(),
        people: [],
        songs: [],
        details: [],
      },
    ]);
  };

  const renameActiveServiceBlock = () => {
    if (!activeServiceBlock) return;
    const label = window.prompt("Rename program block", getBlockLabel(activeServiceBlock))?.trim();
    if (!label) return;
    saveServiceBlocks(selectedServiceBlocks.map((block) => block.id === activeServiceBlock.id ? { ...block, label } : block));
  };

  const removeActiveServiceBlock = () => {
    if (!activeServiceBlock || selectedServiceBlocks.length <= 1) return;
    if (!window.confirm(`Remove ${getBlockLabel(activeServiceBlock)} from this service?`)) return;
    saveServiceBlocks(selectedServiceBlocks.filter((block) => block.id !== activeServiceBlock.id));
  };
  const isFormatterProcessing = uploadExtractorMutation.isPending || aiExtractorRetryMutation.isPending;
  const processFormatterSource = (useAi: boolean) => {
    if (isFormatterProcessing) {
      return;
    }

    setFeedback(null);
    setExtractorAiRetry(null);
    setExtractorWarningCodes([]);
    setExtractorWarningsDismissed(false);

    if (!extractorSelectedFile) {
      setFeedback("Select a song file before processing.");
      showToast("Select a song file before processing.");
      return;
    }

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
          sermonVerse: serviceAnalysisDraft.sermonVerse ?? selectedService.sermonVerse ?? undefined,
          status: serviceAnalysisDraft.status,
          bibleVerses: serviceAnalysisDraft.bibleVerses,
          servantAssignments: serviceAnalysisDraft.servantAssignments,
          hymnals: serviceAnalysisDraft.hymnals,
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
      showToast(message, "error");
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
  const mediaToolNav = mediaTool
    ? [...MEDIA_TOOLS.filter((tool) => tool.id === mediaTool), ...MEDIA_TOOLS.filter((tool) => tool.id !== mediaTool)]
    : MEDIA_TOOLS;

  return (
    <div className="min-h-full space-y-5">
      {module === "songs" || module === MEDIA_TOOLS_MODULE ? null : module === "services" ? (
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
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
              {moduleCopy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
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

      <Dialog open={newServiceModalOpen} onOpenChange={setNewServiceModalOpen}>
      {newServiceModalOpen ? (
          <DialogContent className="max-w-lg">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-semibold">Create worship service</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Add the service details and choose the flow template.
                </DialogDescription>
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
            <Controller
              control={createServiceForm.control}
              name="serviceVariant"
              render={({ field }) => (
                <ProductionSelect
                  label="Template"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={[
                    { value: ServiceVariant.STANDARD, label: "Standard Worship Service" },
                    { value: ServiceVariant.EXTENDED, label: "Extended Worship Service" },
                  ]}
                  triggerClassName="bg-[var(--color-brand-panel)]"
                />
              )}
            />
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
          </DialogContent>
      ) : null}
      </Dialog>

      {module === "services" ? (
        <div className="flex min-w-0 flex-1 flex-col gap-4">
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
                      <Controller
                        control={serviceHeaderForm.control}
                        name="status"
                        render={({ field }) => (
                          <ProductionSelect
                            label="Status"
                            value={field.value}
                            onValueChange={field.onChange}
                            options={Object.values(ServiceStatus).map((status) => ({ value: status, label: status }))}
                            triggerClassName="bg-[var(--color-brand-panel)]"
                          />
                        )}
                      />
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
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-[var(--color-brand-border)] py-3">
                        <button type="button" onClick={addCustomServiceBlock} disabled={updateServiceBlocksMutation.isPending} className="rounded-md bg-[var(--color-brand-ink)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                          Add custom block
                        </button>
                        <button type="button" onClick={renameActiveServiceBlock} disabled={!activeServiceBlock || updateServiceBlocksMutation.isPending} className="rounded-md border border-[var(--color-brand-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] disabled:opacity-50">
                          Rename
                        </button>
                        <button type="button" onClick={() => moveActiveServiceBlock(-1)} disabled={!activeServiceBlock || updateServiceBlocksMutation.isPending} className="rounded-md border border-[var(--color-brand-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] disabled:opacity-50">
                          Move up
                        </button>
                        <button type="button" onClick={() => moveActiveServiceBlock(1)} disabled={!activeServiceBlock || updateServiceBlocksMutation.isPending} className="rounded-md border border-[var(--color-brand-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] disabled:opacity-50">
                          Move down
                        </button>
                        <button type="button" onClick={removeActiveServiceBlock} disabled={!activeServiceBlock || selectedServiceBlocks.length <= 1 || updateServiceBlocksMutation.isPending} className="rounded-md border border-[var(--color-brand-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] disabled:opacity-50">
                          Remove
                        </button>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {selectedServiceBlocks.map((block) => {
                          const active = effectiveActiveServiceBlock?.id === block.id;
                          return (
                            <button
                              key={block.id}
                              type="button"
                              onClick={() => {
                                setActiveServiceBlockId(block.id);
                                showToast(`${getBlockLabel(block)} opened.`);
                              }}
                              className={`pressable rounded-lg border px-3 py-3 text-left transition ${
                                active
                                  ? "border-[var(--color-brand-ink)] bg-[var(--color-brand-ink)] text-white"
                                  : "border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] hover:border-[var(--color-brand-accent)]"
                              }`}
                            >
                              <span className="block font-[var(--font-plex-mono)] text-[11px] opacity-75">
                                Block {block.order + 1}
                              </span>
                              <span className="mt-1 block text-sm font-semibold">{getBlockLabel(block)}</span>
                              <span className="mt-2 block text-xs opacity-75">
                                {`${block.people.length} people / ${block.songs.length} songs / ${block.details.length} details`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {(activeServiceStep === "flow" ? [effectiveActiveServiceBlock].filter(Boolean) : selectedServiceBlocks).map((block) => {
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
                              {getBlockLabel(block)}
                            </h3>
                          </div>
                          <div className="rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 font-[var(--font-plex-mono)] text-xs text-[var(--color-text-secondary)]">
                            {block.people.length} people - {block.songs.length} songs - {block.details.length} details
                          </div>
                        </div>

                        <ProgrammableBlockFields
                          key={`${block.id}-${JSON.stringify(block.fieldValues)}`}
                          block={block}
                          saving={saveBlockValuesMutation.isPending}
                          onSave={(values) => selectedService && saveBlockValuesMutation.mutate({ serviceId: selectedService.id, blockId: block.id, values })}
                        />

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
        </div>
      ) : null}

      <div className={`${module === "services" ? "hidden" : "flex"} w-full flex-1 flex-col gap-4`}>
        {module === "songs" ? (
          <div className="space-y-5">
            <>
                {activeSongStep === "upload" ? (
                  <section className="space-y-6 py-1 lg:px-2">
                    <div className="ui-page-header flex items-start justify-between gap-4">
                      <div className="max-w-3xl">
                        <h1 className="text-3xl font-semibold leading-10 text-[var(--text-primary)]">
                          Song Formatter
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                          Upload a PDF or DOCX, review the structure, then export a church-ready song file.
                        </p>
                      </div>
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            aria-label="Supported output formats"
                            title="Supported output formats"
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-[var(--text-accent)] shadow-none hover:text-[var(--action-primary-bg-hover)]"
                          >
                            <Info className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            aria-label="Supported output"
                            align="end"
                            sideOffset={8}
                            className="workspace-content-light z-50 w-72 rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-4 shadow-[var(--elevation-raised)]"
                          >
                            <h2 className="font-[var(--font-mono)] text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">
                              Supported output
                            </h2>
                            <ul className="mt-3 space-y-2 text-sm font-semibold text-[var(--text-secondary)]">
                              {["Planning Center XML", "ProPresenter 7 Slides", "Standard PDF Chords", "Markdown Text"].map((output) => (
                                <li key={output} className="flex items-center gap-3">
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-accent)]" aria-hidden="true" />
                                  {output}
                                </li>
                              ))}
                            </ul>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>

                    <div className="mx-auto max-w-6xl">
                      <label className="group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-6 py-8 text-center shadow-[var(--elevation-subtle)] transition hover:border-[var(--border-focus)] hover:bg-[var(--surface-panel-strong)] focus-within:border-[var(--border-focus)] focus-within:ring-2 focus-within:ring-[var(--border-focus)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--surface-panel)]">
                          <>
                            <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-panel-strong)] text-[var(--text-accent)] transition group-hover:scale-105">
                              <CloudUpload className="h-10 w-10" />
                            </span>
                            <span className="text-xl font-semibold text-[var(--text-primary)] md:text-2xl">
                              Choose or drop a song file
                            </span>
                            <span className="mt-2 text-base font-semibold text-[var(--text-secondary)]">
                              PDF or DOCX up to 15MB
                            </span>
                            {!extractorFileLabel ? (
                              <span className="ui-btn-primary mt-6 inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold">
                                <Upload className="h-4 w-4" aria-hidden="true" />
                                Choose PDF or DOCX
                              </span>
                            ) : null}
                            {extractorFileLabel ? (
                              <span className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[var(--border-focus)] bg-[var(--surface-panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]">
                                <FileText className="h-4 w-4 text-[var(--text-accent)]" />
                                {extractorFileLabel}
                              </span>
                            ) : null}
                          </>
                        <input
                          ref={extractorFileInputRef}
                          name="file"
                          type="file"
                          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf"
                          className="sr-only"
                          onClick={() => {
                            setExtractorAiRetry(null);
                            setExtractorStatus(null);
                          }}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              setExtractorSelectedFile(null);
                              setExtractorFileLabel(null);
                              setExtractorStatus("No file selected.");
                              setExtractorAiRetry(null);
                              setExtractorWarningCodes([]);
                              setExtractorWarningsDismissed(false);
                              return;
                            }

                            setFeedback(null);
                            setExtractorAiRetry(null);
                            setExtractorWarningCodes([]);
                            setExtractorWarningsDismissed(false);
                            setExtractorSelectedFile(file);
                            setExtractorFileLabel(`${file.name} - ${Math.ceil(file.size / 1024)} KB`);
                            setExtractorSongTitle(getFileNameWithoutExtension(file.name));
                            setExtractorStatus("File selected. Choose a processing mode.");
                            showToast(`${file.name} selected.`);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>

                      <AnimatePresence>
                        {extractorSelectedFile ? (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                            className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
                          >
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
                              className="pressable min-w-48 rounded-xl border border-[var(--border-default)] bg-transparent px-10 py-4 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-panel-alt)] disabled:opacity-60"
                            >
                              Process with AI
                            </button>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                      {extractorStatus || isFormatterProcessing ? (
                        <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
                          {isFormatterProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-accent)]" />
                          ) : null}
                          {extractorStatus ?? "Processing lyrics..."}
                        </div>
                      ) : null}
                    </div>

                    <div className="mx-auto max-w-6xl">
                      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-6 shadow-[var(--elevation-subtle)]">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <History className="h-5 w-5 text-[var(--text-accent)]" />
                            <h3 className="font-[var(--font-mono)] text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">
                              Recent Conversions
                            </h3>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          {recovery.error ? <p role="alert" className="text-sm text-[var(--state-danger)]">{recovery.error} <button className="underline" onClick={() => void recovery.refresh()}>Retry</button></p> : null}
                          {recovery.checking && recovery.history.length === 0 ? (
                            <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
                              <span className="sr-only">Loading recent conversions</span>
                              {[0, 1, 2].map((row) => (
                                <div key={row} className="flex items-center justify-between rounded-lg p-3">
                                  <div className="flex min-w-0 flex-1 items-center gap-4">
                                    <span className="h-10 w-10 shrink-0 animate-pulse rounded bg-[var(--surface-panel-strong)]" />
                                    <span className="min-w-0 flex-1 space-y-2">
                                      <span className="block h-4 w-40 max-w-full animate-pulse rounded bg-[var(--surface-panel-strong)]" />
                                      <span className="block h-3 w-56 max-w-full animate-pulse rounded bg-[var(--surface-panel-strong)]" />
                                    </span>
                                  </div>
                                  <span className="ml-4 h-4 w-16 shrink-0 animate-pulse rounded bg-[var(--surface-panel-strong)]" />
                                </div>
                              ))}
                            </div>
                          ) : recovery.history.length > 0 ? (
                            recovery.history.map((job) => {
                              const remaining = job.expiresAt ? Math.max(0, Math.ceil((Date.parse(job.expiresAt) - recovery.now) / 60000)) : null;
                              const resumable = job.status === "Draft" && (remaining === null || remaining > 0);
                              const displayStatus = job.status === "Draft" && !resumable ? "Done" : job.status;
                              const songName = job.songTitle || job.sourceName;
                              const editorName = job.lastTouchedBy?.displayName ?? "Unknown user";
                              const lastTouchedAge = formatLastTouchedAge(job.lastTouchedAt, recovery.now);

                              return (
                                <div key={job.id} className="group flex items-center justify-between rounded-lg p-3 transition hover:bg-[var(--surface-panel-strong)]">
                                  <div className="flex items-center gap-4">
                                    <span className="flex h-10 w-10 items-center justify-center rounded bg-[var(--surface-panel-strong)] text-[var(--text-secondary)]">
                                      <FileText className="h-5 w-5" />
                                    </span>
                                    <div>
                                      <p className="text-sm font-bold text-[var(--text-primary)]">
                                        {songName}
                                      </p>
                                      <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">
                                        Last touched by {editorName} · {lastTouchedAge}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-xs font-semibold text-[var(--text-secondary)]">{displayStatus}</span>
                                    {resumable ? (
                                      <Link
                                        href={workspaceFormatterPath("format")}
                                        aria-label={`Resume ${songName}`}
                                        title="Resume editing"
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-accent)] hover:text-[var(--action-primary-bg-hover)]"
                                      >
                                        <Pencil className="h-4 w-4" aria-hidden="true" />
                                      </Link>
                                    ) : displayStatus === "Done" ? (
                                      <span aria-label={`${songName} is done`} title="Done" className="inline-flex h-10 w-10 items-center justify-center text-[var(--text-accent)]">
                                        <Check className="h-5 w-5" aria-hidden="true" />
                                      </span>
                                    ) : (
                                      <span aria-label={`${songName} failed`} title="Failed" className="inline-flex h-10 w-10 items-center justify-center text-[var(--state-danger)]">
                                        <X className="h-5 w-5" aria-hidden="true" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--surface-panel-alt)] p-4 text-sm text-[var(--text-secondary)]">
                              {recovery.checking ? "Loading recent conversions…" : "No conversions yet."}
                            </div>
                          )}
                        </div>
                      </section>
                    </div>
                  </section>
                ) : null}

                {activeSongStep === "format" ? (
                  extractorDraftText || formatterDraftOpened || recovery.conversionId ? (
                    <>
                    {recovery.canTakeOver ? <div role="status" className="mb-3 flex items-center justify-between gap-3 text-sm"><span>{recovery.status}</span><button className="ui-btn-secondary px-3" onClick={() => void recovery.takeover()}>Take over editing</button></div> : null}
                    <SongDocumentEditor
                      key={recovery.conversionId ?? "local-formatter-draft"}
                      text={extractorDraftText}
                      songTitle={extractorSongTitle}
                      tags={songTags}
                      recoveryStatus={recovery.status}
                      readOnly={recovery.readOnly}
                      warnings={normalizedExtractorWarnings}
                      warningsDismissed={extractorWarningsDismissed}
                      onChange={text => { setFormatterDraftOpened(true); setExtractorDraftText(text); }}
                      onTitleChange={setExtractorSongTitle}
                      onDismissWarnings={() => setExtractorWarningsDismissed(true)}
                      settingsHref={`${workspaceRoutePrefix}/settings?tab=tags`}
                      exportPending={generateLyricsDocxMutation.isPending}
                      aiPending={aiExtractorRetryMutation.isPending || aiLyricsReformatMutation.isPending || recovery.busy}
                      aiUsed={!extractorAiRetry && directAiReformatUsed}
                      onExport={() => generateLyricsDocxMutation.mutate({
                        serviceId: selectedService?.id,
                        text: extractorDraftText,
                        songTitle: extractorSongTitle || undefined,
                      })}
                      onReformat={() => {
                        if (extractorAiRetry) {
                          aiExtractorRetryMutation.mutate({ serviceId: selectedService?.id, retryToken: extractorAiRetry.retryToken, conversionId: recovery.conversionId });
                        } else if (!directAiReformatUsed) {
                          aiLyricsReformatMutation.mutate({
                            serviceId: selectedService?.id,
                            text: extractorDraftText,
                            songTitle: extractorSongTitle || undefined,
                            conversionId: recovery.conversionId,
                          });
                        }
                      }}
                      onClear={async () => {
                        if (!await recovery.clear()) return;
                        setFormatterDraftOpened(false);
                        setExtractorDraftText("");
                        setExtractorSongTitle("");
                        setExtractorAiRetry(null);
                        setExtractorWarningCodes([]);
                        setExtractorWarningsDismissed(false);
                        setDirectAiReformatUsed(false);
                        router.push(workspaceFormatterPath("upload"));
                      }}
                    />
                    </>
                  ) : (
                    <section className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-panel)] p-8 text-center shadow-[var(--elevation-subtle)]">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{recovery.checking ? "Recovering your draft…" : recovery.error ?? "No extracted draft yet"}</p>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">
                        Start on Upload or paste lyrics, then the processed draft will open here.
                      </p>
                      <Link
                        href={workspaceFormatterPath("upload")}
                        className="ui-btn-primary pressable mt-4 inline-flex items-center justify-center px-4 py-3 text-sm font-semibold"
                      >
                        Go to Upload
                      </Link>
                    </section>
                  )
                ) : null}

            </>
          </div>
        ) : null}

        {module === MEDIA_TOOLS_MODULE ? (
          <div className="space-y-5">
            <div className="space-y-4 py-1">
              <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold leading-10 text-[var(--text-primary)]">
                {mediaHeaderCopy.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                {mediaHeaderCopy.description}
              </p>
              </div>
              {mediaTool ? (
                <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden" aria-label="Media tools">
                  <Link
                    href={workspaceMediaToolsPath()}
                    className="pressable inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-sm font-semibold text-[var(--text-secondary)]"
                  >
                    All tools
                  </Link>
                  {mediaToolNav.map((tool) => (
                    <Link
                      key={tool.id}
                      href={workspaceMediaToolsPath(tool.id)}
                      aria-current={mediaTool === tool.id ? "page" : undefined}
                      className={`pressable inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-control)] border px-3 text-sm font-semibold ${
                        mediaTool === tool.id
                          ? "border-[var(--border-focus)] bg-[var(--surface-panel-strong)] text-[var(--text-accent)]"
                          : "border-[var(--border-default)] bg-[var(--surface-panel-alt)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {tool.label}
                    </Link>
                  ))}
                </nav>
              ) : null}
            </div>

            {!mediaTool ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {MEDIA_TOOLS.map((tool) => {
                  const ToolIcon = tool.icon;
                  return (
                    <Link
                      key={tool.id}
                      href={workspaceMediaToolsPath(tool.id)}
                      className="group pressable flex min-h-32 flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-panel)] p-4 text-center shadow-[var(--elevation-subtle)] hover:bg-[var(--action-primary-bg)] hover:text-[var(--action-primary-ink)]"
                    >
                      <ToolIcon className="h-8 w-8 text-[var(--text-accent)] group-hover:text-[var(--action-primary-ink)]" strokeWidth={1.75} aria-hidden="true" />
                      <span className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--action-primary-ink)]">{tool.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}

            {mediaTool === "phone-transfer" ? (
              <PAPDesktopClient embedded hideHeader />
            ) : null}

            {mediaTool === "qr-generator" ? (
              <QRGeneratorTool showToast={showToast} />
            ) : null}

            {mediaTool === "background-generator" ? (
              <BackgroundGeneratorTool showToast={showToast} />
            ) : null}

            {mediaTool === "resize-image" ? (
              <ResizeImageTool showToast={showToast} />
            ) : null}

            {mediaTool === "background-removal" ? (
              <BackgroundRemovalTool showToast={showToast} />
            ) : null}

          </div>
        ) : null}
        {module === "automation" ? (
          <section className="border-y border-[var(--border-default)] py-5 text-[var(--text-primary)]">
            <div className="mb-4">
              <p className="technical-label">LIVE CAPTIONS & OUTPUTS</p>
              <h2 className="mt-2 text-lg font-semibold">Output queue</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Persist job history and generated outputs while keeping the workflow simple.
              </p>
            </div>

            {selectedService ? (
              <>
                <form
                  className="space-y-3 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] p-4"
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
                  <ProductionSelect
                    ariaLabel="Automation job type"
                    name="jobType"
                    value={automationJobType}
                    onValueChange={setAutomationJobType}
                    options={Object.values(JobType)
                      .filter((jobType) => jobType !== JobType.TRANSPOSE)
                      .map((jobType) => ({ value: jobType, label: jobType }))}
                    triggerClassName="bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  />
                  <textarea
                    name="inputJson"
                    rows={4}
                    placeholder='Optional JSON input, e.g. {"resolution":"1080p"}'
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    type="submit"
                    disabled={createJobMutation.isPending}
                    className="pressable flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--action-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--action-primary-ink)] hover:bg-[var(--action-primary-bg-hover)] disabled:opacity-60"
                  >
                    <WandSparkles className="h-4 w-4" />
                    Queue job
                  </button>
                </form>

                <div className="mt-4 max-h-[420px] divide-y divide-[var(--border-default)] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border-default)]">
                  {selectedService.jobs.map((job) => (
                    <div
                      key={job.id}
                      className="bg-[var(--surface-panel)] p-4 hover:bg-[var(--surface-panel-alt)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{job.jobType}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {job.jobType === JobType.TRANSPOSE
                              ? "Secure lyrics extraction history."
                              : JOB_DESCRIPTIONS[job.jobType]}
                          </p>
                          {job.jobType === JobType.TRANSPOSE && getExtractorSummary(job.outputJson) ? (
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              {getExtractorSummary(job.outputJson)}
                            </p>
                          ) : null}
                        </div>
                        <span className="inline-flex items-center gap-2 font-[var(--font-plex-mono)] text-xs text-[var(--state-ready)]">
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
                              className="block rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-sm font-semibold text-[var(--text-accent)]"
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
              <p className="text-sm text-[var(--text-secondary)]">
                Select a service to queue automation work.
              </p>
            )}
          </section>
        ) : null}
      </div>
      </div>
      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </div>
  );
}


