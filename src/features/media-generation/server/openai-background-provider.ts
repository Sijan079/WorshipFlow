import type { BackgroundGenerationProvider } from "./provider";

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function svgMockBackground(prompt: string) {
  const safePrompt = prompt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 220);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="0.54" stop-color="#312e81"/>
      <stop offset="1" stop-color="#075985"/>
    </linearGradient>
    <radialGradient id="glow" cx="60%" cy="36%" r="58%">
      <stop offset="0" stop-color="#a78bfa" stop-opacity="0.48"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1536" height="1024" fill="url(#bg)"/>
  <rect width="1536" height="1024" fill="url(#glow)"/>
  <path d="M0 772 C260 654 496 824 760 694 C1042 556 1248 678 1536 538 L1536 1024 L0 1024 Z" fill="#38bdf8" opacity="0.14"/>
  <path d="M0 646 C246 558 488 686 734 590 C1020 478 1214 560 1536 430" fill="none" stroke="#c4b5fd" stroke-width="4" opacity="0.24"/>
  <text x="56" y="958" fill="#dbeafe" opacity="0.34" font-family="Inter, Arial" font-size="24">Mock OpenAI background - ${safePrompt}</text>
</svg>`;
}

type OpenAIImagesResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
  usage?: unknown;
  error?: {
    message?: string;
  };
};

async function generateOpenAIImage(params: {
  apiKey: string;
  model: string;
  prompt: string;
}) {
  const response = await fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      n: 1,
      size: "1536x1024",
    }),
  });

  const body = (await response.json()) as OpenAIImagesResponse;

  if (!response.ok) {
    throw new Error(body.error?.message || `OpenAI image generation failed with status ${response.status}.`);
  }

  const image = body.data?.find((item) => item.b64_json);
  if (!image?.b64_json) {
    throw new Error(`OpenAI model "${params.model}" did not return image data.`);
  }

  return {
    bytes: Uint8Array.from(Buffer.from(image.b64_json, "base64")),
    mimeType: "image/png",
    usage: body.usage,
    revisedPrompt: image.revised_prompt,
  };
}

export function createOpenAIBackgroundProvider(env: {
  OPENAI_API_KEY?: string;
}): BackgroundGenerationProvider {
  return {
    async generateBackground({ request, prompt, estimate }) {
      if (request.mediaType !== "image") {
        throw new Error("OpenAI background provider only supports image generation.");
      }

      if (!env.OPENAI_API_KEY) {
        return {
          fileName: "worship-background-openai-mock.svg",
          mimeType: "image/svg+xml",
          bytes: encodeUtf8(svgMockBackground(prompt)),
          providerMetadata: { provider: "mock-openai", mode: "no-api-key", estimate },
          actualUsage: null,
        };
      }

      const generated = await generateOpenAIImage({
        apiKey: env.OPENAI_API_KEY,
        model: estimate.model,
        prompt,
      });

      return {
        fileName: "worship-background.png",
        mimeType: generated.mimeType,
        bytes: generated.bytes,
        providerMetadata: {
          provider: "openai",
          mode: "live-api",
          model: estimate.model,
          revisedPrompt: generated.revisedPrompt ?? null,
          estimate,
        },
        actualUsage: generated.usage && typeof generated.usage === "object" ? generated.usage : null,
      };
    },
  };
}
