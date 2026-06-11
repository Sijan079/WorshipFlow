"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PAPConnectionState, PAPServerRoom, PAPServerScreenshot } from "../types";

type CreateRoomResponse = {
  room: PAPServerRoom;
  token: string;
  joinUrl: string;
};

type ScreenshotListResponse = {
  room: PAPServerRoom;
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

function getDownloadUrl(roomToken: string, screenshotId: string) {
  return `/api/pap/rooms/${encodeURIComponent(roomToken)}/screenshots/${encodeURIComponent(screenshotId)}/download`;
}

export function usePAPDesktopSession() {
  const [room, setRoom] = useState<PAPServerRoom | null>(null);
  const [roomToken, setRoomToken] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [state, setState] = useState<PAPConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<PAPServerScreenshot[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomTokenRef = useRef("");

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const loadScreenshots = useCallback(async () => {
    const activeToken = roomTokenRef.current;
    if (!activeToken) return;

    try {
      const response = await fetch(`/api/pap/rooms/${encodeURIComponent(activeToken)}/screenshots`, {
        cache: "no-store",
      });
      const result = await parseJsonResponse<ScreenshotListResponse>(response);
      setRoom(result.room);
      setFiles(result.screenshots);
      setState("connected");
      setError(null);
    } catch (loadError) {
      setState("failed");
      setError(loadError instanceof Error ? loadError.message : "Failed to load PAP screenshots.");
    }
  }, []);

  const schedulePolling = useCallback(() => {
    stopPolling();
    pollIntervalRef.current = setInterval(() => {
      void loadScreenshots();
    }, 3_000);
  }, [loadScreenshots, stopPolling]);

  const startSession = useCallback(async () => {
    stopPolling();
    setError(null);
    setState("connecting");
    setFiles([]);

    try {
      const response = await fetch("/api/pap/rooms", {
        method: "POST",
        cache: "no-store",
      });
      const result = await parseJsonResponse<CreateRoomResponse>(response);
      roomTokenRef.current = result.token;
      setRoomToken(result.token);
      setJoinUrl(result.joinUrl);
      setRoom(result.room);
      setState("connected");
      await loadScreenshots();
      schedulePolling();
    } catch (createError) {
      setState("failed");
      setError(createError instanceof Error ? createError.message : "Could not create a secure PAP room.");
    }
  }, [loadScreenshots, schedulePolling, stopPolling]);

  const clearFiles = useCallback(async () => {
    const activeToken = roomTokenRef.current;
    if (!activeToken) return;
    const ids = files.map((file) => file.id);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/pap/rooms/${encodeURIComponent(activeToken)}/screenshots/${encodeURIComponent(id)}`, {
          method: "DELETE",
          cache: "no-store",
        }).catch(() => undefined)
      )
    );
    setFiles([]);
  }, [files]);

  const clearSession = useCallback(async () => {
    const activeToken = roomTokenRef.current;
    stopPolling();
    if (activeToken) {
      await fetch(`/api/pap/rooms/${encodeURIComponent(activeToken)}`, {
        method: "DELETE",
        cache: "no-store",
      }).catch(() => undefined);
    }
    roomTokenRef.current = "";
    setRoomToken("");
    setJoinUrl("");
    setRoom(null);
    setFiles([]);
    setState("idle");
  }, [stopPolling]);

  const removeFile = useCallback(async (fileId: string) => {
    const activeToken = roomTokenRef.current;
    if (!activeToken) return;

    const response = await fetch(`/api/pap/rooms/${encodeURIComponent(activeToken)}/screenshots/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    await parseJsonResponse<{ ok: true }>(response);
    setFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
  }, []);

  const downloadFile = useCallback(async (file: PAPServerScreenshot) => {
    const activeToken = roomTokenRef.current;
    if (!activeToken) return;

    const response = await fetch(getDownloadUrl(activeToken, file.id), {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Failed to download screenshot.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const getPreviewUrl = useCallback(
    (file: PAPServerScreenshot) => (roomToken ? getDownloadUrl(roomToken, file.id) : ""),
    [roomToken]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void startSession();
    });
    return () => {
      stopPolling();
    };
  }, [startSession, stopPolling]);

  return {
    clearFiles,
    clearSession,
    downloadFile,
    error,
    files,
    getPreviewUrl,
    isLocalhostJoinUrl: /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(joinUrl),
    joinUrl,
    peerId: roomToken,
    refreshFiles: loadScreenshots,
    removeFile,
    renameFile: () => undefined,
    restartSession: startSession,
    room,
    session: room
      ? {
          id: room.id,
          pairingCode: "secure room",
          createdAt: room.createdAt,
          expiresAt: room.expiresAt,
          desktopPeerId: roomToken,
          desktopDeviceName: "Worship Flow Desktop",
          status: "connected" as const,
        }
      : null,
    state,
  };
}
