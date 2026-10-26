import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCaptionAction } from "@/features/sermon-captions/caption-access";
import { canRegenerateCaptionLink, canShareCaptionLink } from "@/features/sermon-captions/caption-link";
import { captionErrorResponse, newViewerToken } from "@/features/sermon-captions/caption-server";
import { hasModuleAction } from "@/lib/event-access";
import { WorkspaceAuthorizationError } from "@/lib/security-context";

// The church's one listener link. Seeing it needs View captions and the Share captions link grant
// (Owner and Admin always have both). The row is created the first time someone opens Share.
export async function GET(request: Request) {
  try {
    const context = await requireCaptionAction("VIEW");
    const canShare = canShareCaptionLink(context.role, { VIEW: true, SHARE: await hasModuleAction(context, "CAPTIONS", "SHARE") });
    if (!canShare) throw new WorkspaceAuthorizationError(403, "You do not have permission to share the captions link.");
    const settings = await prisma.captionSettings.upsert({
      where: { workspaceId: context.workspaceId },
      create: { workspaceId: context.workspaceId, viewerToken: newViewerToken() },
      update: {},
      select: { viewerToken: true, rotatedAt: true },
    });
    return NextResponse.json(
      { token: settings.viewerToken, rotatedAt: settings.rotatedAt, canRegenerate: canRegenerateCaptionLink(context.role) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return captionErrorResponse(error, request, "/api/caption-link", "GET");
  }
}
