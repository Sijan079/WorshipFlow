"use client";

import { AssetType } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Maximize2,
  RefreshCw,
  Save,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, triggerBrowserDownload, type ServiceRecord } from "@/lib/api-client";
import { usePAPDesktopSession } from "../hooks/use-pap-desktop-session";
import { PAP_INBOX_TTL_MS, type PAPConnectionState, type PAPTransferFile } from "../types";
import { PAPToastViewport, usePAPToasts } from "./pap-toasts";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(state: PAPConnectionState) {
  if (state === "waiting") return "Waiting for mobile device";
  if (state === "connected") return "Connected";
  if (state === "connecting") return "Connecting";
  if (state === "expired") return "Expired";
  if (state === "failed") return "Needs attention";
  if (state === "disconnected") return "Disconnected";
  return "Starting";
}

const PAP_INBOX_TTL_HOURS = Math.round(PAP_INBOX_TTL_MS / 60 / 60 / 1000);

export default function PAPDesktopClient() {
  const pap = usePAPDesktopSession();
  const queryClient = useQueryClient();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [previewFile, setPreviewFile] = useState<PAPTransferFile | null>(null);
  const { dismissToast, showToast, toasts } = usePAPToasts();

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => apiFetch<ServiceRecord[]>("/api/services"),
  });

  const activeServiceId = selectedServiceId || servicesQuery.data?.[0]?.id || "";
  const selectedService = useMemo(
    () => servicesQuery.data?.find((service) => service.id === activeServiceId),
    [activeServiceId, servicesQuery.data]
  );
  const groupedBatches = useMemo(() => {
    const batches = new Map<string, PAPTransferFile[]>();
    for (const file of pap.files) {
      const batchFiles = batches.get(file.batchId) ?? [];
      batchFiles.push(file);
      batches.set(file.batchId, batchFiles);
    }

    return Array.from(batches.entries())
      .map(([batchId, files]) => ({
        batchId,
        files: [...files].sort((a, b) => a.batchIndex - b.batchIndex),
        createdAt: files[0]?.batchCreatedAt ?? files[0]?.transferredAt ?? new Date().toISOString(),
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pap.files]);

  useEffect(() => {
    if (!pap.joinUrl) return;

    const styles = window.getComputedStyle(document.documentElement);
    void QRCode.toDataURL(pap.joinUrl, {
      margin: 1,
      width: 280,
      color: {
        dark: styles.getPropertyValue("--color-qr-dark").trim(),
        light: styles.getPropertyValue("--color-qr-light").trim(),
      },
    }).then(setQrDataUrl);
  }, [pap.joinUrl]);

  const attachMutation = useMutation({
    mutationFn: async (file: PAPTransferFile) => {
      if (!activeServiceId) throw new Error("Select a worship service first.");
      const formData = new FormData();
      formData.append("file", file.blob, file.fileName);
      formData.append("type", AssetType.SCREENSHOT);
      return apiFetch(`/api/services/${activeServiceId}/assets`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: async (_asset, file) => {
      pap.removeFile(file.id);
      showToast(`${file.fileName} saved to service assets.`, "success");
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  function downloadBatch(files: PAPTransferFile[]) {
    for (const file of files) {
      triggerBrowserDownload(file.blob, file.fileName);
    }
    showToast(`${files.length} file${files.length === 1 ? "" : "s"} sent to downloads.`, "success");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-[var(--color-brand-border)] pb-5 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold">PAP screenshots</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Send screenshots from a phone, retrieve them here in original quality, then download or save only the ones you need.
            Temporary inbox items are kept on this desktop for {PAP_INBOX_TTL_HOURS} hours.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              showToast("PAP receive mode restarted.");
              pap.restartSession();
            }}
            className="pressable inline-flex items-center gap-2 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-4 py-2 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
            Restart
          </button>
          <button
            type="button"
            onClick={() => {
              showToast("PAP session cleared.");
              pap.clearSession();
            }}
            className="pressable inline-flex items-center gap-2 rounded-md bg-[var(--color-brand-ink)] px-4 py-2 text-sm font-semibold text-white"
          >
            <X className="h-4 w-4" />
            Clear Session
          </button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <section className="rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 border-b border-[var(--color-brand-border)] p-4">
              <h2 className="text-base font-semibold">Pair a phone</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Scan the QR code to open the mobile sender.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 border-l border-b border-[var(--color-brand-border)] px-3 py-4 text-xs font-semibold">
              <Wifi className="h-3.5 w-3.5" />
              {statusLabel(pap.state)}
            </span>
          </div>

          <div className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-4 py-3">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Pairing code</p>
            <p className="mt-1 font-[var(--font-plex-mono)] text-3xl font-semibold tracking-[0.12em]">
              {pap.session?.pairingCode ?? "------"}
            </p>
          </div>

          <div className="flex min-h-[300px] items-center justify-center border-b border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="PAP mobile pairing QR code" className="h-[260px] w-[260px]" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
            )}
          </div>

          {pap.joinUrl ? (
            <div className="space-y-3 p-4">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(pap.joinUrl);
                  showToast("Join link copied.", "success");
                }}
                className="pressable inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-4 py-2 text-sm font-semibold"
              >
                <Copy className="h-4 w-4" />
                Copy Join Link
              </button>
              {pap.isLocalhostJoinUrl ? (
                <p className="rounded-md border border-[var(--color-brand-border)] bg-[var(--color-card-yellow)] p-3 text-sm leading-5 text-[var(--color-text-secondary)]">
                  This QR uses localhost. Set `NEXT_PUBLIC_PAP_PUBLIC_URL` to your desktop LAN address so phones can open it.
                </p>
              ) : null}
            </div>
          ) : null}

          {pap.error ? <p className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{pap.error}</p> : null}
        </section>

        <section className="rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)]">
          <div className="flex flex-col justify-between gap-3 border-b border-[var(--color-brand-border)] p-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold">PAP Inbox</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Temporary screenshots survive refreshes here for {PAP_INBOX_TTL_HOURS} hours, unless attached or discarded.
              </p>
            </div>
            <select
              value={activeServiceId}
              onChange={(event) => setSelectedServiceId(event.target.value)}
              className="rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm"
            >
              {servicesQuery.data?.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.ministryName} / {new Date(service.serviceDate).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <div>
            {groupedBatches.map((batch) => (
              <div key={batch.batchId} className="border-b border-[var(--color-brand-border)] last:border-b-0">
                <div className="flex flex-col justify-between gap-3 bg-[var(--color-brand-panel-alt)] px-4 py-3 md:flex-row md:items-center">
                  <div>
                    <p className="font-semibold">{new Date(batch.createdAt).toLocaleString()}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {batch.files.length} file{batch.files.length === 1 ? "" : "s"} in this batch
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadBatch(batch.files)}
                    className="pressable inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-4 py-2 text-sm font-semibold"
                  >
                    <Download className="h-4 w-4" />
                    Download All
                  </button>
                </div>

                <div>
                  {batch.files.map((file) => (
                    <article key={file.id} className="grid gap-3 border-t border-[var(--color-brand-border)] p-3 sm:grid-cols-[112px_minmax(0,1fr)] lg:grid-cols-[112px_minmax(0,1fr)_auto] lg:items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFile(file);
                          showToast(`Previewing ${file.fileName}.`);
                        }}
                        className="pressable group relative block aspect-[4/3] w-full overflow-hidden rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={file.previewUrl} alt={file.fileName} className="h-full w-full object-contain" />
                        <span className="absolute right-1.5 top-1.5 rounded-sm bg-[var(--color-brand-ink)]/75 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <Maximize2 className="h-4 w-4" />
                        </span>
                      </button>
                      <div className="min-w-0">
                        <input
                          value={file.fileName}
                          onChange={(event) => pap.renameFile(file.id, event.target.value)}
                          className="w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm font-semibold"
                        />
                        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                          {file.dimensions ? `${file.dimensions.width} x ${file.dimensions.height} / ` : ""}
                          {formatBytes(file.size)} / {new Date(file.transferredAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3 lg:col-span-1">
                        <button
                          type="button"
                          onClick={() => {
                            triggerBrowserDownload(file.blob, file.fileName);
                            showToast(`${file.fileName} sent to downloads.`, "success");
                          }}
                          className="pressable inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm font-semibold"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                        <button
                          type="button"
                          disabled={!selectedService || attachMutation.isPending}
                          onClick={() => {
                            showToast(`Saving ${file.fileName} to service assets.`);
                            attachMutation.mutate(file);
                          }}
                          className="pressable inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-brand-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            pap.removeFile(file.id);
                            showToast(`${file.fileName} deleted.`);
                          }}
                          className="pressable inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm font-semibold"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {pap.files.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center bg-[var(--color-brand-panel-alt)] p-8 text-center">
              <Camera className="h-10 w-10 text-[var(--color-brand-accent)]" />
              <p className="mt-4 text-lg font-semibold">Waiting for screenshots</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-text-secondary)]">
                Scan the QR code with a phone, choose screenshots, then retrieve or save them here. Nothing is permanently stored until you save it.
              </p>
            </div>
          ) : null}

          {attachMutation.error ? (
            <p className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{attachMutation.error.message}</p>
          ) : null}
          {attachMutation.isSuccess ? (
            <p className="m-4 inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              Screenshot saved to service assets.
            </p>
          ) : null}
        </section>
      </div>

      {previewFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-brand-ink)]/80 p-4" onClick={() => setPreviewFile(null)}>
          <div className="max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setPreviewFile(null);
                showToast("Preview closed.");
              }}
              className="pressable mb-3 ml-auto flex rounded-md bg-[var(--color-brand-panel)] p-2 text-[var(--color-brand-ink)]"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewFile.previewUrl} alt={previewFile.fileName} className="max-h-[82vh] max-w-full rounded-md bg-[var(--color-brand-panel)] object-contain" />
          </div>
        </div>
      ) : null}
      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </div>
  );
}
