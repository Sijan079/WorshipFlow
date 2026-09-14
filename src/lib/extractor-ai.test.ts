import assert from "node:assert/strict";
import { runAiLyricsCleanup } from "./extractor-ai.ts";

export async function runExtractorAiTests() {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;

  try {
    let requestBody = "";
    process.env.OPENAI_API_KEY = "test-key";
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({
        status: "failed",
        error: { message: "The configured AI model is unavailable." },
      }), { headers: { "Content-Type": "application/json" } });
    };

    await assert.rejects(
      runAiLyricsCleanup({ extractedText: "[Verse]\nThis is a complete lyric line", parser: "paste", warningCodes: [] }),
      /configured AI model is unavailable/i,
    );
    assert.match(requestBody, /Unicode accidentals such as ♯ or ♭/);
    assert.match(requestBody, /bracketed inline chords/);
    assert.match(requestBody, /Refrain/);
    assert.match(requestBody, /End.*Outro/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
}
