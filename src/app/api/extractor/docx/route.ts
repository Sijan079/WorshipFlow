import { LyricsExtractorDocxRequestSchema } from "@/lib/extractor-types";
import { getErrorMessage } from "@/lib/errors";
import { createLyricsDocx } from "@/lib/lyrics-docx";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { songDownloadDisposition } from "@/features/song-formatter/filename";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit({
      key: getRateLimitKey(request, "standalone-extractor-docx"),
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    const body = await request.json();
    const parsed = LyricsExtractorDocxRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const bytes = await createLyricsDocx(parsed.data.text);

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": songDownloadDisposition(parsed.data.songTitle ?? ""),
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to generate lyrics DOCX") },
      { status: 500 }
    );
  }
}
