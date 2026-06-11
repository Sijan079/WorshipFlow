"use client";

import { CheckCircle2, ImagePlus, Loader2, Send, WifiOff } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { usePAPMobileSender } from "../hooks/use-pap-mobile-sender";
import { PAPToastViewport, usePAPToasts } from "./pap-toasts";

function percent(sentBytes: number, totalBytes: number) {
  if (totalBytes === 0) return 100;
  return Math.round((sentBytes / totalBytes) * 100);
}

export default function PAPMobileClient({ pairingCode }: { pairingCode: string }) {
  const pap = usePAPMobileSender(pairingCode);
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
    <main className="min-h-screen bg-[var(--color-brand-bg)] px-4 py-6 text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col">
        <header className="border-b border-[var(--color-brand-border)] pb-4">
          <h1 className="text-2xl font-semibold">Send screenshots</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            Choose images from this phone. They upload to the secure Worship Flow room.
          </p>
        </header>

        <section className="mt-5 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-[var(--font-plex-mono)] text-sm font-semibold">Secure room</span>
            <span className="inline-flex items-center gap-2 text-xs font-semibold">
              {connected ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {connected ? "Ready" : pap.state}
            </span>
          </div>
          {pap.session?.desktopDeviceName ? (
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{pap.session.desktopDeviceName}</p>
          ) : null}
        </section>

        <section
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
          className={`mt-5 flex flex-1 flex-col items-center justify-center rounded-md border border-dashed p-6 text-center ${
            isDragging ? "border-[var(--color-brand-accent)] bg-[var(--color-card-sky)]" : "border-[var(--color-brand-border)] bg-[var(--color-brand-panel)]"
          }`}
        >
          <ImagePlus className="h-14 w-14 text-[var(--color-brand-accent)]" />
          <h2 className="mt-5 text-xl font-semibold">Choose Screenshot</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            Select one or more images. Files will be named PAP_YYYYMMDD_X automatically.
          </p>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={180}
            placeholder="Optional note for this batch"
            className="mt-5 w-full resize-none rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-3 py-2 text-sm"
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
            className="pressable mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-brand-accent)] px-5 py-4 text-base font-semibold text-white disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
            Choose or Take Screenshot
          </button>
        </section>

        {activeProgress ? (
          <div className="mt-5 rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">
                Uploading {activeProgress.batchIndex} / {activeProgress.batchTotal}
              </span>
              <span className="text-[var(--color-text-secondary)]">
                {percent(activeProgress.sentBytes, activeProgress.totalBytes)}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-brand-panel-alt)]">
              <div
                className="h-full rounded-full bg-[var(--color-brand-accent)] transition-[width] duration-200"
                style={{ width: `${percent(activeProgress.sentBytes, activeProgress.totalBytes)}%` }}
              />
            </div>
          </div>
        ) : null}

        {sentCount > 0 ? (
          <div className="mt-5 rounded-md border border-green-200 bg-green-50 p-4 text-center text-sm font-semibold text-green-700">
            {sentCount} screenshot{sentCount === 1 ? "" : "s"} sent. You can choose more.
          </div>
        ) : null}

        {pap.error ? (
          <div className="mt-5 flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{pap.error}</p>
          </div>
        ) : null}

        {pap.progress.length > 0 ? (
          <section className="mt-5 space-y-3">
            {pap.progress.map((item) => (
              <div key={item.transferId} className="rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-semibold">{item.fileName}</span>
                  <span className="shrink-0 text-[var(--color-text-secondary)]">
                    {item.done ? "Done" : `${percent(item.sentBytes, item.totalBytes)}%`}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-brand-panel-alt)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-brand-accent)] transition-[width] duration-200"
                    style={{ width: `${percent(item.sentBytes, item.totalBytes)}%` }}
                  />
                </div>
              </div>
            ))}
          </section>
        ) : null}
        <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
      </div>
    </main>
  );
}
