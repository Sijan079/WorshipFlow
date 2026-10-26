import type { CaptionPublicStatus } from "./caption-contract";

// Pure rules for the one stable listener link per church.

export const VIEWER_TOKEN_LENGTH = 32;

// 24 random bytes as base64url: 32 characters from A-Z, a-z, 0-9, "-" and "_".
export function isViewerToken(value: string) {
  return /^[A-Za-z0-9_-]{32}$/.test(value);
}

export function viewerLinkUrl(origin: string, token: string) {
  return `${origin}/captions/live/${token}`;
}

// Owner and Admin can always share. A Member needs the SHARE grant, and cannot share what they
// cannot view.
export function canShareCaptionLink(role: string, grants: { VIEW: boolean; SHARE: boolean }) {
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role !== "MEMBER") return false;
  return grants.VIEW && grants.SHARE;
}

// Regenerating breaks every printed QR code, so it is never grantable.
export function canRegenerateCaptionLink(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

// How often the public page asks for captions: quickly while they flow, slowly while it waits for
// the next service, so people come back without anyone sending a new link.
export function viewerPollMs(status: CaptionPublicStatus | undefined) {
  return status === "waiting" || status === "ended" ? 15_000 : 2_000;
}
