export type CaptionUpdate = { line: number; source: string; final: boolean };
export type CaptionDisplayLine = { line: number; english: string; final: boolean };
export const CAPTION_RETENTION_MS = 60 * 60 * 1000;
export const CAPTION_HEARTBEAT_STALE_MS = 15_000;

export type CaptionPublicStatus = "connecting" | "live" | "interrupted" | "error" | "ended";

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
