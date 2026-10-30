import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requireSiteAction } from "@/features/site/site-access";
import { HOME_SLUG, planHomeSwap } from "@/features/site/pages/page-rules";

type RouteParams = { params: Promise<{ id: string }> };

// Makes this page the home page. What visitors see at the church's main address changes, so it needs the Publish
// permission. The old home page becomes an ordinary page, and both changes happen together or not at all.
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const context = await requireSiteAction("PUBLISH");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Page not found." }, { status: 404 });

    const pages = await prisma.sitePage.findMany({ where: { workspaceId: context.workspaceId }, select: { id: true, title: true, slug: true } });
    const plan = planHomeSwap({ pages, targetId: id });
    if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.error === "Page not found." ? 404 : 409 });

    await prisma.$transaction(async (tx) => {
      // The old home page moves first, so the address "home" is free when the chosen page takes it.
      if (plan.oldHome) await tx.sitePage.updateMany({ where: { id: plan.oldHome.id, workspaceId: context.workspaceId }, data: { slug: plan.oldHome.newSlug } });
      await tx.sitePage.updateMany({ where: { id, workspaceId: context.workspaceId }, data: { slug: HOME_SLUG } });
    });
    return NextResponse.json({ slug: HOME_SLUG, oldHomeSlug: plan.oldHome?.newSlug ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    // Two people swapping at the same moment: the database's unique address rule decides.
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "The pages changed at the same moment. Try again." }, { status: 409 });
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    if (status === 500) reportRouteFailure(error, { route: "/api/site/pages/[id]/make-home", method: "POST", status, request });
    return NextResponse.json({ error: status === 500 ? "The home page could not be changed." : (error as Error).message }, { status });
  }
}
