const OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits";

type OpenAIImageEditResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
};

export async function removeBackgroundWithOpenAI({
  apiKey,
  fetcher = fetch,
  file,
  model,
}: {
  apiKey: string;
  fetcher?: (input: string, init: RequestInit) => Promise<Response>;
  file: File;
  model: string;
}) {
  const form = new FormData();
  form.append("image", file, "source.png");
  form.append("model", model);
  form.append("prompt", "Remove the background. Preserve the foreground subject exactly and return it on a transparent background.");
  form.append("background", "transparent");
  form.append("output_format", "png");

  const response = await fetcher(OPENAI_IMAGE_EDITS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const body = await response.json() as OpenAIImageEditResponse;
  if (!response.ok) throw new Error(body.error?.message || "OpenAI image editing failed.");

  const image = body.data?.find((item) => item.b64_json);
  if (!image?.b64_json) throw new Error("OpenAI did not return a transparent image.");
  return new Blob([Uint8Array.from(Buffer.from(image.b64_json, "base64"))], { type: "image/png" });
}
