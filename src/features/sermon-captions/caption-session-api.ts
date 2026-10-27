import { apiFetch, workspaceApiPath } from "@/lib/api-client";
import type { CaptionUpdate } from "./caption-contract";

// Every call the captions screen makes to our own server. No React in here.

export type CaptionSession = { id: string; operatorUserId?: string; createdAt: string; expiresAt: string; canManage?: boolean; lastLine?: number };
export type CaptionLine = { line: number; english: string; final: boolean };
export type StartedSession = { session: CaptionSession; operatorToken: string; deepgramToken: string };
export type PresenceStatus = "CONNECTING" | "STREAMING" | "INTERRUPTED" | "ERROR";

const OPERATOR_TOKEN_HEADER = "x-caption-operator-token";

function operatorHeaders(token: string | undefined) {
  return token ? { [OPERATOR_TOKEN_HEADER]: token } : undefined;
}

export type CaptionLinkInfo = { token: string; url: string; rotatedAt: string | null; canRegenerate: boolean };

export function fetchActiveSession() {
  return apiFetch<{ session: CaptionSession | null; canOperate: boolean; canShare: boolean; canRegenerate: boolean; devAgainstLiveDatabase: boolean }>("/api/caption-sessions");
}

// The church's one listener link. Needs View captions and the Share captions link grant.
export function fetchCaptionLink() {
  return apiFetch<CaptionLinkInfo>("/api/caption-link");
}

// Owner and Admin only, and refused while captions run.
export function regenerateCaptionLink() {
  return apiFetch<CaptionLinkInfo>("/api/caption-link/regenerate", { method: "POST" });
}

export function startSession() {
  return apiFetch<StartedSession>("/api/caption-sessions", { method: "POST" });
}

export function stopSession(sessionId: string, operatorToken?: string) {
  return apiFetch(`/api/caption-sessions/${sessionId}/stop`, { method: "POST", headers: operatorHeaders(operatorToken) });
}

// Used when the page is closing: the request must survive the page going away.
export function stopSessionOnLeave(sessionId: string, operatorToken: string) {
  void fetch(workspaceApiPath(`/api/caption-sessions/${sessionId}/stop`), {
    method: "POST", headers: { [OPERATOR_TOKEN_HEADER]: operatorToken }, keepalive: true,
  });
}

export async function publishLine(sessionId: string, operatorToken: string, update: CaptionUpdate) {
  const result = await apiFetch<{ line: CaptionLine }>(`/api/caption-sessions/${sessionId}/lines`, {
    method: "POST",
    headers: { [OPERATOR_TOKEN_HEADER]: operatorToken },
    body: JSON.stringify(update),
    signal: AbortSignal.timeout(15_000),
  });
  return result.line;
}

export async function fetchDeepgramToken(sessionId: string, operatorToken: string) {
  const response = await apiFetch<{ deepgramToken: string }>(`/api/caption-sessions/${sessionId}/token`, {
    method: "POST", headers: { [OPERATOR_TOKEN_HEADER]: operatorToken }, signal: AbortSignal.timeout(10_000),
  });
  return response.deepgramToken;
}

// A missed heartbeat is not an error: the public feed detects stale heartbeats during an outage.
export function sendPresence(sessionId: string, operatorToken: string, state: PresenceStatus, sequence: number) {
  void fetch(workspaceApiPath(`/api/caption-sessions/${sessionId}/presence`), {
    method: "POST",
    headers: { "Content-Type": "application/json", [OPERATOR_TOKEN_HEADER]: operatorToken },
    body: JSON.stringify({ state, sequence }),
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  }).catch(() => { /* See above. */ });
}
