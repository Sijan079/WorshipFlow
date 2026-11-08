import { latestCaptionLines, type CaptionDisplayLine } from "./caption-contract.ts";
import { isViewerToken } from "./caption-link.ts";

// Pushing captions to listeners' phones. The server sends each saved line on a private Realtime
// Broadcast channel named after the church's listener link token; the phone listens and shows it at
// once. Polling stays as a slower safety net for a dropped connection.

export const CAPTION_BROADCAST_EVENT = "caption-line";

// The channel is named after the secret link token, never the session id, so only people who hold the
// link can find it. The database policy in prisma/migrations (captions_realtime_policy) matches this prefix.
export const CAPTION_TOPIC_PREFIX = "captions:";

export function captionTopic(viewerToken: string) {
  if (!isViewerToken(viewerToken)) throw new Error("Not a valid caption link token.");
  return `${CAPTION_TOPIC_PREFIX}${viewerToken}`;
}

// A pushed message is data from the network: accept only the three fields, with the right types.
export function parsePushedLine(payload: unknown): CaptionDisplayLine | null {
  if (!payload || typeof payload !== "object") return null;
  const { line, english, final } = payload as Record<string, unknown>;
  if (typeof line !== "number" || !Number.isInteger(line) || line < 1 || line > 2400) return null;
  if (typeof english !== "string" || english.length > 2000) return null;
  if (typeof final !== "boolean") return null;
  return { line, english, final };
}

// A pushed line may arrive out of order, or after a newer poll already has it. A final line is never
// replaced by an interim one for the same line number.
export function applyPushedLine(current: CaptionDisplayLine[], pushed: CaptionDisplayLine) {
  const existing = current.find((item) => item.line === pushed.line);
  if (existing?.final && !pushed.final) return current;
  return latestCaptionLines(current, pushed);
}

// What the phone shows: the polled lines with pushed lines laid over them. Pushed lines are newer than the
// poll (which can be a second or more stale), but a final polled line is never replaced by an interim one.
// If the pushed lines are far ahead of the poll, a new session has started, so they are ignored.
export function overlayPushedLines(polled: CaptionDisplayLine[], pushed: CaptionDisplayLine[]) {
  const polledNewest = polled.reduce((max, item) => Math.max(max, item.line), 0);
  const pushedNewest = pushed.reduce((max, item) => Math.max(max, item.line), 0);
  if (!pushed.length || (polledNewest > 0 && pushedNewest > polledNewest + 10)) return polled;
  return pushed.reduce((lines, item) => applyPushedLine(lines, item), polled);
}

// A pushed line far below the newest one pushed so far means a new session began (line numbers restart),
// so earlier pushed lines are dropped.
export function addPushedLine(pushed: CaptionDisplayLine[], incoming: CaptionDisplayLine) {
  const newest = pushed.reduce((max, item) => Math.max(max, item.line), 0);
  return applyPushedLine(incoming.line < newest - 10 ? [] : pushed, incoming);
}

// While pushes are connected the page polls only as a safety net; otherwise it polls as before.
export const PUSH_FALLBACK_POLL_MS = 5_000;

type BroadcastEnv = { url?: string; secretKey?: string };

// Server side. Sends one line to the church's channel with the secret key, so only the server can
// send. It never throws: a failed push must not fail the caption, because polling still delivers it.
export async function broadcastCaptionLine(viewerToken: string, line: CaptionDisplayLine, env: BroadcastEnv, fetchImpl: typeof fetch = fetch) {
  if (!env.url || !env.secretKey) return false;
  try {
    const response = await fetchImpl(`${env.url.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: env.secretKey, Authorization: `Bearer ${env.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: captionTopic(viewerToken), event: CAPTION_BROADCAST_EVENT, payload: { line: line.line, english: line.english, final: line.final }, private: true }] }),
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
