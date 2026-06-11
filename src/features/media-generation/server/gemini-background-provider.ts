import type { BackgroundGenerationProvider } from "./provider";

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
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#121826"/>
      <stop offset="0.52" stop-color="#29305f"/>
      <stop offset="1" stop-color="#1a5d73"/>
    </linearGradient>
    <radialGradient id="light" cx="55%" cy="40%" r="55%">
      <stop offset="0" stop-color="#a78bfa" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#0b1020" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  <rect width="1920" height="1080" fill="url(#light)"/>
  <path d="M0 820 C360 690 620 920 950 760 C1280 600 1500 740 1920 580 L1920 1080 L0 1080 Z" fill="#38bdf8" opacity="0.16"/>
  <path d="M0 680 C320 590 610 720 920 620 C1280 500 1490 590 1920 450" fill="none" stroke="#c4b5fd" stroke-width="5" opacity="0.22"/>
  <text x="72" y="1010" fill="#dbeafe" opacity="0.34" font-family="Inter, Arial" font-size="28">Mock background - ${safePrompt}</text>
</svg>`;
}

function mockVideoManifest(prompt: string) {
  return JSON.stringify(
    {
      type: "mock-480p-loop-video",
      durationSeconds: 15,
      resolution: "854x480",
      loopIntended: true,
      prompt,
      note: "This placeholder is generated when GEMINI_API_KEY is not configured.",
    },
    null,
    2
  );
}

export function createGeminiBackgroundProvider(env: {
  GEMINI_API_KEY?: string;
}): BackgroundGenerationProvider {
  return {
    async generateBackground({ request, prompt, estimate }) {
      if (!env.GEMINI_API_KEY) {
        if (request.mediaType === "video") {
          return {
            fileName: "worship-background-loop-480p.json",
            mimeType: "application/json",
            bytes: encodeUtf8(mockVideoManifest(prompt)),
            providerMetadata: { provider: "mock-gemini", mode: "no-api-key", estimate },
            actualUsage: null,
          };
        }

        return {
          fileName: "worship-background.svg",
          mimeType: "image/svg+xml",
          bytes: encodeUtf8(svgMockBackground(prompt)),
          providerMetadata: { provider: "mock-gemini", mode: "no-api-key", estimate },
          actualUsage: null,
        };
      }

      throw new Error(
        "Gemini media generation provider is configured but the live API adapter is not enabled in this build."
      );
    },
  };
}
