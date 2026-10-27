import type { Prisma } from "@prisma/client";

export type CaptionUpdate = { line: number; source: string; final: boolean; recognitionMs?: number };
export type CaptionDisplayLine = { line: number; english: string; final: boolean };
export const CAPTION_RETENTION_MS = 60 * 60 * 1000;
export const CAPTION_HEARTBEAT_STALE_MS = 15_000;

export type CaptionPublicStatus = "waiting" | "connecting" | "live" | "interrupted" | "error" | "ended";

// A session that has sent no heartbeat for this long is treated as dead, so Start may take it over.
export const CAPTION_TAKEOVER_STALE_MS = 2 * 60 * 1000;

export function isTakeoverStale(lastHeartbeatAt: Date, now = new Date()) {
  return now.getTime() - lastHeartbeatAt.getTime() >= CAPTION_TAKEOVER_STALE_MS;
}

export type CaptionAvailability = { kind: "live" } | { kind: "retained"; until: Date } | { kind: "gone" };

// What a listener may see of a session: the live feed, or its last lines for one hour after it ends.
// A live session past its four-hour limit is retained from that limit, like one that was stopped.
export function sessionAvailability(session: { status: string; expiresAt: Date }, now = new Date()): CaptionAvailability {
  if (session.status === "LIVE" && session.expiresAt.getTime() > now.getTime()) return { kind: "live" };
  const until = session.status === "LIVE" ? retainedCaptionExpiry(session.expiresAt) : session.expiresAt;
  return until.getTime() > now.getTime() ? { kind: "retained", until } : { kind: "gone" };
}

// The church has one link, so the viewer follows whichever session is live, else the latest one
// still inside its hold. Nothing at all means "waiting".
export function selectViewerSession<T extends { status: string; expiresAt: Date; createdAt: Date }>(sessions: T[], now = new Date()) {
  const available = sessions
    .map((session) => ({ session, availability: sessionAvailability(session, now) }))
    .filter((entry) => entry.availability.kind !== "gone");
  const live = available.find((entry) => entry.availability.kind === "live");
  if (live) return live;
  return available.sort((a, b) => b.session.createdAt.getTime() - a.session.createdAt.getTime())[0] ?? null;
}

export function captionViewerStatus(
  session: { status: string; expiresAt: Date; connectionStatus: string; lastHeartbeatAt: Date },
  now = new Date(),
): CaptionPublicStatus {
  if (!canReadCaptionSession(session, now)) return "ended";
  if (session.connectionStatus === "ERROR") return "error";
  if (now.getTime() - session.lastHeartbeatAt.getTime() >= CAPTION_HEARTBEAT_STALE_MS) return "interrupted";
  if (session.connectionStatus === "CONNECTING") return "connecting";
  return session.connectionStatus === "STREAMING" ? "live" : "interrupted";
}

export function retainedCaptionExpiry(stoppedAt: Date) {
  return new Date(stoppedAt.getTime() + CAPTION_RETENTION_MS);
}

export function latestCaptionLines(previous: CaptionDisplayLine[], update: CaptionDisplayLine) {
  return [...previous.filter((item) => item.line !== update.line), update]
    .sort((a, b) => b.line - a.line)
    .slice(0, 10);
}

type DeepgramResult = {
  is_final?: boolean;
  speech_final?: boolean;
  channel?: { alternatives?: Array<{ transcript?: string }> };
};

function splitTranscript(value: string) {
  const pieces: string[] = [];
  let remaining = value;
  while (remaining.length > 200) {
    const space = remaining.lastIndexOf(" ", 200);
    const cut = space >= 100 ? space : 200;
    pieces.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

export function normalizeCaptionSource(value: string) {
  const source = value.trim().replace(/\s+/g, " ").replace(/\bJeda\b/gi, "Jeddah");
  return source.length > 0 && source.length <= 300 ? source : null;
}

export function canReadCaptionSession(session: { status: string; expiresAt: Date }, now = new Date()) {
  return session.status === "LIVE" && session.expiresAt.getTime() > now.getTime();
}

export class CaptionAssembler {
  private parts: string[] = [];
  private line = 0;

  // After a reload, numbering continues after the last stored line: the server ignores a line number
  // that is already final, so starting again at 1 would drop every resumed caption.
  constructor(startAfterLine = 0) {
    this.line = startAfterLine;
  }

  accept(result: DeepgramResult): CaptionUpdate[] {
    const updates: CaptionUpdate[] = [];
    const transcript = result.channel?.alternatives?.[0]?.transcript?.trim();
    if (result.is_final && transcript) {
      const pieces = splitTranscript(transcript);
      pieces.forEach((piece, index) => {
        if (this.parts.length && [...this.parts, piece].join(" ").length > 200) {
          updates.push({ line: this.line, source: this.parts.join(" "), final: true });
          this.parts = [];
        }
        if (this.parts.length === 0) this.line += 1;
        this.parts.push(piece);
        if (index < pieces.length - 1) {
          updates.push({ line: this.line, source: this.parts.join(" "), final: true });
          this.parts = [];
        }
      });
    }
    if (this.parts.length > 0 && (result.is_final || result.speech_final)) {
      updates.push({ line: this.line, source: this.parts.join(" "), final: Boolean(result.speech_final) });
    }
    if (result.speech_final) this.parts = [];
    return updates;
  }

  flush(): CaptionUpdate[] {
    if (!this.parts.length) return [];
    const update = { line: this.line, source: this.parts.join(" "), final: true };
    this.parts = [];
    return [update];
  }
}

// How long the public feed may be cached at the edge. A second while captions flow keeps the delay
// small; ten seconds while waiting or ended; thirty for a link that does not exist. There is no
// stale-while-revalidate while waiting, because it would delay the moment "Live" appears.
export function feedCacheControl(status: CaptionPublicStatus | "invalid") {
  if (status === "invalid") return "public, s-maxage=30";
  if (status === "waiting" || status === "ended") return "public, s-maxage=10";
  return "public, s-maxage=1, stale-while-revalidate=1";
}

// The sessions whose lines the feed no longer serves: ended ones past their hour, and live ones past
// their limit plus the hour. The daily job erases exactly these (see sessionAvailability).
export function expiredCaptionSessionFilter(now = new Date()): Prisma.CaptionSessionWhereInput {
  return {
    OR: [
      { status: "ENDED", expiresAt: { lte: now } },
      { status: "LIVE", expiresAt: { lte: new Date(now.getTime() - CAPTION_RETENTION_MS) } },
    ],
  };
}
