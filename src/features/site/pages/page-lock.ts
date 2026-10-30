// One person edits a page at a time. The editor renews its claim every 20 seconds; a claim that is not renewed
// for this long is ignored, so a closed laptop or a lost connection never keeps a page locked for more than a minute.
export const LOCK_SECONDS = 60;
export const LOCK_RENEW_SECONDS = 20;

export type LockStatus = "free" | "mine" | "other";

export function lockStatus(page: { lockedById: string | null; lockedAt: Date | null }, userId: string, now: Date): LockStatus {
  if (!page.lockedById || !page.lockedAt) return "free";
  if (page.lockedAt.getTime() <= lockExpiry(now).getTime()) return "free";
  return page.lockedById === userId ? "mine" : "other";
}

// Claims renewed before this moment have expired.
export function lockExpiry(now: Date) {
  return new Date(now.getTime() - LOCK_SECONDS * 1000);
}
