"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, reportClientError, workspaceApiPath } from "@/lib/api-client";
import { PAP_INBOX_RETENTION_MS } from "../pap-constants";
import type { PAPConnectionState, PAPServerScreenshot } from "../types";

type UploadListResponse = {
  expiresAfterMs?: number;
  screenshots: PAPServerScreenshot[];
};

async function parseJsonResponse<T>(response: Response, path: string) {
  const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? body.error : null;
    throw new ApiError(message || "PAP request failed.", response.status, {
      path,
      requestId: response.headers.get("x-vercel-id") ?? response.headers.get("x-request-id") ?? undefined,
    });
  }
  return body as T;
}

function getDownloadUrl(screenshotId: string) {
  return workspaceApiPath(`/api/pap/uploads/${encodeURIComponent(screenshotId)}/download`);
}

export function usePAPInbox() {
  const [state, setState] = useState<PAPConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<PAPServerScreenshot[]>([]);
  const [expiresAfterMs, setExpiresAfterMs] = useState(PAP_INBOX_RETENTION_MS);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reportedErrorRef = useRef("");

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const loadScreenshots = useCallback(async () => {
    try {
      const response = await fetch(workspaceApiPath("/api/pap/uploads"), {
        cache: "no-store",
      });
      const result = await parseJsonResponse<UploadListResponse>(response, "/api/pap/uploads");
      setExpiresAfterMs(result.expiresAfterMs ?? PAP_INBOX_RETENTION_MS);
      setFiles(result.screenshots);
      setState("connected");
      setError(null);
      reportedErrorRef.current = "";
    } catch (loadError) {
      setState("failed");
      const message = loadError instanceof Error ? loadError.message : "Failed to load PAP uploads.";
      if (reportedErrorRef.current !== message) {
        reportedErrorRef.current = message;
        reportClientError(loadError, "/api/pap/uploads");
      }
      setError(message);
    }
  }, []);

  const schedulePolling = useCallback(() => {
    stopPolling();
    pollIntervalRef.current = setInterval(() => {
      void loadScreenshots();
    }, 3_000);
  }, [loadScreenshots, stopPolling]);

  const refreshInbox = useCallback(() => {
    setState("connecting");
    void loadScreenshots();
    schedulePolling();
  }, [loadScreenshots, schedulePolling]);

  const clearFiles = useCallback(async () => {
    const ids = files.map((file) => file.id);
    await Promise.all(
      ids.map(async (id) => {
        const path = `/api/pap/uploads/${encodeURIComponent(id)}`;
        const response = await fetch(workspaceApiPath(path), {
          method: "DELETE",
          cache: "no-store",
        });
        await parseJsonResponse<{ ok: true }>(response, path);
      })
    );
    setFiles([]);
  }, [files]);

  const removeFile = useCallback(async (fileId: string) => {
    const response = await fetch(workspaceApiPath(`/api/pap/uploads/${encodeURIComponent(fileId)}`), {
      method: "DELETE",
      cache: "no-store",
    });
    await parseJsonResponse<{ ok: true }>(response, `/api/pap/uploads/${encodeURIComponent(fileId)}`);
    setFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
  }, []);

  const downloadFile = useCallback(async (file: PAPServerScreenshot) => {
    const response = await fetch(getDownloadUrl(file.id), {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new ApiError("Failed to download screenshot.", response.status, {
        path: getDownloadUrl(file.id),
        requestId: response.headers.get("x-vercel-id") ?? response.headers.get("x-request-id") ?? undefined,
      });
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
    downloadFile,
    error,
    expiresAfterMs,
    files,
    getPreviewUrl,
    refreshInbox,
    removeFile,
    state,
  };
}
