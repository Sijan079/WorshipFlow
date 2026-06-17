export type PAPConnectionState = "connecting" | "connected" | "failed";

export type PAPServerScreenshot = {
  id: string;
  batchId: string;
  batchIndex: number;
  batchTotal: number;
  fileName: string;
  mimeType: string;
  size: number;
  note: string | null;
  deviceName: string | null;
  createdAt: string;
};

export type PAPSendProgress = {
  transferId: string;
  batchId: string;
  batchIndex: number;
  batchTotal: number;
  fileName: string;
  sentBytes: number;
  totalBytes: number;
  done: boolean;
};
