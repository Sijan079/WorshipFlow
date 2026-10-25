import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { canReadCaptionSession, captionViewerStatus, retainedCaptionExpiry } from "@/features/sermon-captions/caption-contract";
import { reportRouteFailure } from "@/lib/observability";

const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Caption session not found." }, { status: 404, headers });
    const session = await prisma.captionSession.findUnique({ where: { id }, select: { status: true, expiresAt: true, connectionStatus: true, lastHeartbeatAt: true } });
    if (!session) return NextResponse.json({ error: "Caption session not found." }, { status: 404, headers });
    const now = new Date();
    const live = canReadCaptionSession(session, now);
    const availableUntil = session.status === "LIVE" && !live ? retainedCaptionExpiry(session.expiresAt) : session.expiresAt;
    if (availableUntil.getTime() <= now.getTime()) {
      await prisma.captionLine.deleteMany({ where: { sessionId: id } });
      return NextResponse.json({ status: "ended", lines: [] }, { headers });
    }
    const lines = await prisma.captionLine.findMany({ where: { sessionId: id }, orderBy: { line: "desc" }, take: 10, select: { line: true, english: true, final: true } });
    return NextResponse.json(live ? { status: captionViewerStatus(session, now), lines } : { status: "ended", expiresAt: availableUntil, lines }, { headers });
  } catch (error) {
    reportRouteFailure(error, { route: "/api/captions/live/[id]", method: "GET", status: 500, request });
    return NextResponse.json({ error: "Could not load captions." }, { status: 500, headers });
  }
}
