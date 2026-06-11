"use client";

import { useCallback, useEffect, useState } from "react";
import { createPAPBatchFileName } from "../rtc/pap-file-names";
import type { PAPConnectionState, PAPSendProgress, PAPServerRoom, PAPServerScreenshot } from "../types";
import { getPAPDeviceName } from "../websocket/pap-signaling-client";

type RoomResponse = {
  room: PAPServerRoom;
};

type UploadResponse = {
  screenshots: PAPServerScreenshot[];
};

async function parseJsonResponse<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? body.error : null;
    throw new Error(message || "PAP request failed.");
  }
  return body as T;
}

export function usePAPMobileSender(pairingCode: string) {
  const [deviceName] = useState(() => getPAPDeviceName("mobile"));
  const [session, setSession] = useState<PAPServerRoom | null>(null);
  const [state, setState] = useState<PAPConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PAPSendProgress[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      try {
        const response = await fetch(`/api/pap/rooms/${encodeURIComponent(pairingCode)}`, {
          cache: "no-store",
        });
        const result = await parseJsonResponse<RoomResponse>(response);
        if (cancelled) return;
        setSession(result.room);
        setState("connected");
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setState("failed");
        setError(loadError instanceof Error ? loadError.message : "This PAP room is unavailable.");
      }
    }

    void loadRoom();
    return () => {
      cancelled = true;
    };
  }, [pairingCode]);

  const sendFiles = useCallback(
    async (files: File[], note = "") => {
      if (state !== "connected") {
        setError("The PAP room is not ready yet.");
        return;
      }

      const batchCreatedAt = new Date();
      const batchId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const formData = new FormData();
      formData.set("deviceName", deviceName);
      formData.set("note", note);

      const initialProgress = files.map((file, index) => ({
        transferId:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}-${index}`,
        batchId,
        batchIndex: index + 1,
        batchTotal: files.length,
        fileName: createPAPBatchFileName({ file, batchCreatedAt, batchIndex: index + 1 }),
        sentBytes: 0,
        totalBytes: file.size,
        done: false,
      }));

      setProgress((currentProgress) => [...initialProgress, ...currentProgress]);
      for (const file of files) {
        formData.append("files", file);
      }

      try {
        setError(null);
        const response = await fetch(`/api/pap/rooms/${encodeURIComponent(pairingCode)}/screenshots`, {
          method: "POST",
          body: formData,
          cache: "no-store",
        });
        await parseJsonResponse<UploadResponse>(response);
        setProgress((currentProgress) =>
          currentProgress.map((item) =>
            item.batchId === batchId ? { ...item, sentBytes: item.totalBytes, done: true } : item
          )
        );
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Failed to upload screenshots.");
        setProgress((currentProgress) => currentProgress.filter((item) => item.batchId !== batchId));
      }
    },
    [deviceName, pairingCode, state]
  );

  return {
    deviceName,
    error,
    progress,
    sendFiles,
    session: session
      ? {
          id: session.id,
          pairingCode,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          desktopPeerId: "server-room",
          desktopDeviceName: "Secure shared PAP room",
          status: "connected" as const,
        }
      : null,
    state,
  };
}
