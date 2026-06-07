import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { LyricsExtractorAiRequestSchema } from "@/lib/extractor-types";
import { processDirectAiCleanup, processStandaloneAiRetry } from "@/lib/extractor-workflow";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit({
      key: getRateLimitKey(request, "standalone-extractor-ai"),
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    const body = await request.json();
    const parsed = LyricsExtractorAiRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const result =
      "retryToken" in parsed.data
        ? await processStandaloneAiRetry(parsed.data.retryToken)
        : await processDirectAiCleanup({
            text: parsed.data.text,
            songTitle: parsed.data.songTitle,
          });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("POST /api/extractor/ai error:", error);
    const message = getErrorMessage(error, "Failed to run AI lyrics cleanup");
    const status = message.includes("expired") ? 410 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
