const OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits";

type OpenAIImageEditResponse = {
  data?: Array<{ b64_json?: string }>;
  usage?: unknown;
  error?: { message?: string };
};

export function selectOpenAIImageSize(width: number, height: number) {
  const ratio = width / height;
  if (ratio > 1.15) return "1536x1024" as const;
  if (ratio < 0.87) return "1024x1536" as const;
  return "1024x1024" as const;
}

export async function enhanceImageWithOpenAI({
  apiKey,
  image,
  width,
  height,
  model = "gpt-image-1",
  fetcher = fetch,
}: {
  apiKey: string;
  image: Uint8Array;
  width: number;
  height: number;
  model?: string;
  fetcher?: typeof fetch;
}) {
  const form = new FormData();
  const imageBytes = new Uint8Array(image.byteLength);
  imageBytes.set(image);
  form.append("image", new Blob([imageBytes], { type: "image/png" }), "source.png");
  form.append("model", model);
  form.append("prompt", "Sharpen only the existing text edges in this image region. Preserve every character, word, number, punctuation mark, line break, color, spacing, background, crop, and layout exactly. Do not add margins, reframe, rewrite, invent, remove, or reposition any content.");
  if (!model.endsWith("-mini")) form.append("input_fidelity", "high");
  form.append("quality", "high");
  form.append("size", selectOpenAIImageSize(width, height));
  form.append("output_format", "png");

  const response = await fetcher(OPENAI_IMAGE_EDITS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const body = await response.json() as OpenAIImageEditResponse;
  if (!response.ok) throw new Error(body.error?.message || `OpenAI image enhancement failed with status ${response.status}.`);
  const result = body.data?.find((item) => item.b64_json)?.b64_json;
  if (!result) throw new Error("OpenAI did not return an enhanced image.");
  return { bytes: Uint8Array.from(Buffer.from(result, "base64")), usage: body.usage ?? null, model };
}
