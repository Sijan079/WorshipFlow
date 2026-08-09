"use client";

import { Camera, Download, Maximize2, MoreHorizontal, RefreshCw, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PAP_INBOX_RETENTION_MS } from "../pap-constants";
import type { PAPServerScreenshot } from "../types";
import { usePAPInbox } from "../hooks/use-pap-inbox";
import { PAPToastViewport, usePAPToasts } from "./pap-toasts";
import { PAPUploadPanel } from "./pap-upload-panel";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

const PAP_INBOX_TTL_HOURS = Math.round(PAP_INBOX_RETENTION_MS / 60 / 60 / 1000);

export default function PAPDesktopClient({
  embedded = false,
  hideHeader = false,
}: {
  embedded?: boolean;
  hideHeader?: boolean;
}) {
  const pap = usePAPInbox();
  const [previewFile, setPreviewFile] = useState<PAPServerScreenshot | null>(null);
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

  function downloadBatch(files: PAPServerScreenshot[]) {
    for (const file of files) {
      void pap.downloadFile(file);
    }
    showToast(`${files.length} file${files.length === 1 ? "" : "s"} sent to downloads.`, "success");
  }

  return (
    <div className={`${embedded ? "space-y-5" : "space-y-6"} text-[var(--text-primary)]`}>
      <header
        className={`flex flex-col justify-between gap-4 md:flex-row md:items-end ${
          hideHeader ? "" : `border-b border-[var(--border-default)] ${embedded ? "pb-4" : "pb-5"}`
        }`}
      >
        {hideHeader ? null : (
          <div>
            {embedded ? (
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Phone Transfer</h2>
            ) : (
              <h1 className="text-2xl font-semibold">Phone Transfer</h1>
            )}
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Upload screenshots from any signed-in device and retrieve them from the same shared temporary inbox.
              Items expire after about {PAP_INBOX_TTL_HOURS} hours.
            </p>
          </div>
        )}
        <div className={`flex gap-2 ${hideHeader ? "w-full justify-end" : ""}`}>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => {
              showToast("Inbox refreshed.");
              void pap.refreshInbox();
            }}
            className="pressable ui-btn-secondary h-11 px-4 font-semibold text-[var(--text-primary)]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className="pressable h-11 w-11 text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"
                aria-label="Inbox actions"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="workspace-content-light min-w-52 border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-1.5 text-[var(--text-primary)] shadow-[var(--elevation-raised)]"
            >
              <DropdownMenuLabel className="technical-label px-2 py-1.5">Inbox actions</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[var(--rule-default)]" />
              <DropdownMenuItem
                className="gap-2 px-2 py-2 font-semibold text-[var(--text-danger)] focus:bg-[var(--state-danger-soft)] focus:text-[var(--text-danger)] [&_svg]:text-[var(--text-danger)]"
                onSelect={() => {
                  void pap.clearFiles();
                  showToast("Inbox cleared.");
                }}
              >
                <Trash2 className="h-4 w-4" />
                Clear inbox
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <PAPUploadPanel compact />

        <section className="ui-surface-panel">
          <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-default)] p-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold">Shared Inbox</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Visible from phone or desktop after signing in. Temporary screenshots are automatically pruned.
              </p>
            </div>
          </div>

          {pap.error ? <p className="m-4 rounded-[var(--radius-control)] border border-[color-mix(in_oklab,var(--state-danger)_28%,transparent)] bg-[var(--state-danger-soft)] p-3 text-sm text-[var(--state-danger)]">{pap.error}</p> : null}

          <div>
            {groupedBatches.map((batch) => (
              <div key={batch.batchId} className="border-b border-[var(--border-default)] last:border-b-0">
                <div className="flex flex-col justify-between gap-3 bg-[var(--surface-panel-alt)] px-4 py-3 md:flex-row md:items-center">
                  <div>
                    <p className="font-semibold">{new Date(batch.createdAt).toLocaleString()}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {batch.files.length} file{batch.files.length === 1 ? "" : "s"} in this batch
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadBatch(batch.files)}
                    className="pressable ui-btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold"
                  >
                    <Download className="h-4 w-4" />
                    Download all
                  </button>
                </div>

                <div>
                  {batch.files.map((file) => (
                    <article key={file.id} className="grid gap-3 border-t border-[var(--border-default)] p-3 sm:grid-cols-[112px_minmax(0,1fr)] lg:grid-cols-[112px_minmax(0,1fr)_auto]">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFile(file);
                          showToast(`Previewing ${file.fileName}.`);
                        }}
                        className="pressable group relative block aspect-[4/3] w-full overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pap.getPreviewUrl(file)} alt={file.fileName} className="h-full w-full object-contain" />
                        <span className="absolute right-1.5 top-1.5 rounded-sm bg-[var(--text-primary)]/75 p-1.5 text-[var(--text-inverse)] opacity-0 transition-opacity group-hover:opacity-100">
                          <Maximize2 className="h-4 w-4" />
                        </span>
                      </button>
                      <div className="min-w-0">
                        <p className="truncate rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-sm font-semibold">
                          {file.fileName}
                        </p>
                        <p className="mt-2 text-xs text-[var(--text-secondary)]">
                          {formatBytes(file.size)} / {new Date(file.createdAt).toLocaleTimeString()}
                          {file.deviceName ? ` / ${file.deviceName}` : ""}
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
                          className="pressable inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-accent)] hover:bg-[var(--surface-panel-strong)]"
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
                          className="pressable inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--state-danger)] hover:bg-[var(--surface-panel-strong)]"
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
            <div className="flex min-h-[360px] flex-col items-center justify-center bg-[var(--surface-panel-alt)] p-8 text-center">
              <Camera className="h-10 w-10 text-[var(--action-primary-bg)]" />
              <p className="mt-4 text-lg font-semibold">No screenshots yet</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
                Upload from this device or open this same page on a phone after signing in.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <Dialog open={Boolean(previewFile)} onOpenChange={(open) => !open && setPreviewFile(null)}>
        {previewFile ? (
          <DialogContent className="workspace-content-light max-w-5xl overflow-hidden border-[var(--border-default)] bg-[var(--surface-panel)] p-0 text-[var(--text-primary)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border-default)] px-4 py-3">
              <div className="min-w-0">
                <DialogTitle className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {previewFile.fileName}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-[var(--text-secondary)]">
                  Screenshot preview
                </DialogDescription>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  onClick={() => showToast("Preview closed.")}
                  className="pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  aria-label="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </DialogClose>
            </div>
            <div className="flex max-h-[78vh] items-center justify-center bg-[var(--surface-canvas)] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pap.getPreviewUrl(previewFile)} alt={previewFile.fileName} className="max-h-[74vh] max-w-full rounded-md bg-[var(--surface-panel)] object-contain" />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </div>
  );
}
