import { NextResponse } from "next/server";
import { z } from "zod";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requireSiteAction } from "@/features/site/site-access";
import { getPreviewSite } from "@/features/site/public/public-site-data";

type RouteParams = { params: Promise<{ id: string }> };

// The page as a visitor would see it, drafts included, for the editor's Preview. Only people who can view this
// church's website pages get it, and only for this church's own pages.
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const context = await requireSiteAction("VIEW");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Page not found." }, { status: 404 });
    const site = await getPreviewSite(context.workspaceId, id, context.workspaceSlug);
    if (!site) return NextResponse.json({ error: "Page not found." }, { status: 404 });
    return NextResponse.json(site, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    if (status === 500) reportRouteFailure(error, { route: "/api/site/pages/[id]/preview", method: "GET", status, request });
    return NextResponse.json({ error: status === 500 ? "The preview could not be loaded." : (error as Error).message }, { status });
  }
}
