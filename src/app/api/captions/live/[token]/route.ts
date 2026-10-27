import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { captionViewerStatus, feedCacheControl, selectViewerSession, type CaptionPublicStatus } from "@/features/sermon-captions/caption-contract";
import { isViewerToken } from "@/features/sermon-captions/caption-link";
import { reportRouteFailure } from "@/lib/observability";

// The cache is short and shared, so the load on the database does not grow with the audience. Nothing
// private is in these responses: anyone with the link may read them.
// `serverNow` and each line's `updatedAt` let a listener (or the measuring script) tell how old a caption
// is when it arrives.
function respond(body: object, status: number, cacheStatus: CaptionPublicStatus | "invalid") {
  return NextResponse.json({ ...body, serverNow: Date.now() }, { status, headers: { "Cache-Control": feedCacheControl(cacheStatus), "Referrer-Policy": "no-referrer" } });
}

// The public feed behind a church's one listener link. It returns the church name and caption text
// only, never People, Ministry, or attendance data.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!isViewerToken(token)) return respond({ error: "Caption link not found." }, 404, "invalid");
    const settings = await prisma.captionSettings.findUnique({ where: { viewerToken: token }, select: { workspace: { select: { name: true, id: true } } } });
    if (!settings) return respond({ error: "Caption link not found." }, 404, "invalid");
    const { id: workspaceId, name: churchName } = settings.workspace;
    const now = new Date();
    const sessions = await prisma.captionSession.findMany({
      where: { workspaceId, OR: [{ status: "LIVE" }, { status: "ENDED", expiresAt: { gt: now } }] },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, expiresAt: true, createdAt: true, connectionStatus: true, lastHeartbeatAt: true },
    });
    const chosen = selectViewerSession(sessions, now);
    if (!chosen) {
      // Nothing to show: clear what is past its hour and tell the page to keep waiting.
      await prisma.captionLine.deleteMany({ where: { session: { is: { workspaceId, expiresAt: { lte: now } } } } });
      return respond({ status: "waiting", churchName, lines: [] }, 200, "waiting");
    }
    const lines = await prisma.captionLine.findMany({ where: { sessionId: chosen.session.id }, orderBy: { line: "desc" }, take: 10, select: { line: true, english: true, final: true, updatedAt: true } });
    if (chosen.availability.kind === "live") {
      const status = captionViewerStatus(chosen.session, now);
      return respond({ status, churchName, lines }, 200, status);
    }
    const until = chosen.availability.kind === "retained" ? chosen.availability.until : now;
    return respond({ status: "ended", churchName, expiresAt: until, lines }, 200, "ended");
  } catch (error) {
    reportRouteFailure(error, { route: "/api/captions/live/[token]", method: "GET", status: 500, request });
    return NextResponse.json({ error: "Could not load captions." }, { status: 500, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
}
