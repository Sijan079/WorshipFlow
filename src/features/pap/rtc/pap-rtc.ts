import {
  PAP_CHUNK_SIZE,
  type PAPDataChannelMessage,
  type PAPFileMeta,
  type PAPSendProgress,
  type PAPTransferFile,
} from "../types";
import { createPAPBatchFileName } from "./pap-file-names";

export const PAP_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

function getConfiguredTURNServer(): RTCIceServer | null {
  const urls = process.env.NEXT_PUBLIC_PAP_TURN_URLS;
  if (!urls) return null;

  const turnUrls = urls
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (turnUrls.length === 0) return null;

  return {
    urls: turnUrls,
    username: process.env.NEXT_PUBLIC_PAP_TURN_USERNAME,
    credential: process.env.NEXT_PUBLIC_PAP_TURN_CREDENTIAL,
  };
}

export function getPAPICEServers() {
  const turnServer = getConfiguredTURNServer();
  return turnServer ? [...PAP_ICE_SERVERS, turnServer] : PAP_ICE_SERVERS;
}

export function createPAPPeerConnection() {
  return new RTCPeerConnection({ iceServers: getPAPICEServers() });
}

export function parsePAPDataChannelMessage(data: unknown): PAPDataChannelMessage | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data) as PAPDataChannelMessage;
    if (parsed.type === "file-start" || parsed.type === "file-end" || parsed.type === "file-error") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function readImageDimensions(url: string) {
  return new Promise<{ width: number; height: number } | undefined>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(undefined);
    image.src = url;
  });
}

export async function createTransferFile(params: {
  meta: PAPFileMeta;
  chunks: BlobPart[];
}): Promise<PAPTransferFile> {
  const blob = new Blob(params.chunks, { type: params.meta.mimeType });
  if (blob.size !== params.meta.size) {
    throw new Error("Received file size did not match transfer metadata.");
  }

  const previewUrl = URL.createObjectURL(blob);
  const dimensions = params.meta.mimeType.startsWith("image/") ? await readImageDimensions(previewUrl) : undefined;

  return {
    id: params.meta.transferId,
    batchId: params.meta.batchId,
    batchCreatedAt: params.meta.batchCreatedAt,
    batchIndex: params.meta.batchIndex,
    batchTotal: params.meta.batchTotal,
    fileName: params.meta.fileName,
    mimeType: params.meta.mimeType,
    size: params.meta.size,
    previewUrl,
    transferredAt: new Date().toISOString(),
    temporary: true,
    dimensions,
    blob,
  };
}

export async function sendPAPFiles(params: {
  channel: RTCDataChannel;
  files: File[];
  onProgress?: (progress: PAPSendProgress) => void;
}) {
  const batchCreatedAt = new Date();
  const batchId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  for (const [index, file] of params.files.entries()) {
    const transferId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const batchIndex = index + 1;
    const fileName = createPAPBatchFileName({ file, batchCreatedAt, batchIndex });
    const meta: PAPFileMeta = {
      transferId,
      batchId,
      batchCreatedAt: batchCreatedAt.toISOString(),
      batchIndex,
      batchTotal: params.files.length,
      fileName,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      chunkCount: Math.ceil(file.size / PAP_CHUNK_SIZE),
    };

    params.channel.send(JSON.stringify({ type: "file-start", meta } satisfies PAPDataChannelMessage));

    let offset = 0;
    while (offset < file.size) {
      const nextOffset = Math.min(offset + PAP_CHUNK_SIZE, file.size);
      const chunk = await file.slice(offset, nextOffset).arrayBuffer();
      await waitForBufferedAmount(params.channel);
      params.channel.send(chunk);
      offset = nextOffset;
      params.onProgress?.({
        transferId,
        batchId,
        batchIndex,
        batchTotal: params.files.length,
        fileName,
        sentBytes: offset,
        totalBytes: file.size,
        done: false,
      });
    }

    params.channel.send(JSON.stringify({ type: "file-end", transferId } satisfies PAPDataChannelMessage));
    params.onProgress?.({
      transferId,
      batchId,
      batchIndex,
      batchTotal: params.files.length,
      fileName,
      sentBytes: file.size,
      totalBytes: file.size,
      done: true,
    });
  }
}

function waitForBufferedAmount(channel: RTCDataChannel) {
  if (channel.bufferedAmount <= PAP_CHUNK_SIZE * 8) return;
  return new Promise<void>((resolve) => {
    const handleLow = () => {
      channel.removeEventListener("bufferedamountlow", handleLow);
      resolve();
    };
    channel.bufferedAmountLowThreshold = PAP_CHUNK_SIZE * 4;
    channel.addEventListener("bufferedamountlow", handleLow);
  });
}
