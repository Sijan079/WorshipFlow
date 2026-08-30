import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { requireExplicitWorkspaceRole } from "@/lib/security-context";
import { getServerEnv } from "@/lib/server-env";
import { BACKGROUND_REMOVAL_UPLOAD_TYPES, isUploadedFile, UPLOAD_LIMITS, validateImageSignature, validateUploadFile } from "@/lib/upload-security";
import { decryptIntegrationSecret } from "@/lib/workspace-integrations";
import { checkMediaGenerationRateLimits } from "@/features/media-generation/server/rate-limits";
import { removeBackgroundWithOpenAI } from "@/features/media-generation/server/openai-background-removal";

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    const { workspaceId } = await requireExplicitWorkspaceRole("ADMIN");
    const form = await request.formData();
    const value = form.get("file");
    if (!isUploadedFile(value)) return NextResponse.json({ error: "Choose an image to remove its background." }, { status: 400 });
    const fileError = validateUploadFile(value, { allowedMimeTypes: BACKGROUND_REMOVAL_UPLOAD_TYPES, allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"], maxBytes: UPLOAD_LIMITS.backgroundRemovalBytes }) || await validateImageSignature(value);
    if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
    const limit = checkMediaGenerationRateLimits({ request, workspaceId, mediaType: "image", env });
    if (!limit.allowed) return rateLimitResponse(limit.resetAt);
    const integration = await prisma.workspaceIntegration.findUnique({ where: { workspaceId_provider: { workspaceId, provider: "OPENAI" } } });
    const apiKey = integration?.apiKeyCiphertext && env.WORKSPACE_INTEGRATION_ENCRYPTION_KEY ? decryptIntegrationSecret(integration.apiKeyCiphertext, env.WORKSPACE_INTEGRATION_ENCRYPTION_KEY) : env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI background removal is not configured for this workspace." }, { status: 503 });
    const output = await removeBackgroundWithOpenAI({ apiKey, file: value, model: "gpt-image-2" });
    return new NextResponse(output, { headers: { "Content-Type": "image/png", "Content-Disposition": "inline; filename=transparent.png", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("POST /api/media/background-removal error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "AI background removal failed. Try again." }, { status: 500 });
  }
}
