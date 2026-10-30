import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { readPrivateOutputFile } from "@/lib/private-output-storage";
import { imageIdFromPath, imagePathFor } from "@/features/site/images/image-refs";

type RouteParams = { params: Promise<{ workspaceSlug: string; name: string }> };

const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

// A picture is public only while a published, public page uses it, or it is the church's logo. Everything else looks
// like it does not exist.
// It may be remembered for five minutes, so a page taken down does not keep showing its pictures for long.
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { workspaceSlug, name } = await params;
    const imageId = imageIdFromPath(`site/${name}`);
    if (!imageId) return notFound();

    const image = await prisma.siteImage.findFirst({
      where: { id: imageId, workspace: { slug: workspaceSlug } },
      select: { storagePath: true, workspaceId: true },
    });
    if (!image) return notFound();

    const inUse = await prisma.sitePageBlock.findFirst({
      where: { type: "IMAGE", content: { path: ["path"], equals: imagePathFor(imageId) }, page: { workspaceId: image.workspaceId, status: "PUBLISHED", isPublic: true } },
      select: { id: true },
    });
    // The logo is public too, as long as it is the church's current one.
    const isLogo = inUse ? null : await prisma.siteSettings.findFirst({ where: { workspaceId: image.workspaceId, logoPath: imagePathFor(imageId) }, select: { id: true } });
    if (!inUse && !isLogo) return notFound();

    const data = await readPrivateOutputFile(image.storagePath);
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=300, s-maxage=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error: unknown) {
    reportRouteFailure(error, { route: "/c/[workspaceSlug]/image/[name]", method: "GET", status: 500, request });
    return new NextResponse("The picture could not be loaded.", { status: 500 });
  }
}
