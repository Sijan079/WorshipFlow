"use client";

import { useEffect, useState } from "react";
import { fetchCaptionLink, regenerateCaptionLink, type CaptionLinkInfo } from "./caption-session-api";
import { dataUrlToBytes, viewerLinkUrl } from "./caption-link";

type Notify = (message: string, tone: "success" | "error") => void;
type Link = { url: string; rotatedAt: string | null; canRegenerate: boolean };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Caption link request failed.";
}

function toLink(info: CaptionLinkInfo): Link {
  return { url: viewerLinkUrl(window.location.origin, info.token), rotatedAt: info.rotatedAt, canRegenerate: info.canRegenerate };
}

// Loads the church's one listener link while the Share dialog is open, copies it, and replaces it.
// It renders nothing; the dialog draws what it returns.
export function useCaptionLink({ enabled, notify }: { enabled: boolean; notify: Notify }) {
  const [link, setLink] = useState<Link | null>(null);
  const [error, setError] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void fetchCaptionLink()
      .then((info) => { if (active) { setLink(toLink(info)); setError(""); } })
      .catch((failure) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [enabled]);

  function copyLink() {
    if (!link) return Promise.resolve();
    return navigator.clipboard.writeText(link.url).then(
      () => notify("Link copied.", "success"),
      () => notify("Could not copy the link.", "error"),
    );
  }

  // The QR code goes on the clipboard as a PNG image. Not every browser allows that, so a failure
  // points to the download instead.
  async function copyQr(qr: string) {
    try {
      const { type, bytes } = dataUrlToBytes(qr);
      const blob = new Blob([bytes as BlobPart], { type });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      notify("QR code copied.", "success");
    } catch {
      notify("Could not copy the QR code. Use Download QR instead.", "error");
    }
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      setLink(toLink(await regenerateCaptionLink()));
      notify("New link created. Download or print the new QR code.", "success");
    } catch (failure) {
      notify(errorMessage(failure), "error");
    } finally {
      setRegenerating(false);
    }
  }

  return { link, loading: enabled && !link && !error, error, regenerating, copyLink, copyQr, regenerate };
}
