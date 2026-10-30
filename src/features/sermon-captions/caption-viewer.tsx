"use client";

import { useEffect, useState } from "react";
import type { CaptionPublicStatus } from "./caption-contract";
import { viewerPollMs } from "./caption-link";

type CaptionLine = { line: number; english: string; final: boolean };
type Feed = { status: CaptionPublicStatus; lines: CaptionLine[]; churchName?: string; expiresAt?: string };
type Problem = "none" | "connection" | "invalid";

function describe(feed: Feed | null, problem: Problem) {
  if (problem === "invalid") return "This caption link is not valid. Ask the church for the current link or QR code.";
  if (problem === "connection") return "Your connection to captions was interrupted. Retrying…";
  if (!feed) return "Connecting to captions…";
  switch (feed.status) {
    case "waiting": return "Captions will start when the service begins. This page updates by itself.";
    case "paused": return "Captions are paused. They will continue shortly.";
    case "connecting": return "Captions are starting.";
    case "live": return "Live English captions";
    case "interrupted": return "Connection interrupted. Captions should return shortly.";
    case "error": return "Captions are unavailable. The booth team needs to check the connection.";
    default: {
      if (!feed.lines.length || !feed.expiresAt) return "Captions will start when the service begins. This page updates by itself.";
      const until = new Date(feed.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return `Broadcast ended · captions available until ${until}`;
    }
  }
}

export default function CaptionViewer({ token }: { token: string }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [problem, setProblem] = useState<Problem>("none");

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let latest: CaptionPublicStatus | undefined;

    // The page keeps asking after a session ends, slowly, so it returns by itself when the next one
    // starts. It stops only while the tab is hidden, or when the link itself is not valid.
    function schedule() {
      if (!active || document.hidden) return;
      timer = window.setTimeout(() => void refresh(), viewerPollMs(latest));
    }
    async function refresh() {
      window.clearTimeout(timer);
      try {
        const response = await fetch(`/api/captions/live/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (!active) return;
        if (response.status === 404) { setProblem("invalid"); return; }
        if (!response.ok) throw new Error("Could not load captions.");
        const current = await response.json() as Feed;
        if (!active) return;
        latest = current.status;
        setFeed(current);
        setProblem("none");
      } catch {
        if (active) setProblem("connection");
      }
      schedule();
    }
    function onVisibility() {
      if (document.hidden) window.clearTimeout(timer);
      else void refresh();
    }

    document.addEventListener("visibilitychange", onVisibility);
    void refresh();
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token]);

  const attention = problem !== "none" || feed?.status === "interrupted" || feed?.status === "error";

  return <main className="min-h-screen bg-[var(--rail-surface-canvas)] px-4 py-8 text-[var(--rail-text-primary)] sm:px-8">
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">{feed?.churchName ?? "Sermon Captions"}</h1>
      {feed?.churchName ? <p className="mt-1 text-base text-[var(--rail-text-secondary)]">Live English captions</p> : null}
      <p className={`mt-4 font-medium ${attention ? "rounded-lg border border-[var(--rail-border-strong)] bg-[var(--rail-surface-panel)] p-4 text-base text-[var(--rail-text-primary)]" : "text-base text-[var(--rail-text-secondary)]"}`} role="status">{describe(feed, problem)}</p>
      <div className="mt-8 space-y-4" aria-live="polite" aria-relevant="additions text">
        {feed?.lines.length
          ? feed.lines.map((item, index) => <p key={item.line} className={`border-b border-[var(--rail-border-default)] pb-4 leading-snug ${index === 0 ? "text-3xl font-medium text-[var(--rail-text-primary)] sm:text-4xl" : "text-2xl text-[var(--rail-text-secondary)] sm:text-3xl"}`}>{item.english}</p>)
          : feed?.status === "live" ? <p className="text-xl text-[var(--rail-text-secondary)]">Waiting for speech…</p> : null}
      </div>
    </div>
  </main>;
}
