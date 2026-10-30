import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { readPrivateOutputFile } from "@/lib/private-output-storage";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { requireSiteAction } from "@/features/site/site-access";

type RouteParams = { params: Promise<{ id: string }> };

// Lets the editor show a picture before its page is published. Only people who can view the website pages
// of this church can open it, and only the church's own pictures.
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const context = await requireSiteAction("VIEW");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
    const image = await prisma.siteImage.findFirst({ where: { id, workspaceId: context.workspaceId }, select: { storagePath: true } });
    if (!image) return new NextResponse("Not found", { status: 404 });
    const data = await readPrivateOutputFile(image.storagePath);
    return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": "image/webp", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error: unknown) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    if (status === 500) reportRouteFailure(error, { route: "/api/site/images/[id]", method: "GET", status, request });
    return new NextResponse(status === 500 ? "The picture could not be loaded." : (error as Error).message, { status });
  }
}
