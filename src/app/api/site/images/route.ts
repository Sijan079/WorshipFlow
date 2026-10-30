import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportRouteFailure } from "@/lib/observability";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { deletePrivateOutputFile, savePrivateOutputFile } from "@/lib/private-output-storage";
import { WorkspaceAuthorizationError } from "@/lib/security-context";
import { isUploadedFile } from "@/lib/upload-security";
import { requireSiteAction } from "@/features/site/site-access";
import { imagePathFor } from "@/features/site/images/image-refs";
import { MAX_IMAGES_PER_CHURCH } from "@/features/site/images/image-ownership";
import { SITE_IMAGE_LIMITS, processSiteImage } from "@/features/site/images/site-image-processing";

export async function POST(request: Request) {
  try {
    const context = await requireSiteAction("EDIT");
    const limit = checkRateLimit({ key: `site-image:${context.workspaceId}`, limit: 30, windowMs: 60_000 });
    if (!limit.allowed) return rateLimitResponse(limit.resetAt);

    const value = (await request.formData()).get("file");
    if (!isUploadedFile(value)) return NextResponse.json({ error: "Choose a picture to add." }, { status: 400 });
    if (value.size > SITE_IMAGE_LIMITS.maxBytes) return NextResponse.json({ error: "That picture is too big. Please choose one that is 10 MB or smaller." }, { status: 400 });

    if ((await prisma.siteImage.count({ where: { workspaceId: context.workspaceId } })) >= MAX_IMAGES_PER_CHURCH) {
      return NextResponse.json({ error: `A church can keep up to ${MAX_IMAGES_PER_CHURCH} pictures on its website.` }, { status: 409 });
    }

    const processed = await processSiteImage(Buffer.from(await value.arrayBuffer()));
    if (!processed.ok) return NextResponse.json({ error: processed.error }, { status: 400 });

    const id = globalThis.crypto.randomUUID();
    const saved = await savePrivateOutputFile(`site-${context.workspaceId}`, `${id}.webp`, processed.data, { contentType: "image/webp" });
    try {
      await prisma.siteImage.create({
        data: { id, workspaceId: context.workspaceId, storagePath: saved.relativePath, width: processed.width, height: processed.height, bytes: processed.data.length },
      });
    } catch (error) {
      // The record did not save, so the file would be left with nothing pointing at it.
      await deletePrivateOutputFile(saved.relativePath).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ id, path: imagePathFor(id), width: processed.width, height: processed.height, bytes: processed.data.length }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    if (status === 500) reportRouteFailure(error, { route: "/api/site/images", method: "POST", status, request });
    return NextResponse.json({ error: status === 500 ? "The picture could not be added." : (error as Error).message }, { status });
  }
}
