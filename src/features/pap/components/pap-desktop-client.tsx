"use client";

import {
  Camera,
  Copy,
  Download,
  Loader2,
  Maximize2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { PAP_SERVER_INBOX_TTL_MS, type PAPServerScreenshot } from "../types";
import { usePAPDesktopSessionContext } from "./pap-desktop-session-provider";
import { PAPToastViewport, usePAPToasts } from "./pap-toasts";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

const PAP_INBOX_TTL_HOURS = Math.round(PAP_SERVER_INBOX_TTL_MS / 60 / 60 / 1000);

export default function PAPDesktopClient({
  embedded = false,
  hideHeader = false,
}: {
  embedded?: boolean;
  hideHeader?: boolean;
}) {
  const pap = usePAPDesktopSessionContext();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [previewFile, setPreviewFile] = useState<PAPServerScreenshot | null>(null);
  const [sessionRefreshKey, setSessionRefreshKey] = useState(0);
  const [isSessionRefreshing, setIsSessionRefreshing] = useState(false);
  const sessionRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { dismissToast, showToast, toasts } = usePAPToasts();

  const groupedBatches = useMemo(() => {
    const batches = new Map<string, PAPServerScreenshot[]>();
    for (const file of pap.files) {
      const batchFiles = batches.get(file.batchId) ?? [];
      batchFiles.push(file);
      batches.set(file.batchId, batchFiles);
    }

    return Array.from(batches.entries())
      .map(([batchId, files]) => ({
        batchId,
        files: [...files].sort((a, b) => a.batchIndex - b.batchIndex),
        createdAt: files[0]?.createdAt ?? new Date().toISOString(),
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

  useEffect(() => {
    return () => {
      if (sessionRefreshTimeoutRef.current) {
        clearTimeout(sessionRefreshTimeoutRef.current);
      }
    };
  }, []);

  function showSessionRefresh() {
    setIsSessionRefreshing(true);
    setSessionRefreshKey((current) => current + 1);
    if (sessionRefreshTimeoutRef.current) {
      clearTimeout(sessionRefreshTimeoutRef.current);
    }
    sessionRefreshTimeoutRef.current = setTimeout(() => {
      setIsSessionRefreshing(false);
      sessionRefreshTimeoutRef.current = null;
    }, 850);
  }

  function downloadBatch(files: PAPServerScreenshot[]) {
    for (const file of files) {
      void pap.downloadFile(file);
    }
    showToast(`${files.length} file${files.length === 1 ? "" : "s"} sent to downloads.`, "success");
  }

  return (
    <div className={embedded ? "space-y-5" : "space-y-6"}>
      <header
        className={`flex flex-col justify-between gap-4 md:flex-row md:items-end ${
          hideHeader ? "" : `border-b border-[var(--color-brand-border)] ${embedded ? "pb-4" : "pb-5"}`
        }`}
      >
        {hideHeader ? null : (
          <div>
            {embedded ? (
              <h2 className="text-lg font-semibold text-[var(--color-brand-ink)]">Phone-to-PC Transfer</h2>
            ) : (
              <h1 className="text-2xl font-semibold">PAP screenshots</h1>
            )}
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Send screenshots from a phone, retrieve them here in original quality, then download or manage only the ones you need.
              Temporary inbox items are stored in this secure room for {PAP_INBOX_TTL_HOURS} hours.
            </p>
          </div>
        )}
        <div className={`flex gap-2 ${hideHeader ? "w-full justify-end" : ""}`}>
          <button
            type="button"
            onClick={() => {
              showToast("PAP receive mode restarted.");
              showSessionRefresh();
              pap.restartSession();
            }}
            className="pressable inline-flex items-center gap-2 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-4 py-2 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
            Rotate Room
          </button>
          <button
            type="button"
            onClick={() => {
              showToast("PAP room revoked.");
              showSessionRefresh();
              pap.clearSession();
            }}
            className="pressable inline-flex items-center gap-2 rounded-md bg-[var(--color-focus)] px-4 py-2 text-sm font-semibold text-[#3f008e] shadow-[0_18px_36px_rgba(210,187,255,0.18)]"
          >
            <X className="h-4 w-4" />
            Revoke Room
          </button>
        </div>
      </header>

      <div className="relative">
        <div
          key={sessionRefreshKey}
          className={`grid gap-6 xl:grid-cols-[380px_1fr] ${
            isSessionRefreshing ? "opacity-60 blur-[1px]" : "animate-fade-in opacity-100 blur-0"
          }`}
        >
          <section className="rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-focus)_16%,transparent)]">
          <div className="border-b border-[var(--color-brand-border)] p-4">
            <div>
              <h2 className="text-base font-semibold">Secure shared room</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Share this room link with trusted phones only.</p>
            </div>
          </div>

          <div className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-4 py-3 text-center">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Room expires</p>
            <p className="mt-1 font-[var(--font-plex-mono)] text-sm font-semibold">
              {pap.room ? new Date(pap.room.expiresAt).toLocaleString() : "Creating secure room"}
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
                  This room link uses localhost. Set `NEXT_PUBLIC_PAP_PUBLIC_URL` to your desktop LAN address so phones can open it.
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
                Temporary screenshots survive refreshes here for {PAP_INBOX_TTL_HOURS} hours, unless downloaded or discarded.
              </p>
            </div>
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
                    className="pressable inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-focus)] px-4 py-2 text-sm font-bold text-[#3f008e] shadow-[0_12px_28px_rgba(210,187,255,0.18)]"
                  >
                    <Download className="h-4 w-4" />
                    Download All
                  </button>
                </div>

                <div>
                  {batch.files.map((file) => (
                    <article key={file.id} className="grid gap-3 border-t border-[var(--color-brand-border)] p-3 sm:grid-cols-[112px_minmax(0,1fr)] lg:grid-cols-[112px_minmax(0,1fr)_auto]">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFile(file);
                          showToast(`Previewing ${file.fileName}.`);
                        }}
                        className="pressable group relative block aspect-[4/3] w-full overflow-hidden rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={pap.getPreviewUrl(file)} alt={file.fileName} className="h-full w-full object-contain" />
                        <span className="absolute right-1.5 top-1.5 rounded-sm bg-[var(--color-brand-ink)]/75 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <Maximize2 className="h-4 w-4" />
                        </span>
                      </button>
                      <div className="min-w-0">
                        <p className="truncate rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm font-semibold">
                          {file.fileName}
                        </p>
                        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                          {formatBytes(file.size)} / {new Date(file.createdAt).toLocaleTimeString()}
                          {file.note ? ` / ${file.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-start justify-end gap-1 pt-2 sm:col-span-2 lg:col-span-1">
                        <button
                          type="button"
                          onClick={() => {
                            void pap.downloadFile(file);
                            showToast(`${file.fileName} sent to downloads.`, "success");
                          }}
                          className="pressable inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-focus)] hover:bg-[var(--color-brand-panel-strong)]"
                          aria-label={`Download ${file.fileName}`}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void pap.removeFile(file.id);
                            showToast(`${file.fileName} deleted.`);
                          }}
                          className="pressable inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-danger)] hover:bg-[var(--color-brand-panel-strong)]"
                          aria-label={`Delete ${file.fileName}`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
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
                Open the secure room on a phone, choose screenshots, then retrieve or download them here. Items stay in this temporary inbox until they expire or are deleted.
              </p>
            </div>
          ) : null}
          </section>
        </div>

        {isSessionRefreshing ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md bg-[var(--color-paper)]/44 backdrop-blur-[1px]">
            <div className="inline-flex items-center gap-3 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-strong)] px-4 py-3 text-sm font-semibold text-[var(--color-brand-ink)] shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
              <RefreshCw className="h-4 w-4 animate-spin text-[var(--color-focus)]" />
              Refreshing session
            </div>
          </div>
        ) : null}
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
            <img src={pap.getPreviewUrl(previewFile)} alt={previewFile.fileName} className="max-h-[82vh] max-w-full rounded-md bg-[var(--color-brand-panel)] object-contain" />
          </div>
        </div>
      ) : null}
      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </div>
  );
}
