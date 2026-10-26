"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Props = {
  link: { url: string; canRegenerate: boolean } | null;
  loading: boolean;
  error: string;
  running: boolean;
  regenerating: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  notify: (message: string, tone: "success" | "error") => void;
  onClose: () => void;
};

// The church's one listener link as text and as a QR code. The QR code is drawn here in the
// browser, so the link never goes to another service. Render it only while it is open.
export default function ShareDialog({ link, loading, error, running, regenerating, onCopy, onRegenerate, notify, onClose }: Props) {
  const [qr, setQr] = useState("");
  const [confirming, setConfirming] = useState(false);
  const url = link?.url ?? "";

  useEffect(() => {
    if (!url) return;
    let active = true;
    void QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: "M" })
      .then((image) => { if (active) setQr(image); })
      .catch(() => { if (active) setQr(""); });
    return () => { active = false; };
  }, [url]);

  function askToRegenerate() {
    if (running) {
      notify("Stop captions before regenerating the link.", "error");
      return;
    }
    setConfirming(true);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Share captions</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
              Anyone with this link or QR code can read the captions while they are live. The link stays the same from week to week.
            </DialogDescription>
          </div>
          <button type="button" onClick={onClose} className="ui-modal-close pressable" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {error ? <p role="alert" className="text-sm text-[var(--text-danger)]">{error}</p> : null}
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" />Loading the link…</p>
          ) : null}
          {link ? (
            <>
              <div className="flex justify-center rounded-[var(--radius-card)] border border-[var(--border-default)] bg-white p-3">
                {/* A data URL made in the browser: there is nothing for the image optimizer to fetch. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qr ? <img src={qr} alt="QR code for the captions link" width={256} height={256} className="h-64 w-64" /> : <div className="h-64 w-64" aria-hidden="true" />}
              </div>
              <p className="break-all text-sm text-[var(--text-primary)]">{link.url}</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={onCopy} className="ui-btn-secondary pressable min-h-11 px-4 text-sm font-semibold">Copy link</button>
                {qr ? (
                  <a href={qr} download="captions-link-qr.png" className="ui-btn-secondary pressable inline-flex min-h-11 items-center px-4 text-sm font-semibold">Download QR</a>
                ) : null}
              </div>

              {link.canRegenerate ? (
                <div className="border-t border-[var(--rule-default)] pt-4">
                  {confirming ? (
                    <div className="space-y-3">
                      <p className="text-sm text-[var(--text-primary)]">
                        Create a new link? Anyone with the old link or a printed QR code will stop getting captions.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => setConfirming(false)} className="ui-btn-cancel pressable min-h-11 px-4 text-sm font-semibold">Cancel</button>
                        <button
                          type="button"
                          disabled={regenerating}
                          onClick={() => { setConfirming(false); onRegenerate(); }}
                          className="ui-btn-primary pressable inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
                        >
                          {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Regenerate link
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={askToRegenerate}
                      aria-disabled={running}
                      className={`ui-btn-secondary pressable min-h-11 px-4 text-sm font-semibold ${running ? "opacity-60" : ""}`}
                    >
                      Regenerate link
                    </button>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
