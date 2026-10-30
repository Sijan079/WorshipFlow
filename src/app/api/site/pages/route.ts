import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { hasModuleAction } from "@/lib/event-access";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { canPublishSite, requireSiteAction } from "@/features/site/site-access";
import { HOME_SLUG, canAddPage, nextSortOrder, uniquePageSlug } from "@/features/site/pages/page-rules";
import { CreatePageSchema } from "@/features/site/pages/page-validation";
import { STARTER_HOME_BLOCKS } from "@/features/site/pages/starter-home";
import { SITE_LIMITS } from "@/features/site/blocks/block-validation";

function errorResponse(error: unknown, request: Request, method: string, fallback: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/site/pages", method, status, request });
  return NextResponse.json({ error: status === 500 ? fallback : (error as Error).message }, { status });
}

const noStore = { "Cache-Control": "no-store" };

// Everyone with View sees every page of the church, drafts included: this list is internal.
export async function GET(request: Request) {
  try {
    const context = await requireSiteAction("VIEW");
    const [pages, canCreate, canEdit, canDelete, canPublish] = await Promise.all([
      prisma.sitePage.findMany({
        where: { workspaceId: context.workspaceId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, slug: true, status: true, isPublic: true, sortOrder: true, updatedAt: true, _count: { select: { blocks: true } } },
      }),
      hasModuleAction(context, "SITE", "CREATE"),
      hasModuleAction(context, "SITE", "EDIT"),
      hasModuleAction(context, "SITE", "DELETE"),
      canPublishSite(context),
    ]);
    return NextResponse.json({
      items: pages.map(({ _count, updatedAt, ...page }) => ({ ...page, blockCount: _count.blocks, updatedAt: updatedAt.toISOString() })),
      limits: SITE_LIMITS,
      canCreate, canEdit, canDelete, canPublish,
    }, { headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "GET", "Failed to load the pages.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireSiteAction("CREATE");
    const parsed = CreatePageSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    const existing = await prisma.sitePage.findMany({ where: { workspaceId: context.workspaceId }, select: { slug: true, sortOrder: true } });
    if (!canAddPage(existing.length)) {
      return NextResponse.json({ error: `A church can have at most ${SITE_LIMITS.pagesPerChurch} pages.` }, { status: 409 });
    }

    // The first page of a church is its home page, and it starts from the ready-made one when asked.
    const isFirst = existing.length === 0;
    const slug = isFirst ? HOME_SLUG : uniquePageSlug(input.title, new Set(existing.map((page) => page.slug)));
    const blocks = input.blocks ?? (isFirst && input.starter ? STARTER_HOME_BLOCKS : []);

    const created = await prisma.sitePage.create({
      data: {
        workspaceId: context.workspaceId,
        title: input.title,
        slug,
        description: input.description ?? null,
        sortOrder: nextSortOrder(existing.map((page) => page.sortOrder)),
        blocks: { create: blocks.map((block, index) => ({ type: block.type, sortOrder: index, content: block.content as Prisma.InputJsonValue })) },
      },
      select: { id: true, title: true, slug: true, status: true, isPublic: true },
    });
    return NextResponse.json(created, { status: 201, headers: noStore });
  } catch (error: unknown) {
    // Two people adding a page with the same address at once: the database's unique rule decides.
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "A page with that address already exists. Try again." }, { status: 409 });
    return errorResponse(error, request, "POST", "Failed to create the page.");
  }
}
