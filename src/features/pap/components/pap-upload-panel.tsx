"use client";

import { CheckCircle2, ImagePlus, Loader2, Send, WifiOff } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { usePAPMobileSender } from "../hooks/use-pap-mobile-sender";
import { PAPToastViewport, usePAPToasts } from "./pap-toasts";

function percent(sentBytes: number, totalBytes: number) {
  if (totalBytes === 0) return 100;
  return Math.round((sentBytes / totalBytes) * 100);
}

export function PAPUploadPanel({ compact = false }: { compact?: boolean }) {
  const pap = usePAPMobileSender();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [note, setNote] = useState("");
  const { dismissToast, showToast, toasts } = usePAPToasts();

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length > 0) {
        showToast(`${files.length} screenshot${files.length === 1 ? "" : "s"} selected.`, "success");
        void pap.sendFiles(files, note).then(() => setNote(""));
      }
    },
    [note, pap, showToast]
  );

  const connected = pap.state === "connected";
  const sentCount = pap.progress.filter((item) => item.done).length;
  const activeProgress = pap.progress.find((item) => !item.done);

  return (
    <section className="ui-surface-panel">
      <div className="border-b border-[var(--border-default)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Upload screenshots</h2>
            <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
              Add images from this device to the shared temporary inbox.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-sm border border-[var(--border-default)] px-2 py-1 text-xs font-semibold">
            {connected ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--state-success)]" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-accent)]" />}
            {connected ? "Ready" : pap.state}
          </span>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center border-b border-dashed p-5 text-center ${
          compact ? "min-h-[260px]" : "min-h-[360px]"
        } ${
          isDragging ? "border-[var(--border-focus)] bg-[var(--palette-pastel-sky)]/15" : "border-[var(--border-default)] bg-[var(--surface-panel-alt)]"
        }`}
      >
        <ImagePlus className="h-12 w-12 text-[var(--action-primary-bg)]" />
        <h3 className="mt-4 text-lg font-semibold">Choose or take screenshot</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Upload one or more images. The same inbox is visible from phone and desktop.
        </p>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={180}
          placeholder="Optional note for this batch"
          className="mt-5 w-full resize-none rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-sm"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <button
          type="button"
          disabled={!connected}
          onClick={() => {
            showToast("Opening image picker.");
            inputRef.current?.click();
          }}
          className="pressable ui-btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Select Images
        </button>
      </div>

      {activeProgress ? (
        <div className="border-b border-[var(--border-default)] p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">
              Uploading {activeProgress.batchIndex} / {activeProgress.batchTotal}
            </span>
            <span className="text-[var(--text-secondary)]">
              {percent(activeProgress.sentBytes, activeProgress.totalBytes)}%
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-panel-alt)]">
            <div
              className="h-full rounded-full bg-[var(--action-primary-bg)] transition-[width] duration-200"
              style={{ width: `${percent(activeProgress.sentBytes, activeProgress.totalBytes)}%` }}
            />
          </div>
        </div>
      ) : null}

      {sentCount > 0 ? (
        <div className="border-b border-[color-mix(in_oklab,var(--state-success)_28%,transparent)] bg-[var(--state-success-soft)] p-4 text-center text-sm font-semibold text-[var(--state-success)]">
          {sentCount} screenshot{sentCount === 1 ? "" : "s"} uploaded. The inbox will refresh automatically.
        </div>
      ) : null}

      {pap.error ? (
        <div className="m-4 flex gap-3 rounded-[var(--radius-control)] border border-[color-mix(in_oklab,var(--state-danger)_28%,transparent)] bg-[var(--state-danger-soft)] p-4 text-sm leading-6 text-[var(--state-danger)]">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{pap.error}</p>
        </div>
      ) : null}

      {pap.progress.length > 0 ? (
        <div className="space-y-2 p-4">
          {pap.progress.map((item) => (
            <div key={item.transferId} className="rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-semibold">{item.fileName}</span>
                <span className="shrink-0 text-[var(--text-secondary)]">
                  {item.done ? "Done" : `${percent(item.sentBytes, item.totalBytes)}%`}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </section>
  );
}
