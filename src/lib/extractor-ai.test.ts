import assert from "node:assert/strict";
import { runAiLyricsCleanup } from "./extractor-ai.ts";

export async function runExtractorAiTests() {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;

  try {
    process.env.OPENAI_API_KEY = "test-key";
    globalThis.fetch = async () => new Response(JSON.stringify({
      status: "failed",
      error: { message: "The configured AI model is unavailable." },
    }), { headers: { "Content-Type": "application/json" } });

    await assert.rejects(
      runAiLyricsCleanup({ extractedText: "[Verse]\nThis is a complete lyric line", parser: "paste", warningCodes: [] }),
      /configured AI model is unavailable/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
}
