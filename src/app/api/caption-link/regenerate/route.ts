import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canRegenerateCaptionLink, viewerLinkUrl } from "@/features/sermon-captions/caption-link";
import { canonicalOrigin } from "@/features/sermon-captions/caption-environment";
import { captionErrorResponse, newViewerToken } from "@/features/sermon-captions/caption-server";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";

const headers = { "Cache-Control": "no-store" };

// Replaces the church's listener link. Every printed QR code and shared link stops working, so it is
// Owner and Admin only, never grantable, and never while captions are running.
export async function POST(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("ADMIN");
    if (!canRegenerateCaptionLink(context.role)) {
      throw new WorkspaceAuthorizationError(403, "Only an Owner or Admin can regenerate the captions link.");
    }
    const running = await prisma.captionSession.findFirst({
      where: { workspaceId: context.workspaceId, status: "LIVE", expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (running) {
      return NextResponse.json({ error: "Stop captions before regenerating the link." }, { status: 409, headers });
    }
    const settings = await prisma.captionSettings.upsert({
      where: { workspaceId: context.workspaceId },
      create: { workspaceId: context.workspaceId, viewerToken: newViewerToken(), rotatedAt: new Date() },
      update: { viewerToken: newViewerToken(), rotatedAt: new Date() },
      select: { viewerToken: true, rotatedAt: true },
    });
    const origin = canonicalOrigin({ appUrl: process.env.APP_URL, requestOrigin: new URL(request.url).origin, production: process.env.NODE_ENV === "production" });
    const url = viewerLinkUrl(origin, settings.viewerToken);
    return NextResponse.json({ token: settings.viewerToken, url, rotatedAt: settings.rotatedAt, canRegenerate: true }, { headers });
  } catch (error) {
    return captionErrorResponse(error, request, "/api/caption-link/regenerate", "POST");
  }
}
