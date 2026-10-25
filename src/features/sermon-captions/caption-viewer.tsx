"use client";

import { useEffect, useState } from "react";

type CaptionLine = { line: number; english: string; final: boolean };
type Feed = { status: "connecting" | "live" | "interrupted" | "error" | "ended"; lines: CaptionLine[]; expiresAt?: string };

export default function CaptionViewer({ sessionId }: { sessionId: string }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [state, setState] = useState("Connecting to captions…");
  const [viewerConnectionError, setViewerConnectionError] = useState(false);

  useEffect(() => {
    let active = true;
    let expiryTimer: number | undefined;
    async function refresh() {
      try {
        const response = await fetch(`/api/captions/live/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 404 ? "Caption link not found." : "Could not load captions.");
        const current = await response.json() as Feed;
        if (!active) return;
        setViewerConnectionError(false);
        setFeed(current);
        if (current.status !== "ended") {
          setState(current.status === "live" ? "Live English captions"
            : current.status === "connecting" ? "Captions are starting."
              : current.status === "interrupted" ? "Connection interrupted. Captions should return shortly."
                : "Captions are unavailable. The booth team needs to check the connection.");
        } else {
          window.clearInterval(timer);
          if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
          if (current.lines.length && current.expiresAt) {
            const availableUntil = new Date(current.expiresAt);
            setState(`Broadcast ended · captions available until ${availableUntil.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
            expiryTimer = window.setTimeout(() => {
              if (!active) return;
              setFeed({ status: "ended", lines: [] });
              setState("Captions are no longer available.");
            }, Math.max(0, availableUntil.getTime() - Date.now()));
          } else {
            setState("Captions are no longer available.");
          }
        }
      } catch (error) {
        if (active) {
          setViewerConnectionError(true);
          setState(error instanceof Error && error.message === "Caption link not found."
            ? error.message : "Your connection to captions was interrupted. Retrying…");
        }
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => { active = false; window.clearInterval(timer); if (expiryTimer !== undefined) window.clearTimeout(expiryTimer); };
  }, [sessionId]);

  return <main className="min-h-screen bg-[var(--rail-surface-canvas)] px-4 py-8 text-[var(--rail-text-primary)] sm:px-8">
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Sermon Captions</h1>
      <p className={`mt-4 font-medium ${viewerConnectionError || feed?.status === "interrupted" || feed?.status === "error" ? "rounded-lg border border-[var(--rail-border-strong)] bg-[var(--rail-surface-panel)] p-4 text-base text-[var(--rail-text-primary)]" : "text-sm text-[var(--rail-text-secondary)]"}`} role="status">{state}</p>
      <div className="mt-8 space-y-4" aria-live="polite" aria-relevant="additions text">
        {feed?.lines.length ? feed.lines.map((item, index) => <p key={item.line} className={`border-b border-[var(--rail-border-default)] pb-4 text-2xl leading-snug transition-opacity duration-300 sm:text-3xl ${index >= 9 ? "opacity-30" : index >= 8 ? "opacity-50" : index >= 7 || !item.final ? "opacity-75" : "opacity-100"}`}>{item.english}</p>)
          : <p className="text-xl text-[var(--rail-text-secondary)]">{feed?.status === "ended" ? "Captions are no longer available." : "Waiting for speech…"}</p>}
      </div>
    </div>
  </main>;
}
