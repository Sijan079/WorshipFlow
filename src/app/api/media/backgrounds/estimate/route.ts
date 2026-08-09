import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { getServerEnv } from "@/lib/server-env";
import prisma from "@/lib/prisma";
import { requireExplicitWorkspaceRole } from "@/lib/security-context";
import { decryptIntegrationSecret } from "@/lib/workspace-integrations";
import {
  estimateBackgroundGeneration,
  parseBackgroundGenerationRequest,
} from "@/features/media-generation/media-generation";

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    const workspaceId = (await requireExplicitWorkspaceRole("MEMBER")).workspaceId;
    const integration = await prisma.workspaceIntegration.findUnique({ where: { workspaceId_provider: { workspaceId, provider: "OPENAI" } } });
    const apiKey = integration?.apiKeyCiphertext && env.WORKSPACE_INTEGRATION_ENCRYPTION_KEY
      ? decryptIntegrationSecret(integration.apiKeyCiphertext, env.WORKSPACE_INTEGRATION_ENCRYPTION_KEY)
      : env.OPENAI_API_KEY;
    const generationRequest = parseBackgroundGenerationRequest(await request.json());
    const estimate = estimateBackgroundGeneration(generationRequest, {
      imageModel: integration?.backgroundImageModel || env.OPENAI_BACKGROUND_IMAGE_MODEL,
      estimatedImageCostUsd: env.OPENAI_BACKGROUND_IMAGE_ESTIMATED_COST_USD,
    });

    return NextResponse.json({ request: generationRequest, estimate, configured: Boolean(apiKey) });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to estimate background generation") },
      { status: 400 }
    );
  }
}
