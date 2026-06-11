import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { getServerEnv } from "@/lib/server-env";
import {
  estimateBackgroundGeneration,
  parseBackgroundGenerationRequest,
} from "@/features/media-generation/media-generation";

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    const generationRequest = parseBackgroundGenerationRequest(await request.json());
    const estimate = estimateBackgroundGeneration(generationRequest, {
      imageModel: env.GEMINI_BACKGROUND_IMAGE_MODEL,
      videoModel: env.GEMINI_BACKGROUND_VIDEO_MODEL,
    });

    return NextResponse.json({ request: generationRequest, estimate });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to estimate background generation") },
      { status: 400 }
    );
  }
}
