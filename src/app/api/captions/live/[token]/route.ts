import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { captionViewerStatus, selectViewerSession } from "@/features/sermon-captions/caption-contract";
import { isViewerToken } from "@/features/sermon-captions/caption-link";
import { reportRouteFailure } from "@/lib/observability";

const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };

// The public feed behind a church's one listener link. It returns the church name and caption text
// only, never People, Ministry, or attendance data.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!isViewerToken(token)) return NextResponse.json({ error: "Caption link not found." }, { status: 404, headers });
    const settings = await prisma.captionSettings.findUnique({ where: { viewerToken: token }, select: { workspace: { select: { name: true, id: true } } } });
    if (!settings) return NextResponse.json({ error: "Caption link not found." }, { status: 404, headers });
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
      return NextResponse.json({ status: "waiting", churchName, lines: [] }, { headers });
    }
    const lines = await prisma.captionLine.findMany({ where: { sessionId: chosen.session.id }, orderBy: { line: "desc" }, take: 10, select: { line: true, english: true, final: true } });
    if (chosen.availability.kind === "live") {
      return NextResponse.json({ status: captionViewerStatus(chosen.session, now), churchName, lines }, { headers });
    }
    const until = chosen.availability.kind === "retained" ? chosen.availability.until : now;
    return NextResponse.json({ status: "ended", churchName, expiresAt: until, lines }, { headers });
  } catch (error) {
    reportRouteFailure(error, { route: "/api/captions/live/[token]", method: "GET", status: 500, request });
    return NextResponse.json({ error: "Could not load captions." }, { status: 500, headers });
  }
}
