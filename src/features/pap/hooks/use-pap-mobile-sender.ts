"use client";

import { useCallback, useState } from "react";
import { createPAPBatchFileName } from "../rtc/pap-file-names";
import type { PAPConnectionState, PAPSendProgress, PAPServerScreenshot } from "../types";
import { getPAPDeviceName } from "../pap-device-name";

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

export function usePAPMobileSender() {
  const [deviceName] = useState(() => getPAPDeviceName("mobile"));
  const state: PAPConnectionState = "connected";
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PAPSendProgress[]>([]);

  const sendFiles = useCallback(
    async (files: File[], note = "") => {
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
        const response = await fetch("/api/pap/uploads", {
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
    [deviceName]
  );

  return {
    deviceName,
    error,
    progress,
    sendFiles,
    state,
  };
}
