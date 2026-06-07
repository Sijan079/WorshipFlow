"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPAPPeerConnection, createTransferFile, parsePAPDataChannelMessage } from "../rtc/pap-rtc";
import {
  cachePAPInboxFile,
  clearPAPInboxCache,
  deletePAPInboxFile,
  loadPAPInboxFiles,
  updatePAPInboxFileName,
} from "../session/pap-inbox-cache";
import type { PAPConnectionState, PAPFileMeta, PAPServerMessage, PAPSession, PAPTransferFile } from "../types";
import {
  connectPAPSignaling,
  createPAPPeerId,
  getPAPDeviceName,
  getPAPJoinBaseUrl,
} from "../websocket/pap-signaling-client";

type IncomingTransfer = {
  meta: PAPFileMeta;
  chunks: BlobPart[];
  receivedBytes: number;
};

export function usePAPDesktopSession() {
  const [peerId] = useState(() => createPAPPeerId("desktop"));
  const [deviceName] = useState(() => getPAPDeviceName("desktop"));
  const [session, setSession] = useState<PAPSession | null>(null);
  const [state, setState] = useState<PAPConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<PAPTransferFile[]>([]);

  const signalingRef = useRef<ReturnType<typeof connectPAPSignaling> | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const transfersRef = useRef(new Map<string, IncomingTransfer>());

  const joinUrl = session ? `${getPAPJoinBaseUrl()}/pap/join/${session.pairingCode}` : "";
  const isLocalhostJoinUrl = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(joinUrl);

  const revokeFilePreviews = useCallback((currentFiles: PAPTransferFile[]) => {
    for (const file of currentFiles) {
      URL.revokeObjectURL(file.previewUrl);
    }
  }, []);

  const cleanupConnection = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    transfersRef.current.clear();
  }, []);

  const clearFiles = useCallback(() => {
    setFiles((currentFiles) => {
      revokeFilePreviews(currentFiles);
      return [];
    });
    void clearPAPInboxCache().catch(() => undefined);
  }, [revokeFilePreviews]);

  const removeFile = useCallback((fileId: string) => {
    setFiles((currentFiles) => {
      const file = currentFiles.find((item) => item.id === fileId);
      if (file) URL.revokeObjectURL(file.previewUrl);
      return currentFiles.filter((item) => item.id !== fileId);
    });
    void deletePAPInboxFile(fileId).catch(() => undefined);
  }, []);

  const renameFile = useCallback((fileId: string, fileName: string) => {
    const nextFileName = fileName.trim();
    if (!nextFileName) return;
    setFiles((currentFiles) =>
      currentFiles.map((file) => (file.id === fileId ? { ...file, fileName: nextFileName } : file))
    );
    void updatePAPInboxFileName(fileId, nextFileName).catch(() => undefined);
  }, []);

  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";
    channel.addEventListener("message", async (event) => {
      const controlMessage = parsePAPDataChannelMessage(event.data);

      if (controlMessage?.type === "file-start") {
        transfersRef.current.set(controlMessage.meta.transferId, {
          meta: controlMessage.meta,
          chunks: [],
          receivedBytes: 0,
        });
        return;
      }

      if (controlMessage?.type === "file-end") {
        const transfer = transfersRef.current.get(controlMessage.transferId);
        if (!transfer) return;
        transfersRef.current.delete(controlMessage.transferId);
        try {
          const file = await createTransferFile({ meta: transfer.meta, chunks: transfer.chunks });
          setFiles((currentFiles) => [file, ...currentFiles]);
          void cachePAPInboxFile(file).catch(() => undefined);
        } catch (transferError) {
          setError(transferError instanceof Error ? transferError.message : "Failed to receive screenshot.");
        }
        return;
      }

      if (event.data instanceof ArrayBuffer) {
        const activeTransfer = Array.from(transfersRef.current.values()).at(-1);
        if (!activeTransfer) return;
        activeTransfer.chunks.push(event.data);
        activeTransfer.receivedBytes += event.data.byteLength;
      }
    });
  }, []);

  const createOffer = useCallback(async (currentSession: PAPSession) => {
    if (!signalingRef.current) return;

    cleanupConnection();
    const peerConnection = createPAPPeerConnection();
    peerConnectionRef.current = peerConnection;

    peerConnection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        signalingRef.current?.send({
          type: "signal",
          sessionId: currentSession.id,
          fromPeerId: peerId,
          payload: { type: "ice-candidate", candidate: event.candidate.toJSON() },
        });
      }
    });
    peerConnection.addEventListener("connectionstatechange", () => {
      if (peerConnection.connectionState === "connected") setState("connected");
      if (peerConnection.connectionState === "failed") setState("failed");
      if (peerConnection.connectionState === "disconnected") setState("disconnected");
    });

    const channel = peerConnection.createDataChannel("pap-screenshots", { ordered: true });
    setupDataChannel(channel);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    signalingRef.current.send({
      type: "signal",
      sessionId: currentSession.id,
      fromPeerId: peerId,
      payload: { type: "offer", description: offer },
    });
  }, [cleanupConnection, peerId, setupDataChannel]);

  const handleSignal = useCallback(async (message: PAPServerMessage) => {
    if (message.type !== "signal") return;
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) return;

    if (message.payload.type === "answer") {
      await peerConnection.setRemoteDescription(message.payload.description);
    }

    if (message.payload.type === "ice-candidate") {
      await peerConnection.addIceCandidate(message.payload.candidate);
    }
  }, []);

  const startSession = useCallback(() => {
    setError(null);
    setState("connecting");
    cleanupConnection();
    signalingRef.current?.close();

    const signaling = connectPAPSignaling({
      onOpen: () => {
        signaling.send({ type: "create-session", peerId, deviceName });
      },
      onClose: () => setState((current) => (current === "expired" ? current : "disconnected")),
      onError: () => {
        setState("failed");
        setError("Could not connect to the PAP signaling service.");
      },
      onMessage: (message) => {
        if (message.type === "session-created") {
          setSession(message.session);
          setState(message.session.status === "connected" ? "connected" : "waiting");
          return;
        }
        if (message.type === "peer-joined") {
          setSession(message.session);
          setState("connecting");
          void createOffer(message.session);
          return;
        }
        if (message.type === "peer-left") {
          setState("waiting");
          cleanupConnection();
          return;
        }
        if (message.type === "session-expired") {
          setState("expired");
          setSession(null);
          cleanupConnection();
          return;
        }
        if (message.type === "error") {
          setError(message.message);
          setState("failed");
          return;
        }
        void handleSignal(message);
      },
    });

    signalingRef.current = signaling;
  }, [cleanupConnection, createOffer, deviceName, handleSignal, peerId]);

  const clearSession = useCallback(() => {
    if (session) {
      signalingRef.current?.send({ type: "leave-session", sessionId: session.id, peerId });
    }
    cleanupConnection();
    clearFiles();
    setSession(null);
    setState("idle");
  }, [cleanupConnection, clearFiles, peerId, session]);

  useEffect(() => {
    queueMicrotask(() => startSession());
    return () => {
      signalingRef.current?.close();
      cleanupConnection();
      setFiles((currentFiles) => {
        revokeFilePreviews(currentFiles);
        return [];
      });
    };
  }, [cleanupConnection, revokeFilePreviews, startSession]);

  useEffect(() => {
    let cancelled = false;
    void loadPAPInboxFiles()
      .then((cachedFiles) => {
        if (cancelled || cachedFiles.length === 0) return;
        setFiles((currentFiles) => {
          const existingIds = new Set(currentFiles.map((file) => file.id));
          return [...currentFiles, ...cachedFiles.filter((file) => !existingIds.has(file.id))].sort(
            (a, b) => new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime()
          );
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    clearFiles,
    clearSession,
    deviceName,
    error,
    files,
    isLocalhostJoinUrl,
    joinUrl,
    peerId,
    removeFile,
    renameFile,
    restartSession: startSession,
    session,
    state,
  };
}
