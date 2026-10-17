export const COMMENT_CARD_PRESETS = [
  { id: "presentation", label: "Presentation · 1920 × 1080", width: 1920, height: 1080 },
  { id: "phone", label: "Phone · 1080 × 2400", width: 1080, height: 2400 },
  { id: "portrait", label: "Portrait · 1080 × 1920", width: 1080, height: 1920 },
  { id: "square", label: "Square · 1080 × 1080", width: 1080, height: 1080 },
  { id: "wide", label: "Wide · 4800 × 2400", width: 4800, height: 2400 },
] as const;

export const COMMENT_CARD_FIT_OPTIONS = ["contain", "fill", "stretch"] as const;
export type CommentCardFit = (typeof COMMENT_CARD_FIT_OPTIONS)[number];
export const COMMENT_CARD_BASE_WIDTH = 1920;
export const COMMENT_CARD_BASE_HEIGHT = 1080;
export const COMMENT_CARD_FONT_FAMILY = 'Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
export const COMMENT_CARD_TEXT_SAFE_INSET = 24;
export const COMMENT_CARD_BUBBLE_WIDTH = COMMENT_CARD_BASE_WIDTH - Math.round(Math.min(COMMENT_CARD_BASE_WIDTH, COMMENT_CARD_BASE_HEIGHT) * 0.08) * 2;
export const COMMENT_CARD_BUBBLE_PADDING_X = Math.round(Math.min(COMMENT_CARD_BASE_WIDTH, COMMENT_CARD_BASE_HEIGHT) * 0.052);
export const COMMENT_CARD_PREVIEW_CONTENT_WIDTH = COMMENT_CARD_BUBBLE_WIDTH - COMMENT_CARD_BUBBLE_PADDING_X * 2;
export const COMMENT_CARD_TEXT_WIDTH = COMMENT_CARD_PREVIEW_CONTENT_WIDTH - COMMENT_CARD_TEXT_SAFE_INSET * 2;
export const COMMENT_CARD_PREVIEW_FRAME_WIDTH = COMMENT_CARD_BASE_WIDTH - Math.round(Math.min(COMMENT_CARD_BASE_WIDTH, COMMENT_CARD_BASE_HEIGHT) * 0.04) * 2;
export const COMMENT_CARD_PREVIEW_PADDING_X = (COMMENT_CARD_PREVIEW_FRAME_WIDTH - COMMENT_CARD_PREVIEW_CONTENT_WIDTH) / 2;

export function commentCardPreviewFontSize(size: number) {
  return `${(size / COMMENT_CARD_PREVIEW_CONTENT_WIDTH) * 100}cqw`;
}

export function parseCommentFontSizeInput(value: string): number | null {
  if (!/^\d{1,3}$/.test(value)) return null;
  const size = Number(value);
  return size >= 18 && size <= 300 ? size : null;
}

export function parseCommentLineSpacingInput(value: string): number | null {
  if (!/^\d{1,3}$/.test(value)) return null;
  const spacing = Number(value);
  return spacing <= 200 ? spacing : null;
}

export function calculateCommentLineHeight(fontSize: number, lineSpacing: number) {
  return fontSize + lineSpacing;
}

export function getCommentInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => Array.from(part)[0]?.toUpperCase() ?? "").join("");
}

export function sanitizeCommentCardFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "comment-card";
}

export function estimateCommentFontScale(characterCount: number) {
  if (characterCount > 900) return 0.025;
  if (characterCount > 600) return 0.029;
  if (characterCount > 360) return 0.034;
  if (characterCount > 180) return 0.04;
  return 0.048;
}

export function resolveCommentCardPreset(id: string) {
  const preset = COMMENT_CARD_PRESETS.find((item) => item.id === id);
  if (!preset) {
    throw new Error(`Unknown preset "${id}". Use presentation, phone, portrait, square, or wide.`);
  }
  return preset;
}

export function resolveCommentCardDimensions(presetId: string, width?: number, height?: number) {
  if (width === undefined && height === undefined) {
    const preset = resolveCommentCardPreset(presetId);
    return { width: preset.width, height: preset.height };
  }
  if (width === undefined || height === undefined) {
    throw new Error("--width and --height must be supplied together.");
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("--width and --height must be positive whole numbers.");
  }
  if (width > 12_000 || height > 12_000) {
    throw new Error("Custom dimensions cannot exceed 12,000 pixels per side.");
  }
  return { width, height };
}

export function resolveCommentCardFit(value: string): CommentCardFit {
  if (COMMENT_CARD_FIT_OPTIONS.includes(value as CommentCardFit)) return value as CommentCardFit;
  throw new Error("--fit must be contain, fill, or stretch.");
}

export function calculateCommentCardFit(width: number, height: number, fit: CommentCardFit) {
  if (fit === "stretch") {
    return {
      scaleX: width / COMMENT_CARD_BASE_WIDTH,
      scaleY: height / COMMENT_CARD_BASE_HEIGHT,
      offsetX: 0,
      offsetY: 0,
    };
  }
  const scale = fit === "contain"
    ? Math.min(width / COMMENT_CARD_BASE_WIDTH, height / COMMENT_CARD_BASE_HEIGHT)
    : Math.max(width / COMMENT_CARD_BASE_WIDTH, height / COMMENT_CARD_BASE_HEIGHT);
  return {
    scaleX: scale,
    scaleY: scale,
    offsetX: (width - COMMENT_CARD_BASE_WIDTH * scale) / 2,
    offsetY: (height - COMMENT_CARD_BASE_HEIGHT * scale) / 2,
  };
}

export function calculateCommentCardFrame(width: number, height: number) {
  const inset = Math.round(Math.min(width, height) * 0.04);
  return {
    x: inset,
    y: inset,
    width: width - inset * 2,
    height: height - inset * 2,
  };
}

export function resolveCommentFontSize(value: number) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 18 || value > 300) {
    throw new Error("Comment font size must be a whole number between 18 and 300.");
  }
  return value;
}

export function calculateCommentContentY(templateHeight: number) {
  return Math.round(templateHeight * 0.08);
}

export function paginateCommentLines(lines: string[], firstPageCapacity: number, continuationCapacity: number) {
  if (firstPageCapacity < 1 || continuationCapacity < 1) throw new Error("Comment card has no usable text area.");
  const pages: string[][] = [];
  let offset = 0;
  while (offset < lines.length) {
    while (offset < lines.length && lines[offset].trim() === "") offset += 1;
    if (offset >= lines.length) break;

    const capacity = pages.length === 0 ? firstPageCapacity : continuationCapacity;
    const maximumEnd = Math.min(offset + capacity, lines.length);
    let pageEnd = maximumEnd;

    if (maximumEnd < lines.length) {
      // Explicit blank lines represent paragraph boundaries. Prefer those first,
      // then complete sentences, and split at the hard line limit only when a
      // single paragraph/sentence cannot fit on one card.
      for (let index = maximumEnd - 1; index > offset; index -= 1) {
        if (lines[index].trim() === "") {
          pageEnd = index;
          break;
        }
      }

      if (pageEnd === maximumEnd) {
        for (let index = maximumEnd - 1; index >= offset; index -= 1) {
          if (/[.!?][\"'’”)]*$/.test(lines[index].trim())) {
            pageEnd = index + 1;
            break;
          }
        }
      }
    }

    while (pageEnd > offset && lines[pageEnd - 1].trim() === "") pageEnd -= 1;
    if (pageEnd === offset) pageEnd = maximumEnd;
    pages.push(lines.slice(offset, pageEnd));
    offset = pageEnd;
  }
  return pages.length ? pages : [[""]];
}

export function addCommentCardPartSuffix(filename: string, part: number) {
  const extensionIndex = filename.toLowerCase().lastIndexOf(".png");
  return extensionIndex === filename.length - 4
    ? `${filename.slice(0, -4)}-part-${part}.png`
    : `${filename}-part-${part}.png`;
}

export function calculateSenderFontSize(commentFontSize: number) {
  return Math.min(180, Math.max(52, Math.round(commentFontSize * 0.9)));
}

export function calculateCommentLineCapacities(commentFontSize: number, showSender: boolean, lineSpacing = Math.round(commentFontSize * 0.38)) {
  const shortestSide = Math.min(COMMENT_CARD_BASE_WIDTH, COMMENT_CARD_BASE_HEIGHT);
  const outerPadding = Math.round(shortestSide * 0.08);
  const bubblePaddingY = Math.round(shortestSide * 0.045);
  const lineHeight = calculateCommentLineHeight(commentFontSize, lineSpacing);
  const senderSize = calculateSenderFontSize(commentFontSize);
  const senderHeight = Math.round(senderSize * 1.25 + shortestSide * 0.02);
  const availableHeight = COMMENT_CARD_BASE_HEIGHT
    - calculateCommentContentY(COMMENT_CARD_BASE_HEIGHT)
    - outerPadding
    - bubblePaddingY * 2
    - COMMENT_CARD_TEXT_SAFE_INSET * 2;
  const continuation = Math.max(1, Math.floor(availableHeight / lineHeight));
  return {
    firstPage: Math.max(1, Math.floor((availableHeight - (showSender ? senderHeight : 0)) / lineHeight)),
    continuation,
  };
}

export function normalizeCommentCardFilename(value: string) {
  const filename = value.trim() || "comment-card";
  return filename.toLowerCase().endsWith(".png") ? filename : `${filename}.png`;
}
