import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import type {
  ExtractorConfidenceLevel,
  ExtractorWarningCode,
  TemporaryAutomationBatchDescriptor,
  TemporaryAutomationFileDescriptor,
} from "@/lib/extractor-types";

type TempBatchFile = TemporaryAutomationFileDescriptor & {
  path: string;
};

type TempBatch = {
  id: string;
  serviceId: string;
  dir: string;
  files: TempBatchFile[];
  createdAt: number;
  expiresAt: number;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

type TempDownload = {
  serviceId: string;
  jobId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  expiresAt: number;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

type TempAiReview = {
  token: string;
  serviceId: string;
  parser: "docx" | "pdf" | "txt" | "paste";
  confidence: ExtractorConfidenceLevel;
  warningCodes: ExtractorWarningCode[];
  extractedText: string;
  songTitle?: string;
  createdAt: number;
  expiresAt: number;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

const BATCH_TTL_MS = 10 * 60 * 1000;
const DOWNLOAD_TTL_MS = 5 * 60 * 1000;
const AI_REVIEW_TTL_MS = 10 * 60 * 1000;
const TEMP_ROOT_DIR = join(tmpdir(), "worship-flow-os");
const BATCHES_DIR = join(TEMP_ROOT_DIR, "automation-batches");
const DOWNLOADS_DIR = join(TEMP_ROOT_DIR, "automation-downloads");
const AI_REVIEWS_DIR = join(TEMP_ROOT_DIR, "extractor-ai-reviews");

const batches = new Map<string, TempBatch>();
const downloads = new Map<string, TempDownload>();
const aiReviews = new Map<string, TempAiReview>();

function getBatchDir(batchId: string) {
  return join(BATCHES_DIR, batchId);
}

function getBatchManifestPath(batchId: string) {
  return join(getBatchDir(batchId), "manifest.json");
}

function getDownloadDir(jobId: string) {
  return join(DOWNLOADS_DIR, jobId);
}

function getDownloadManifestPath(jobId: string) {
  return join(getDownloadDir(jobId), "manifest.json");
}

function getDownloadBytesPath(jobId: string) {
  return join(getDownloadDir(jobId), "payload.bin");
}

function getAiReviewDir(token: string) {
  return join(AI_REVIEWS_DIR, token);
}

function getAiReviewManifestPath(token: string) {
  return join(getAiReviewDir(token), "manifest.json");
}

function toBatchDescriptor(batch: TempBatch): TemporaryAutomationBatchDescriptor {
  return {
    id: batch.id,
    serviceId: batch.serviceId,
    createdAt: new Date(batch.createdAt).toISOString(),
    expiresAt: new Date(batch.expiresAt).toISOString(),
    files: batch.files.map(({ id, mimeType, size }) => ({ id, mimeType, size })),
  };
}

async function ensureTempDirectories() {
  await mkdir(BATCHES_DIR, { recursive: true });
  await mkdir(DOWNLOADS_DIR, { recursive: true });
  await mkdir(AI_REVIEWS_DIR, { recursive: true });
}

async function writeBatchManifest(batch: TempBatch) {
  await writeFile(
    getBatchManifestPath(batch.id),
    JSON.stringify({
      id: batch.id,
      serviceId: batch.serviceId,
      dir: batch.dir,
      createdAt: batch.createdAt,
      expiresAt: batch.expiresAt,
      files: batch.files.map(({ id, mimeType, size, path }) => ({
        id,
        mimeType,
        size,
        path,
      })),
    })
  );
}

async function clearBatch(batch: TempBatch) {
  if (batch.cleanupTimer) {
    clearTimeout(batch.cleanupTimer);
  }

  batches.delete(batch.id);
  await rm(batch.dir, { recursive: true, force: true });
}

function scheduleBatchCleanup(batch: TempBatch) {
  batch.cleanupTimer = setTimeout(() => {
    void clearBatch(batch);
  }, Math.max(0, batch.expiresAt - Date.now()));
}

async function resolveBatch(batchId: string) {
  const existing = batches.get(batchId);
  if (existing) {
    return existing;
  }

  try {
    const manifestBytes = await readFile(getBatchManifestPath(batchId), "utf8");
    const parsed = JSON.parse(manifestBytes) as {
      id: string;
      serviceId: string;
      dir: string;
      createdAt: number;
      expiresAt: number;
      files: TempBatchFile[];
    };

    const batch: TempBatch = {
      id: parsed.id,
      serviceId: parsed.serviceId,
      dir: parsed.dir,
      files: parsed.files,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
    };

    if (batch.expiresAt <= Date.now()) {
      await clearBatch(batch);
      return null;
    }

    batches.set(batch.id, batch);
    scheduleBatchCleanup(batch);
    return batch;
  } catch {
    return null;
  }
}

async function clearDownload(jobId: string) {
  const entry = downloads.get(jobId);
  if (entry?.cleanupTimer) {
    clearTimeout(entry.cleanupTimer);
  }

  downloads.delete(jobId);
  await rm(getDownloadDir(jobId), { recursive: true, force: true });
}

function scheduleDownloadCleanup(jobId: string, expiresAt: number) {
  const entry = downloads.get(jobId);
  if (!entry) {
    return;
  }

  entry.cleanupTimer = setTimeout(() => {
    void clearDownload(jobId);
  }, Math.max(0, expiresAt - Date.now()));
}

async function clearAiReview(token: string) {
  const entry = aiReviews.get(token);
  if (entry?.cleanupTimer) {
    clearTimeout(entry.cleanupTimer);
  }
  aiReviews.delete(token);
  await rm(getAiReviewDir(token), { recursive: true, force: true });
}

function scheduleAiReviewCleanup(token: string, expiresAt: number) {
  const entry = aiReviews.get(token);
  if (!entry) {
    return;
  }

  entry.cleanupTimer = setTimeout(() => {
    void clearAiReview(token);
  }, Math.max(0, expiresAt - Date.now()));
}

async function writeAiReviewManifest(entry: TempAiReview) {
  await writeFile(
    getAiReviewManifestPath(entry.token),
    JSON.stringify({
      token: entry.token,
      serviceId: entry.serviceId,
      parser: entry.parser,
      confidence: entry.confidence,
      warningCodes: entry.warningCodes,
      extractedText: entry.extractedText,
      songTitle: entry.songTitle ?? null,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
    })
  );
}

async function resolveAiReview(token: string) {
  const existing = aiReviews.get(token);
  if (existing) {
    return existing;
  }

  try {
    const manifestText = await readFile(getAiReviewManifestPath(token), "utf8");
    const parsed = JSON.parse(manifestText) as TempAiReview;
    if (parsed.expiresAt <= Date.now()) {
      await clearAiReview(token);
      return null;
    }

    const entry: TempAiReview = {
      ...parsed,
      songTitle: parsed.songTitle ?? undefined,
    };

    aiReviews.set(token, entry);
    scheduleAiReviewCleanup(token, entry.expiresAt);
    return entry;
  } catch {
    return null;
  }
}

async function writeDownloadManifest(entry: TempDownload) {
  await writeFile(
    getDownloadManifestPath(entry.jobId),
    JSON.stringify({
      serviceId: entry.serviceId,
      jobId: entry.jobId,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      expiresAt: entry.expiresAt,
    })
  );
}

async function resolveDownload(jobId: string) {
  const existing = downloads.get(jobId);
  if (existing) {
    return existing;
  }

  try {
    const manifestText = await readFile(getDownloadManifestPath(jobId), "utf8");
    const parsed = JSON.parse(manifestText) as {
      serviceId: string;
      jobId: string;
      fileName: string;
      mimeType: string;
      expiresAt: number;
    };

    if (parsed.expiresAt <= Date.now()) {
      await clearDownload(jobId);
      return null;
    }

    const bytes = new Uint8Array(await readFile(getDownloadBytesPath(jobId)));
    const entry: TempDownload = {
      serviceId: parsed.serviceId,
      jobId: parsed.jobId,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
      bytes,
      expiresAt: parsed.expiresAt,
    };

    downloads.set(jobId, entry);
    scheduleDownloadCleanup(jobId, entry.expiresAt);
    return entry;
  } catch {
    return null;
  }
}

export async function createTemporaryAutomationBatch(
  serviceId: string,
  files: File[]
): Promise<TemporaryAutomationBatchDescriptor> {
  await ensureTempDirectories();
  const id = randomUUID();
  const dir = getBatchDir(id);
  await mkdir(dir, { recursive: true });
  const createdAt = Date.now();
  const expiresAt = createdAt + BATCH_TTL_MS;

  const storedFiles: TempBatchFile[] = [];

  for (const file of files) {
    const fileId = randomUUID();
    const path = join(dir, `${fileId}.bin`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const lowerName = file.name.toLowerCase();
    const mimeType =
      file.type ||
      (lowerName.endsWith(".pdf")
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await writeFile(path, bytes);
    storedFiles.push({
      id: fileId,
      mimeType,
      size: file.size,
      path,
    });
  }

  const batch: TempBatch = {
    id,
    serviceId,
    dir,
    files: storedFiles,
    createdAt,
    expiresAt,
  };

  batches.set(id, batch);
  await writeBatchManifest(batch);
  scheduleBatchCleanup(batch);

  return toBatchDescriptor(batch);
}

export async function deleteTemporaryAutomationBatch(serviceId: string, batchId: string) {
  const batch = await resolveBatch(batchId);
  if (!batch || batch.serviceId !== serviceId) {
    return false;
  }

  await clearBatch(batch);
  return true;
}

export async function readTemporaryAutomationFile(serviceId: string, batchId: string) {
  const batch = await resolveBatch(batchId);
  if (!batch || batch.serviceId !== serviceId) {
    return null;
  }

  const file = batch.files[0];
  if (!file) {
    return null;
  }

  const bytes = await readFile(file.path);
  return {
    id: file.id,
    mimeType: file.mimeType,
    size: file.size,
    path: file.path,
    bytes: new Uint8Array(bytes),
  };
}

export async function consumeTemporaryAutomationBatch(serviceId: string, batchId: string) {
  const batch = await resolveBatch(batchId);
  if (!batch || batch.serviceId !== serviceId) {
    return false;
  }

  await clearBatch(batch);
  return true;
}

export async function storeTemporaryDownload(
  serviceId: string,
  jobId: string,
  fileName: string,
  mimeType: string,
  bytes: Uint8Array
) {
  await ensureTempDirectories();
  await clearDownload(jobId);

  const expiresAt = Date.now() + DOWNLOAD_TTL_MS;
  const entry: TempDownload = {
    serviceId,
    jobId,
    fileName,
    mimeType,
    bytes,
    expiresAt,
  };

  await mkdir(getDownloadDir(jobId), { recursive: true });
  await writeFile(getDownloadBytesPath(jobId), bytes);
  await writeDownloadManifest(entry);

  downloads.set(jobId, entry);
  scheduleDownloadCleanup(jobId, expiresAt);
}

export async function consumeTemporaryDownload(serviceId: string, jobId: string) {
  const entry = await resolveDownload(jobId);
  if (!entry || entry.serviceId !== serviceId) {
    return null;
  }

  await clearDownload(jobId);
  return {
    fileName: entry.fileName,
    mimeType: entry.mimeType,
    bytes: entry.bytes,
  };
}

export async function storeTemporaryAiReview(input: {
  serviceId: string;
  parser: "docx" | "pdf" | "txt" | "paste";
  confidence: ExtractorConfidenceLevel;
  warningCodes: ExtractorWarningCode[];
  extractedText: string;
  songTitle?: string;
}) {
  await ensureTempDirectories();
  const token = randomUUID();
  const createdAt = Date.now();
  const expiresAt = createdAt + AI_REVIEW_TTL_MS;

  const entry: TempAiReview = {
    token,
    serviceId: input.serviceId,
    parser: input.parser,
    confidence: input.confidence,
    warningCodes: input.warningCodes,
    extractedText: input.extractedText,
    songTitle: input.songTitle,
    createdAt,
    expiresAt,
  };

  await mkdir(getAiReviewDir(token), { recursive: true });
  await writeAiReviewManifest(entry);
  aiReviews.set(token, entry);
  scheduleAiReviewCleanup(token, expiresAt);

  return {
    retryToken: token,
    confidence: input.confidence,
    warningCodes: input.warningCodes,
    parser: input.parser,
  };
}

export async function consumeTemporaryAiReview(serviceId: string, token: string) {
  const entry = await resolveAiReview(token);
  if (!entry || entry.serviceId !== serviceId) {
    return null;
  }

  await clearAiReview(token);
  return {
    parser: entry.parser,
    confidence: entry.confidence,
    warningCodes: entry.warningCodes,
    extractedText: entry.extractedText,
    songTitle: entry.songTitle,
  };
}
