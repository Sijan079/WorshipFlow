import assert from "node:assert/strict";
import { removeBackgroundWithOpenAI } from "./openai-background-removal.ts";

export async function runOpenAIBackgroundRemovalTests() {
  let requestBody: FormData | undefined;
  const output = await removeBackgroundWithOpenAI({
    apiKey: "test-key",
    file: new File(["image"], "source.png", { type: "image/png" }),
    fetcher: async (_input, init) => {
      requestBody = init.body as FormData;
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("transparent-png").toString("base64") }] }), { status: 200 });
    },
    model: "gpt-image-2",
  });

  assert.equal(output.type, "image/png");
  assert.equal(new TextDecoder().decode(await output.arrayBuffer()), "transparent-png");
  assert.equal(requestBody?.get("model"), "gpt-image-2");
  assert.equal(requestBody?.get("background"), "transparent");
  assert.equal(requestBody?.has("input_fidelity"), false);
}
