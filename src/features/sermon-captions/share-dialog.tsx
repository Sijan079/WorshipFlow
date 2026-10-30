"use client";

import { useEffect, useState } from "react";
import { Copy, Download, Link2, Loader2, QrCode, RefreshCw, X } from "lucide-react";
import QRCode from "qrcode";
import { Collapsible } from "radix-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  link: { url: string; canRegenerate: boolean } | null;
  loading: boolean;
  error: string;
  running: boolean;
  regenerating: boolean;
  onCopyLink: () => void;
  onCopyQr: (qr: string) => void;
  onRegenerate: () => void;
  notify: (message: string, tone: "success" | "error") => void;
  onClose: () => void;
};

// Quiet icon-only controls: no fill and no border, with a label and a tooltip because they have no words.
const ICON_BUTTON = "pressable inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] border-0 bg-transparent px-0 text-[var(--text-secondary)] shadow-none hover:text-[var(--text-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]";

// The church's one listener link as a QR code. The link is not shown as text; the copy menu puts it
// (or the QR image) on the clipboard. The QR code is drawn here in the
// browser, so the link never goes to another service. Render it only while it is open.
export default function ShareDialog({ link, loading, error, running, regenerating, onCopyLink, onCopyQr, onRegenerate, notify, onClose }: Props) {
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
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Share Captions</DialogTitle>
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
            <div role="status" aria-label="Loading the link" className="space-y-3"><Skeleton className="h-11 w-full" /><Skeleton className="mx-auto size-40" /></div>
          ) : null}
          {link ? (
            <>
              <div className="flex justify-center">
                {/* A data URL made in the browser: there is nothing for the image optimizer to fetch. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qr ? <img src={qr} alt="QR code for the captions link" width={256} height={256} className="h-64 w-64 bg-white" /> : <div className="h-64 w-64" aria-hidden="true" />}
              </div>
              <div className="flex items-center justify-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label="Copy link or QR code" title="Copy link or QR code" className={ICON_BUTTON}>
                      <Copy className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" sideOffset={4} className="workspace-content-light ui-action-menu-content z-[70] w-44">
                    <DropdownMenuItem onSelect={onCopyLink} className="ui-action-menu-item min-h-11 gap-2 px-2">
                      <Link2 className="h-4 w-4" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onCopyQr(qr)} disabled={!qr} className="ui-action-menu-item min-h-11 gap-2 px-2">
                      <QrCode className="h-4 w-4" />
                      Copy QR
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {qr ? (
                  <a href={qr} download="captions-link-qr.png" aria-label="Download QR" title="Download QR" className={ICON_BUTTON}>
                    <Download className="h-5 w-5" />
                  </a>
                ) : null}
              </div>

              {link.canRegenerate ? (
                <div className="border-t border-[var(--rule-default)] pt-4">
                  {confirming ? null : (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={askToRegenerate}
                        aria-disabled={running}
                        disabled={regenerating}
                        className={`ui-btn-secondary pressable inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60 ${running ? "opacity-60" : ""}`}
                      >
                        {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Regenerate link
                      </button>
                    </div>
                  )}
                  <Collapsible.Root open={confirming}>
                    <Collapsible.Content className="ui-collapsible-content">
                      <div className="space-y-3 pt-4">
                        <p className="text-sm text-[var(--text-primary)]">
                          Create a new link? Anyone with the old link or a printed QR code will stop getting captions.
                        </p>
                        <div className="flex flex-wrap justify-end gap-3">
                          <button type="button" autoFocus onClick={() => setConfirming(false)} className="ui-btn-cancel pressable min-h-11 px-4 text-sm font-semibold">Cancel</button>
                          <button
                            type="button"
                            disabled={regenerating}
                            onClick={() => { setConfirming(false); onRegenerate(); }}
                            className="ui-btn-primary pressable min-h-11 px-4 text-sm font-semibold disabled:opacity-60"
                          >
                            Yes, I am sure
                          </button>
                        </div>
                      </div>
                    </Collapsible.Content>
                  </Collapsible.Root>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
