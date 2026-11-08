import type { Prisma } from "@prisma/client";

export type CaptionUpdate = { line: number; source: string; final: boolean; recognitionMs?: number };
export type CaptionDisplayLine = { line: number; english: string; final: boolean };
export const CAPTION_RETENTION_MS = 60 * 60 * 1000;
export const CAPTION_HEARTBEAT_STALE_MS = 15_000;

// A session runs for four hours. In the last fifteen minutes the operator is offered four more.
export const CAPTION_SESSION_MS = 4 * 60 * 60 * 1000;
export const EXTEND_WINDOW_MS = 15 * 60 * 1000;

export function extensionWindowOpen(expiresAt: Date, now = new Date()) {
  const left = expiresAt.getTime() - now.getTime();
  return left > 0 && left <= EXTEND_WINDOW_MS;
}

export function extendedExpiresAt(expiresAt: Date) {
  return new Date(expiresAt.getTime() + CAPTION_SESSION_MS);
}

export type CaptionPublicStatus = "waiting" | "connecting" | "live" | "paused" | "interrupted" | "error" | "ended";

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
  session: { status: string; expiresAt: Date; connectionStatus: string; lastHeartbeatAt: Date; paused?: boolean },
  now = new Date(),
): CaptionPublicStatus {
  if (!canReadCaptionSession(session, now)) return "ended";
  if (session.connectionStatus === "ERROR") return "error";
  if (now.getTime() - session.lastHeartbeatAt.getTime() >= CAPTION_HEARTBEAT_STALE_MS) return "interrupted";
  if (session.paused) return "paused";
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

// A caption line is one sentence where possible. Lines are closed by, whichever comes first:
//   1. a sentence ending (. ? !) in the recognized text,
//   2. a long pause with nothing new (the line is closed by closeIfIdle),
//   3. a line that has been open too long, or is too long to read (200 characters).
// A short pause alone does not close a line, because speakers pause in the middle of a sentence and the
// translation needs the whole sentence for context.
export const LINE_MAX_CHARS = 200;
export const LINE_LONG_PAUSE_MS = 1_500;
export const LINE_MAX_OPEN_MS = 8_000;

const SENTENCE_END = /[.?!…]["'”’)\]]*$/;

function endsSentence(text: string) {
  return SENTENCE_END.test(text.trim());
}

// Where to cut text that is too long: after the last comma, or before the last common joining word
// (Filipino and English), if one is in the second half of the window; otherwise at the last space.
const JOINING_WORDS = /\s(?=(?:at|pero|kasi|dahil|kaya|ngunit|and|but|because|so|that|which|then)\s)/gi;

function findCut(window: string, minimum: number) {
  let best = -1;
  const comma = window.lastIndexOf(", ");
  if (comma + 1 >= minimum) best = comma + 1;
  for (const match of window.matchAll(JOINING_WORDS)) {
    if (match.index >= minimum && match.index > best) best = match.index;
  }
  if (best >= minimum) return best;
  const space = window.lastIndexOf(" ");
  return space >= minimum ? space : LINE_MAX_CHARS;
}

function splitTranscript(value: string) {
  const pieces: string[] = [];
  let remaining = value;
  while (remaining.length > LINE_MAX_CHARS) {
    const cut = findCut(remaining.slice(0, LINE_MAX_CHARS + 1), 100);
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
  private lineStartedAt = 0;
  private lastActivityAt = 0;
  private lastSent = "";
  private readonly clock: () => number;

  // After a reload, numbering continues after the last stored line: the server ignores a line number
  // that is already final, so starting again at 1 would drop every resumed caption.
  constructor(startAfterLine = 0, clock: () => number = Date.now) {
    this.line = startAfterLine;
    this.clock = clock;
  }

  accept(result: DeepgramResult): CaptionUpdate[] {
    const updates: CaptionUpdate[] = [];
    const transcript = result.channel?.alternatives?.[0]?.transcript?.trim();
    if (result.is_final && transcript) {
      const now = this.clock();
      this.lastActivityAt = now;
      const pieces = splitTranscript(transcript);
      pieces.forEach((piece, index) => {
        if (this.parts.length && [...this.parts, piece].join(" ").length > LINE_MAX_CHARS) {
          updates.push(this.close());
        }
        if (this.parts.length === 0) {
          this.line += 1;
          this.lineStartedAt = now;
        }
        this.parts.push(piece);
        if (index < pieces.length - 1) updates.push(this.close());
      });
    }
    if (this.parts.length > 0 && (result.is_final || result.speech_final)) {
      const source = this.parts.join(" ");
      // Only a sentence ending closes the line here; a pause on its own leaves it open.
      if (result.is_final && endsSentence(source)) updates.push(this.close());
      else if (source !== this.lastSent) updates.push(this.send(source, false));
    }
    return updates;
  }

  // Called on a timer. Closes the open line after a long pause, or when it has been open too long, so a
  // speaker who never ends a sentence still gets captions that move on.
  closeIfIdle(): CaptionUpdate[] {
    if (!this.parts.length) return [];
    const now = this.clock();
    if (now - this.lastActivityAt >= LINE_LONG_PAUSE_MS || now - this.lineStartedAt >= LINE_MAX_OPEN_MS) return [this.close()];
    return [];
  }

  flush(): CaptionUpdate[] {
    return this.parts.length ? [this.close()] : [];
  }

  private close(): CaptionUpdate {
    const update = this.send(this.parts.join(" "), true);
    this.parts = [];
    this.lastSent = "";
    return update;
  }

  private send(source: string, final: boolean): CaptionUpdate {
    this.lastSent = source;
    return { line: this.line, source, final };
  }
}

// How long the public feed may be cached at the edge. A second while captions flow keeps the delay
// small; ten seconds while waiting; a minute once ended, because an ended session no longer changes;
// thirty for a link that does not exist. There is no stale-while-revalidate while waiting, because it
// would delay the moment "Live" appears.
export function feedCacheControl(status: CaptionPublicStatus | "invalid") {
  if (status === "invalid") return "public, s-maxage=30";
  if (status === "ended") return "public, s-maxage=60";
  if (status === "waiting") return "public, s-maxage=10";
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
