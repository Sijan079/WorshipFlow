import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { canPublishSite, requireSiteAction } from "@/features/site/site-access";
import { canDeletePage, decidePageUpdate } from "@/features/site/pages/page-rules";
import { lockStatus } from "@/features/site/pages/page-lock";
import { UpdatePageSchema } from "@/features/site/pages/page-validation";
import { unavailableImagesIn } from "@/features/site/images/image-ownership";

type RouteParams = { params: Promise<{ id: string }> };

function errorResponse(error: unknown, request: Request, method: string, fallback: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  if (status === 500) reportRouteFailure(error, { route: "/api/site/pages/[id]", method, status, request });
  return NextResponse.json({ error: status === 500 ? fallback : (error as Error).message }, { status });
}

const noStore = { "Cache-Control": "no-store" };
const notFound = () => NextResponse.json({ error: "Page not found." }, { status: 404 });

const pageSelect = {
  id: true, title: true, slug: true, description: true, status: true, isPublic: true, sortOrder: true, updatedAt: true,
  blocks: { orderBy: { sortOrder: "asc" as const }, select: { id: true, type: true, content: true } },
};

function serialize(page: Prisma.SitePageGetPayload<{ select: typeof pageSelect }>) {
  return { ...page, updatedAt: page.updatedAt.toISOString() };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const context = await requireSiteAction("VIEW");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return notFound();
    const page = await prisma.sitePage.findFirst({ where: { id, workspaceId: context.workspaceId }, select: pageSelect });
    if (!page) return notFound();
    return NextResponse.json(serialize(page), { headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "GET", "Failed to load the page.");
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const context = await requireSiteAction("EDIT");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return notFound();
    const parsed = UpdatePageSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    const existing = await prisma.sitePage.findFirst({ where: { id, workspaceId: context.workspaceId }, select: { status: true, isPublic: true, lockedById: true, lockedAt: true } });
    if (!existing) return notFound();

    // Someone else has the page open for editing: saving over their work is refused until they are done.
    if (lockStatus(existing, context.userId, new Date()) === "other") {
      return NextResponse.json({ error: "Someone else is editing this page right now. Your changes were not saved." }, { status: 409 });
    }

    if (input.blocks && (await unavailableImagesIn(context.workspaceId, input.blocks)).length > 0) {
      return NextResponse.json({ error: "One of the pictures is no longer available. Add it again." }, { status: 400 });
    }

    const decision = decidePageUpdate({ existing, input, canPublish: await canPublishSite(context) });
    if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: 403 });

    // The words and the block list are saved together, so a page is never half old and half new.
    const page = await prisma.$transaction(async (tx) => {
      if (input.blocks) {
        await tx.sitePageBlock.deleteMany({ where: { pageId: id } });
        await tx.sitePageBlock.createMany({
          data: input.blocks.map((block, index) => ({ pageId: id, type: block.type, sortOrder: index, content: block.content as Prisma.InputJsonValue })),
        });
      }
      await tx.sitePage.updateMany({
        where: { id, workspaceId: context.workspaceId },
        data: { title: input.title, description: input.description, isPublic: input.isPublic, status: decision.status ?? input.status },
      });
      return tx.sitePage.findFirstOrThrow({ where: { id, workspaceId: context.workspaceId }, select: pageSelect });
    });
    return NextResponse.json({ ...serialize(page), sentBackToDraft: decision.sentBackToDraft }, { headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "PATCH", "Failed to save the page.");
  }
}

// Only a draft can be deleted, and never the home page. A live page is unpublished first.
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const context = await requireSiteAction("DELETE");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return notFound();
    const page = await prisma.sitePage.findFirst({ where: { id, workspaceId: context.workspaceId }, select: { slug: true, status: true } });
    if (!page) return notFound();
    if (!canDeletePage(page)) {
      return NextResponse.json({ error: page.slug === "home" ? "The home page cannot be deleted." : "Unpublish the page before deleting it." }, { status: 409 });
    }
    // The draft rule is part of the delete itself, so it holds even if someone publishes a moment earlier.
    const removed = await prisma.sitePage.deleteMany({ where: { id, workspaceId: context.workspaceId, status: "DRAFT" } });
    if (removed.count === 0) return NextResponse.json({ error: "Unpublish the page before deleting it." }, { status: 409 });
    return NextResponse.json({ deleted: true }, { headers: noStore });
  } catch (error: unknown) {
    return errorResponse(error, request, "DELETE", "Failed to delete the page.");
  }
}
