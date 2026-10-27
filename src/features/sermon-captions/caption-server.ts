import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { reportRouteFailure } from "@/lib/observability";
import { CaptionProviderConfigurationError, CaptionProviderQuotaError } from "./caption-providers";

export { CAPTION_SESSION_MS } from "./caption-contract";

// The listener link. 24 random bytes is 32 base64url characters; see `isViewerToken`.
export function newViewerToken() {
  return randomBytes(24).toString("base64url");
}

export function newOperatorToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOperatorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function validOperatorToken(provided: string | null, expectedHash: string) {
  if (!provided || provided.length > 128) return false;
  const actual = Buffer.from(hashOperatorToken(provided), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function captionErrorResponse(error: unknown, request: Request, route: string, method: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : error instanceof CaptionProviderConfigurationError ? 503 : error instanceof CaptionProviderQuotaError ? 429 : 500;
  if (status >= 500) reportRouteFailure(error, { route, method, status, request });
  return NextResponse.json({ error: status === 500 ? "Caption request failed." : (error as Error).message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
