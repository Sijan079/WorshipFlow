export const DRAFT_TTL_MS = 60 * 60 * 1000;
export const CONNECTION_GRACE_MS = 5 * 60 * 1000;
export const HEARTBEAT_MS = 30 * 1000;
type Lease = { expiresAt: number | null; lastSeenAt: number; sessionId: string | null; revision: number };
export function draftDeadline(draft: Pick<Lease, "expiresAt" | "lastSeenAt">) {
  return draft.expiresAt ?? draft.lastSeenAt + CONNECTION_GRACE_MS + DRAFT_TTL_MS;
}
export function draftExpired(draft: Pick<Lease, "expiresAt" | "lastSeenAt">, now: number) {
  return now >= draftDeadline(draft);
}
export function mayWriteDraft(draft: Lease, sessionId: string, revision: number, now: number) {
  return !draftExpired(draft, now) && draft.sessionId === sessionId && draft.revision === revision;
}
