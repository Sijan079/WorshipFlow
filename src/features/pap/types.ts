export const PAP_SESSION_TTL_MS = 5 * 60 * 1000;
export const PAP_CHUNK_SIZE = 64 * 1024;
export const PAP_INBOX_TTL_MS = 8 * 60 * 60 * 1000;

export type PAPSessionStatus = "waiting" | "connected" | "expired";
export type PAPPeerRole = "desktop" | "mobile";
export type PAPConnectionState =
  | "idle"
  | "connecting"
  | "waiting"
  | "connected"
  | "disconnected"
  | "expired"
  | "failed";

export type PAPSession = {
  id: string;
  pairingCode: string;
  createdAt: string;
  expiresAt: string;
  desktopPeerId: string;
  mobilePeerId?: string;
  desktopDeviceName: string;
  mobileDeviceName?: string;
  status: PAPSessionStatus;
};

export type PAPTransferFile = {
  id: string;
  batchId: string;
  batchCreatedAt: string;
  batchIndex: number;
  batchTotal: number;
  fileName: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  transferredAt: string;
  temporary: true;
  dimensions?: {
    width: number;
    height: number;
  };
  blob: Blob;
};

export type PAPFileMeta = {
  transferId: string;
  batchId: string;
  batchCreatedAt: string;
  batchIndex: number;
  batchTotal: number;
  fileName: string;
  mimeType: string;
  size: number;
  chunkCount: number;
};

export type PAPSignalPayload =
  | { type: "offer"; description: RTCSessionDescriptionInit }
  | { type: "answer"; description: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit };

export type PAPClientMessage =
  | {
      type: "create-session";
      peerId: string;
      deviceName: string;
    }
  | {
      type: "join-session";
      pairingCode: string;
      peerId: string;
      deviceName: string;
    }
  | {
      type: "signal";
      sessionId: string;
      fromPeerId: string;
      payload: PAPSignalPayload;
    }
  | {
      type: "leave-session";
      sessionId: string;
      peerId: string;
    };

export type PAPServerMessage =
  | {
      type: "session-created";
      session: PAPSession;
    }
  | {
      type: "session-joined";
      session: PAPSession;
    }
  | {
      type: "peer-joined";
      session: PAPSession;
      peerId: string;
      deviceName: string;
    }
  | {
      type: "peer-left";
      sessionId: string;
      peerId: string;
    }
  | {
      type: "session-expired";
      sessionId: string;
    }
  | {
      type: "signal";
      sessionId: string;
      fromPeerId: string;
      payload: PAPSignalPayload;
    }
  | {
      type: "error";
      message: string;
    };

export type PAPDataChannelMessage =
  | {
      type: "file-start";
      meta: PAPFileMeta;
    }
  | {
      type: "file-end";
      transferId: string;
    }
  | {
      type: "file-error";
      transferId: string;
      message: string;
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
