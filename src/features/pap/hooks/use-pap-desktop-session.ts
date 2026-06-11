"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PAP_SERVER_INBOX_TTL_MS, type PAPConnectionState, type PAPServerScreenshot } from "../types";

type UploadListResponse = {
  expiresAfterMs?: number;
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

function getDownloadUrl(screenshotId: string) {
  return `/api/pap/uploads/${encodeURIComponent(screenshotId)}/download`;
}

export function usePAPDesktopSession() {
  const [state, setState] = useState<PAPConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<PAPServerScreenshot[]>([]);
  const [expiresAfterMs, setExpiresAfterMs] = useState(PAP_SERVER_INBOX_TTL_MS);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const loadScreenshots = useCallback(async () => {
    try {
      const response = await fetch("/api/pap/uploads", {
        cache: "no-store",
      });
      const result = await parseJsonResponse<UploadListResponse>(response);
      setExpiresAfterMs(result.expiresAfterMs ?? PAP_SERVER_INBOX_TTL_MS);
      setFiles(result.screenshots);
      setState("connected");
      setError(null);
    } catch (loadError) {
      setState("failed");
      setError(loadError instanceof Error ? loadError.message : "Failed to load PAP uploads.");
    }
  }, []);

  const schedulePolling = useCallback(() => {
    stopPolling();
    pollIntervalRef.current = setInterval(() => {
      void loadScreenshots();
    }, 3_000);
  }, [loadScreenshots, stopPolling]);

  const restartSession = useCallback(() => {
    setState("connecting");
    void loadScreenshots();
    schedulePolling();
  }, [loadScreenshots, schedulePolling]);

  const clearFiles = useCallback(async () => {
    const ids = files.map((file) => file.id);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/pap/uploads/${encodeURIComponent(id)}`, {
          method: "DELETE",
          cache: "no-store",
        }).catch(() => undefined)
      )
    );
    setFiles([]);
  }, [files]);

  const removeFile = useCallback(async (fileId: string) => {
    const response = await fetch(`/api/pap/uploads/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    await parseJsonResponse<{ ok: true }>(response);
    setFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
  }, []);

  const downloadFile = useCallback(async (file: PAPServerScreenshot) => {
    const response = await fetch(getDownloadUrl(file.id), {
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

  const getPreviewUrl = useCallback((file: PAPServerScreenshot) => getDownloadUrl(file.id), []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadScreenshots();
    });
    schedulePolling();
    return () => {
      stopPolling();
    };
  }, [loadScreenshots, schedulePolling, stopPolling]);

  return {
    clearFiles,
    clearSession: clearFiles,
    downloadFile,
    error,
    expiresAfterMs,
    files,
    getPreviewUrl,
    isLocalhostJoinUrl: false,
    joinUrl: "",
    peerId: "global-inbox",
    refreshFiles: loadScreenshots,
    removeFile,
    renameFile: () => undefined,
    restartSession,
    room: null,
    session: null,
    state,
  };
}
