import { JobStatus, JobType, OutputType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { savePrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { getServerEnv } from "@/lib/server-env";
import {
  assertAcceptedEstimateMatches,
  buildBackgroundPrompt,
  estimateBackgroundGeneration,
  parseBackgroundGenerationRequest,
} from "@/features/media-generation/media-generation";
import { deleteExpiredBackgroundOutputs } from "@/features/media-generation/server/background-output-retention";
import { createOpenAIBackgroundProvider } from "@/features/media-generation/server/openai-background-provider";
import { checkMediaGenerationRateLimits } from "@/features/media-generation/server/rate-limits";

export async function POST(request: Request) {
  let jobId: string | null = null;

  try {
    const env = getServerEnv();
    const workspaceId = await getActiveWorkspaceId(prisma);
    const body = await request.json();
    const generationRequest = parseBackgroundGenerationRequest(body.request);
    await deleteExpiredBackgroundOutputs(prisma, workspaceId);

    const rateLimit = checkMediaGenerationRateLimits({
      request,
      workspaceId,
      mediaType: generationRequest.mediaType,
      env,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    const estimate = estimateBackgroundGeneration(generationRequest, {
      imageModel: env.OPENAI_BACKGROUND_IMAGE_MODEL,
      estimatedImageCostUsd: env.OPENAI_BACKGROUND_IMAGE_ESTIMATED_COST_USD,
    });

    if (!assertAcceptedEstimateMatches(body.acceptedEstimate, estimate)) {
      return NextResponse.json(
        { error: "Generation estimate changed. Review the estimate before generating." },
        { status: 409 }
      );
    }

    const prompt = buildBackgroundPrompt(generationRequest);
    const job = await prisma.automationJob.create({
      data: {
        workspaceId,
        serviceId: null,
        jobType: JobType.BACKGROUND_IMAGE_GENERATE,
        status: JobStatus.PROCESSING,
        inputJson: {
          request: generationRequest,
          acceptedEstimate: estimate,
          prompt,
        },
      },
    });
    jobId = job.id;

    const provider = createOpenAIBackgroundProvider(env);
    const result = await provider.generateBackground({
      request: generationRequest,
      prompt,
      estimate,
    });
    const directory = "background-images";
    const savedFile = await savePrivateOutputFile(directory, result.fileName, result.bytes, {
      contentType: result.mimeType,
    });
    const outputType = OutputType.BACKGROUND_IMAGE;

    const completed = await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.automationJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.DONE,
          completedAt: new Date(),
          outputJson: {
            estimate,
            providerMetadata: result.providerMetadata,
            actualUsage: result.actualUsage,
            mimeType: result.mimeType,
            fileName: result.fileName,
          } satisfies Prisma.InputJsonObject,
        },
        include: { outputs: true },
      });

      const output = await tx.generatedOutput.create({
        data: {
          workspaceId,
          serviceId: null,
          jobId: job.id,
          type: outputType,
          filePath: savedFile.relativePath,
        },
      });

      return { job: { ...updatedJob, outputs: [output] }, output };
    });

    return NextResponse.json(completed, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error, "Failed to generate background");

    if (jobId) {
      await prisma.automationJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          completedAt: new Date(),
          outputJson: { error: errorMessage },
        },
      });
    }

    console.error("POST /api/media/backgrounds/generate error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
