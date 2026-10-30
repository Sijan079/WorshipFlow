import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requireSiteAction } from "@/features/site/site-access";
import { lockExpiry } from "@/features/site/pages/page-lock";

type RouteParams = { params: Promise<{ id: string }> };

const noStore = { "Cache-Control": "no-store" };

function errorResponse(error: unknown, request: Request, method: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/site/pages/[id]/lock", method, status, request });
  return NextResponse.json({ error: status === 500 ? "Could not check who is editing this page." : (error as Error).message }, { status });
}

// Claims the page for this person, or renews their claim. The claim and the check are one database update, so
// two people opening the page at the same moment cannot both win.
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const context = await requireSiteAction("EDIT");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Page not found." }, { status: 404 });
    const now = new Date();
    const claimed = await prisma.sitePage.updateMany({
      where: { id, workspaceId: context.workspaceId, OR: [{ lockedById: null }, { lockedById: context.userId }, { lockedAt: { lt: lockExpiry(now) } }] },
      data: { lockedById: context.userId, lockedAt: now },
    });
    if (claimed.count === 1) return NextResponse.json({ mine: true, by: null }, { headers: noStore });

    const page = await prisma.sitePage.findFirst({ where: { id, workspaceId: context.workspaceId }, select: { lockedById: true } });
    if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });
    const holder = page.lockedById ? await prisma.user.findUnique({ where: { id: page.lockedById }, select: { displayName: true } }) : null;
    return NextResponse.json({ mine: false, by: holder?.displayName ?? null }, { headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "POST");
  }
}

// Gives the page back when the editor closes, so the next person does not have to wait for the claim to run out.
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const context = await requireSiteAction("EDIT");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Page not found." }, { status: 404 });
    await prisma.sitePage.updateMany({ where: { id, workspaceId: context.workspaceId, lockedById: context.userId }, data: { lockedById: null, lockedAt: null } });
    return NextResponse.json({ released: true }, { headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "DELETE");
  }
}
