import assert from "node:assert/strict";
import { enhanceImageWithOpenAI, selectOpenAIImageSize } from "./openai-image-upscale.ts";

export async function runOpenAIImageUpscaleTests() {
  assert.equal(selectOpenAIImageSize(2400, 2400), "1024x1024");
  assert.equal(selectOpenAIImageSize(2400, 1080), "1536x1024");
  assert.equal(selectOpenAIImageSize(1080, 2400), "1024x1536");

  let requestBody: FormData | null = null;
  const result = await enhanceImageWithOpenAI({
    apiKey: "test-key",
    image: new Uint8Array([1, 2, 3]),
    width: 1080,
    height: 2400,
    fetcher: async (_input, init) => {
      requestBody = init?.body as FormData;
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("result").toString("base64") }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  assert.equal(Buffer.from(result.bytes).toString(), "result");
  const submittedBody = requestBody as FormData | null;
  assert.ok(submittedBody);
  assert.equal(submittedBody.get("input_fidelity"), "high");
  assert.equal(submittedBody.get("quality"), "high");
  assert.equal(submittedBody.get("size"), "1024x1536");
  assert.match(String(submittedBody.get("prompt")), /Sharpen only the existing text edges/);
}
