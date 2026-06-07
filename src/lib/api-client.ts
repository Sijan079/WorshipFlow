import type { ServiceDetailPayload, SongRepositoryItem } from "@/lib/service-data";
import type { BlockPerson, JobStatus, JobType, OutputType, ServiceStatus, ServiceVariant, SongRole, WorshipServiceDetail } from "@prisma/client";
import type {
  LyricsExtractorAiRetryDescriptor,
  LyricsExtractorDocxRequest,
  LyricsExtractorEditableResponse,
  LyricsExtractorJobInput,
} from "@/lib/extractor-types";

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

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers = { ...(options?.headers || {}) } as Record<string, string>;

  // If it's a FormData body, let the browser set the Content-Type automatically (including boundary)
  if (!(options?.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.error || `Request failed with status ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}

async function downloadBinaryResponse(path: string, options?: RequestInit) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.error || `Request failed with status ${response.status}`, response.status);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") ?? "";
  const fileNameMatch = /filename="([^"]+)"/i.exec(contentDisposition);

  return {
    blob,
    fileName: fileNameMatch?.[1] ?? "download.bin",
  };
}

async function executeExtractorRequest(path: string, options?: RequestInit): Promise<LyricsExtractorEditableResponse> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.error || `Request failed with status ${response.status}`, response.status);
  }

  return response.json() as Promise<LyricsExtractorEditableResponse>;
}

export async function runUploadLyricsExtractor(params: {
  serviceId: string;
  file: File;
  songTitle?: string;
}) {
  const formData = new FormData();
  formData.append("file", params.file);
  if (params.songTitle?.trim()) {
    formData.append("songTitle", params.songTitle.trim());
  }

  return executeExtractorRequest(`/api/services/${params.serviceId}/extractor`, {
    method: "POST",
    body: formData,
  });
}

export async function runPasteLyricsExtractor(params: {
  serviceId: string;
  songTitle?: string;
  pastedText: string;
}) {
  return executeExtractorRequest(`/api/services/${params.serviceId}/extractor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceMode: "paste",
      songTitle: params.songTitle?.trim() || undefined,
      pastedText: params.pastedText,
    } satisfies LyricsExtractorJobInput),
  });
}

export async function runAiLyricsExtractorRetry(params: {
  serviceId: string;
  retryToken: LyricsExtractorAiRetryDescriptor["retryToken"];
}) {
  return executeExtractorRequest(`/api/services/${params.serviceId}/extractor/ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ retryToken: params.retryToken }),
  });
}

export async function runAiLyricsReformat(params: {
  serviceId: string;
  text: string;
  songTitle?: string;
}) {
  return executeExtractorRequest(`/api/services/${params.serviceId}/extractor/ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: params.text,
      songTitle: params.songTitle?.trim() || undefined,
    }),
  });
}

export async function generateLyricsDocx(params: {
  serviceId: string;
  songTitle?: string;
  text: string;
}) {
  return downloadBinaryResponse(`/api/services/${params.serviceId}/extractor/docx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      songTitle: params.songTitle?.trim() || undefined,
      text: params.text,
    } satisfies LyricsExtractorDocxRequest),
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

export type ServiceRecord = Serialized<ServiceDetailPayload>;
export type SongRecord = Serialized<SongRepositoryItem>;

export type SongTagPresetRecord = {
  id: string;
  label: string;
  token: string;
  color: string;
  order: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateSongTagPresetPayload = {
  label: string;
  token: string;
  color: string;
  order: number;
};

export type UpdateSongTagPresetPayload = Partial<CreateSongTagPresetPayload>;

export type CreateServicePayload = {
  serviceDate: string;
  ministryName: string;
  theme?: string | null;
  status?: ServiceStatus;
  serviceVariant?: ServiceVariant;
};

export type UpdateServicePayload = Partial<CreateServicePayload>;

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
  serviceId: string;
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
  serviceId: string;
  jobId: string | null;
  type: OutputType;
  filePath: string;
  createdAt: string;
};

export type ServiceDetailRecord = WorshipServiceDetail;
export type ParticipantRecord = BlockPerson;
