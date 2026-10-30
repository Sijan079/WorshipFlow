import sharp from "sharp";

export const SITE_IMAGE_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxWidth: 1600,
  maxPixels: 40_000_000,
  webpQuality: 80,
} as const;

// Pictures people may upload. SVG is left out on purpose: it can carry scripts.
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ProcessedImage = { ok: true; data: Buffer; width: number; height: number } | { ok: false; error: string };

const NOT_A_PICTURE = "That file is not a picture we can use. Please choose a JPG, PNG or WebP photo.";

// Turns an uploaded picture into the one thing the site stores: a WebP, at most 1600 px wide, turned upright,
// with the camera's hidden details (including where it was taken) removed.
export async function processSiteImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length > SITE_IMAGE_LIMITS.maxBytes) return { ok: false, error: "That picture is too big. Please choose one that is 10 MB or smaller." };
  if (input.length === 0) return { ok: false, error: NOT_A_PICTURE };
  try {
    const source = sharp(input, { limitInputPixels: SITE_IMAGE_LIMITS.maxPixels, failOn: "error" });
    const metadata = await source.metadata();
    if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) return { ok: false, error: NOT_A_PICTURE };
    const { data, info } = await source
      .rotate()
      .resize({ width: SITE_IMAGE_LIMITS.maxWidth, withoutEnlargement: true })
      .webp({ quality: SITE_IMAGE_LIMITS.webpQuality })
      .toBuffer({ resolveWithObject: true });
    return { ok: true, data, width: info.width, height: info.height };
  } catch {
    return { ok: false, error: NOT_A_PICTURE };
  }
}
