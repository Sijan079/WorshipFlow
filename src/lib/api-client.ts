import type { ServiceDetailPayload, ServiceListPayload, SongRepositoryItem } from "@/lib/service-data";
import type { BlockPerson, JobStatus, JobType, OutputType, ServiceStatus, ServiceVariant, SongRole } from "@prisma/client";
import type {
  LyricsExtractorAiRetryDescriptor,
  LyricsExtractorDocxRequest,
  LyricsExtractorEditableResponse,
} from "@/lib/extractor-types";
import type {
  AssignedMinistry,
  PledgeType,
  ServiceHymnalRole,
  ServiceServantRole,
  ServiceTemplateType,
} from "@/lib/service-records";
import type { NullableServantGender, NullableServantGroup, ServantGender, ServantGroup } from "@/lib/servants";

export type { LyricsExtractorEditableResponse } from "@/lib/extractor-types";

const BASE_URL = typeof window !== "undefined"
  ? ""
  : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer Item>
    ? Serialized<Item>[]
    : T extends object
      ? { [Key in keyof T]: Serialized<T[Key]> }
      : T;

function buildUrl(path: string) {
  return `${BASE_URL}${path}`;
}

function buildHeaders(options?: RequestInit) {
  const headers = { ...(options?.headers || {}) } as Record<string, string>;

  // If it's a FormData body, let the browser set the Content-Type automatically (including boundary)
  if (!(options?.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function fetchOrThrow(path: string, options?: RequestInit) {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: buildHeaders(options),
  });

  if (response.ok) {
    return response;
  }

  const errorData = await response.json().catch(() => ({}));
  throw new ApiError(errorData.error || `Request failed with status ${response.status}`, response.status);
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetchOrThrow(path, options);
  return response.json() as Promise<T>;
}

async function postExtractorRequest(path: string, body: BodyInit | Record<string, unknown>) {
  const isBinaryBody = body instanceof FormData;
  const response = await fetchOrThrow(path, {
    method: "POST",
    body: isBinaryBody ? body : JSON.stringify(body),
    headers: isBinaryBody ? undefined : { "Content-Type": "application/json" },
  });

  return response as Response & { ok: true };
}

async function downloadBinaryResponse(path: string, options?: RequestInit) {
  const response = await fetchOrThrow(path, options);
  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") ?? "";
  const fileNameMatch = /filename="([^"]+)"/i.exec(contentDisposition);

  return {
    blob,
    fileName: fileNameMatch?.[1] ?? "download.bin",
  };
}

async function executeExtractorRequest(path: string, body: BodyInit | Record<string, unknown>) {
  const response = await postExtractorRequest(path, body);
  return response.json() as Promise<LyricsExtractorEditableResponse>;
}

export async function runUploadLyricsExtractor(params: {
  serviceId?: string;
  file: File;
  songTitle?: string;
}) {
  const formData = new FormData();
  formData.append("file", params.file);
  if (params.songTitle?.trim()) {
    formData.append("songTitle", params.songTitle.trim());
  }

  const path = params.serviceId ? `/api/services/${params.serviceId}/extractor` : "/api/extractor";
  return executeExtractorRequest(path, formData);
}

export async function runAiLyricsExtractorRetry(params: {
  serviceId?: string;
  retryToken: LyricsExtractorAiRetryDescriptor["retryToken"];
}) {
  const path = params.serviceId ? `/api/services/${params.serviceId}/extractor/ai` : "/api/extractor/ai";
  return executeExtractorRequest(path, { retryToken: params.retryToken });
}

export async function runAiLyricsReformat(params: {
  serviceId?: string;
  text: string;
  songTitle?: string;
}) {
  const path = params.serviceId ? `/api/services/${params.serviceId}/extractor/ai` : "/api/extractor/ai";
  return executeExtractorRequest(path, {
    text: params.text,
    songTitle: params.songTitle?.trim() || undefined,
  });
}

export async function generateLyricsDocx(params: {
  serviceId?: string;
  songTitle?: string;
  text: string;
}) {
  const path = params.serviceId ? `/api/services/${params.serviceId}/extractor/docx` : "/api/extractor/docx";
  return downloadBinaryResponse(path, {
    method: "POST",
    body: JSON.stringify({
      songTitle: params.songTitle?.trim() || undefined,
      text: params.text,
    } satisfies LyricsExtractorDocxRequest),
    headers: { "Content-Type": "application/json" },
  });
}

export function triggerBrowserDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export type ServiceRecord = Serialized<ServiceListPayload>;
export type SongRecord = Serialized<SongRepositoryItem>;

export type SongTagPresetRecord = {
  id: string;
  label: string;
  token: string;
  color: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServantRecord = {
  id: string;
  workspaceId: string;
  name: string;
  gender: NullableServantGender;
  group: NullableServantGroup;
  groupCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateServantPayload = {
  name: string;
  gender?: ServantGender | null;
  group?: ServantGroup | null;
  groupCode?: string | null;
};

export type UpdateServantPayload = Partial<CreateServantPayload>;

export type CreateSongTagPresetPayload = {
  label: string;
  token: string;
  color: string;
};

export type UpdateSongTagPresetPayload = Partial<CreateSongTagPresetPayload>;

export type CreateServicePayload = {
  serviceDate: string;
  assignedMinistry?: AssignedMinistry;
  ministryPresetCode?: string | null;
  sermonVerse?: string;
  status?: ServiceStatus;
  templateType?: ServiceTemplateType;
  templatePresetCode?: string | null;
  pledgeType?: PledgeType | null;
  bibleVerses?: Array<{
    verse: string;
    order: number;
  }>;
  servantAssignments?: Array<{
    role: ServiceServantRole;
    personName: string;
  }>;
  hymnals?: Array<{
    role: ServiceHymnalRole;
    title: string;
  }>;
  ministryName?: string;
  theme?: string | null;
  serviceVariant?: ServiceVariant;
};

export type UpdateServicePayload = Partial<CreateServicePayload>;

export type EditableSettingsPresetRecord = {
  id: string;
  workspaceId: string;
  label: string;
  code: string;
  active: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistPresetItemRecord = {
  id: string;
  checklistId: string;
  label: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistPresetRecord = {
  id: string;
  workspaceId: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: ChecklistPresetItemRecord[];
};

export type ServiceTemplatePresetRecord = EditableSettingsPresetRecord & {
  templateType: ServiceTemplateType;
  optionalBlocks: string[];
  blocks: Array<{
    label: string;
    code: string;
    blockType: string;
    order: number;
  }>;
};

export type CreateEditableSettingsPresetPayload = {
  label: string;
  code: string;
  active: boolean;
};

export type UpdateEditableSettingsPresetPayload = Partial<CreateEditableSettingsPresetPayload>;

export type ChecklistPresetItemPayload = {
  id?: string;
  label: string;
  active: boolean;
};

export type CreateChecklistPresetPayload = { name: string };
export type UpdateChecklistPresetPayload = {
  name: string;
  items: ChecklistPresetItemPayload[];
};
export type ActivateChecklistPresetPayload = { checklistId: string };

export type CreateServiceTemplatePresetPayload = CreateEditableSettingsPresetPayload & {
  templateType: ServiceTemplateType;
  optionalBlocks: string[];
  blocks: Array<{
    label: string;
    code?: string;
    blockType?: string;
    order?: number;
  }>;
};

export type UpdateServiceTemplatePresetPayload = Partial<CreateServiceTemplatePresetPayload>;

export type CreateParticipantPayload = {
  personName: string;
  personTitle?: string | null;
  order?: number;
};

export type UpdateParticipantPayload = Partial<CreateParticipantPayload>;

export type CreateServiceSongPayload = {
  songId: string;
  blockId: string;
  order?: number;
  songRole: SongRole;
  pageRef?: string | null;
};

export type CreateSongPayload = {
  title: string;
  author?: string | null;
  defaultKey?: string | null;
  bpm?: number | null;
  language?: string | null;
  isOriginal?: boolean;
};

export type UpsertServiceDetailPayload = {
  key: string;
  value: string;
  blockId?: string | null;
};

export type CreateAutomationJobPayload = {
  jobType: JobType;
  inputJson?: unknown;
};

export type AutomationJobRecord = {
  id: string;
  workspaceId: string;
  serviceId: string | null;
  jobType: JobType;
  status: JobStatus;
  inputJson: unknown;
  outputJson: unknown;
  createdAt: string;
  completedAt: string | null;
  outputs: GeneratedOutputRecord[];
};

export type GeneratedOutputRecord = {
  id: string;
  workspaceId: string;
  serviceId: string | null;
  jobId: string | null;
  type: OutputType;
  filePath: string;
  createdAt: string;
};

export type BackgroundGenerationRequestPayload = {
  mediaType: "image";
  purpose: "lyrics" | "sermon" | "scripture" | "offering" | "announcements" | "general-worship";
  mood: "reverent" | "joyful" | "reflective" | "hopeful" | "quiet" | "celebration";
  visualStyle:
    | "abstract-light"
    | "soft-landscape"
    | "stained-glass"
    | "minimal-texture"
    | "warm-stage-wash"
    | "atmospheric-clouds";
  textSafeArea: "center-clear" | "lower-third-clear" | "full-frame";
  promptDetails?: string;
};

export type BackgroundGenerationEstimateRecord = {
  provider: "openai";
  model: string;
  mediaType: "image";
  format: "presentation-16:9";
  providerResolution: string;
  durationSeconds: number | null;
  videoQuality: "480p" | null;
  seamlessLoop: boolean;
  estimatedInputTokens: number | null;
  estimatedOutputTokens: number | null;
  estimatedCostUsd: number;
  pricingSnapshot: string;
  freeTierNote: string;
};

export type BackgroundGenerationEstimateResponse = {
  request: BackgroundGenerationRequestPayload & {
    format: "presentation-16:9";
    providerResolution: string;
  };
  estimate: BackgroundGenerationEstimateRecord;
};

export type BackgroundGenerationOutputRecord = GeneratedOutputRecord & {
  job: AutomationJobRecord | null;
};

export function estimateBackgroundGeneration(payload: BackgroundGenerationRequestPayload) {
  return apiFetch<BackgroundGenerationEstimateResponse>("/api/media/backgrounds/estimate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function generateBackground(payload: {
  request: BackgroundGenerationRequestPayload;
  acceptedEstimate: BackgroundGenerationEstimateRecord;
}) {
  return apiFetch<{ job: AutomationJobRecord; output: GeneratedOutputRecord }>("/api/media/backgrounds/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchGeneratedBackgrounds() {
  return apiFetch<BackgroundGenerationOutputRecord[]>("/api/media/backgrounds");
}

export async function downloadGeneratedBackground(outputId: string) {
  return downloadBinaryResponse(`/api/media/backgrounds/${outputId}/download`);
}

export function getGeneratedBackgroundPreviewUrl(outputId: string) {
  return `/api/media/backgrounds/${encodeURIComponent(outputId)}/download?disposition=inline`;
}

export type ServiceDetailRecord = Serialized<ServiceDetailPayload>;
export type ParticipantRecord = BlockPerson;
