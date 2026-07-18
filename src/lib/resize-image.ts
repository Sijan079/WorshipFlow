import type { DevicePreset } from "./device-presets";

export const MAX_SOURCE_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_WIDTH = 10_000;
export const MAX_HEIGHT = 10_000;
export const MAX_TOTAL_PIXELS = 40_000_000;
export const MIN_DIMENSION = 64;

export type Orientation = "portrait" | "landscape";
export type FitMode = "fit" | "fill" | "stretch" | "blur";
export type CropState = { zoom: number; positionX: number; positionY: number };
export type SourceCrop = { x: number; y: number; width: number; height: number };
export type ImageTransform = {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  destinationX: number;
  destinationY: number;
  destinationWidth: number;
  destinationHeight: number;
  canvasWidth: number;
  canvasHeight: number;
};

type TransformInput = {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
};

type ContainLayout = {
  drawWidth: number;
  drawHeight: number;
  offsetX: number;
  offsetY: number;
};

export function detectContentBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance = 24
): SourceCrop | null {
  if (pixels.length !== width * height * 4 || width <= 0 || height <= 0) {
    throw new Error("Pixel data does not match the image dimensions.");
  }

  const cornerOffsets = [0, (width - 1) * 4, (height - 1) * width * 4, (width * height - 1) * 4];
  const background = [0, 1, 2, 3].map(
    (channel) =>
      cornerOffsets.reduce((total, offset) => total + pixels[offset + channel], 0) /
      cornerOffsets.length
  );
  const rowThreshold = Math.max(2, Math.ceil(width * 0.005));
  const columnThreshold = Math.max(2, Math.ceil(height * 0.005));
  const differsFromBackground = (offset: number) =>
    [0, 1, 2, 3].some(
      (channel) => Math.abs(pixels[offset + channel] - background[channel]) > tolerance
    );

  let top = 0;
  while (top < height) {
    let changed = 0;
    for (let x = 0; x < width && changed < rowThreshold; x += 1) {
      if (differsFromBackground((top * width + x) * 4)) changed += 1;
    }
    if (changed >= rowThreshold) break;
    top += 1;
  }

  if (top === height) return null;

  let bottom = height - 1;
  while (bottom > top) {
    let changed = 0;
    for (let x = 0; x < width && changed < rowThreshold; x += 1) {
      if (differsFromBackground((bottom * width + x) * 4)) changed += 1;
    }
    if (changed >= rowThreshold) break;
    bottom -= 1;
  }

  let left = 0;
  while (left < width) {
    let changed = 0;
    for (let y = top; y <= bottom && changed < columnThreshold; y += 1) {
      if (differsFromBackground((y * width + left) * 4)) changed += 1;
    }
    if (changed >= columnThreshold) break;
    left += 1;
  }

  let right = width - 1;
  while (right > left) {
    let changed = 0;
    for (let y = top; y <= bottom && changed < columnThreshold; y += 1) {
      if (differsFromBackground((y * width + right) * 4)) changed += 1;
    }
    if (changed >= columnThreshold) break;
    right -= 1;
  }

  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

function assertDimensions({ sourceWidth, sourceHeight, targetWidth, targetHeight }: TransformInput) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error("Image dimensions must be greater than zero.");
  }
}

export function calculateFitTransform(input: TransformInput): ImageTransform {
  assertDimensions(input);
  const { sourceWidth, sourceHeight, targetWidth, targetHeight } = input;
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const destinationWidth = sourceWidth * scale;
  const destinationHeight = sourceHeight * scale;

  return {
    sourceX: 0,
    sourceY: 0,
    sourceWidth,
    sourceHeight,
    destinationX: (targetWidth - destinationWidth) / 2,
    destinationY: (targetHeight - destinationHeight) / 2,
    destinationWidth,
    destinationHeight,
    canvasWidth: targetWidth,
    canvasHeight: targetHeight,
  };
}

export function calculateFillTransform(
  input: TransformInput & { crop?: CropState }
): ImageTransform {
  assertDimensions(input);
  const { sourceWidth, sourceHeight, targetWidth, targetHeight } = input;
  const crop = input.crop ?? { zoom: 1, positionX: 0, positionY: 0 };
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight) * Math.max(1, crop.zoom);
  const destinationWidth = sourceWidth * scale;
  const destinationHeight = sourceHeight * scale;
  const overflowX = destinationWidth - targetWidth;
  const overflowY = destinationHeight - targetHeight;
  const positionX = Math.max(-1, Math.min(1, crop.positionX));
  const positionY = Math.max(-1, Math.min(1, crop.positionY));

  return {
    sourceX: 0,
    sourceY: 0,
    sourceWidth,
    sourceHeight,
    destinationX: overflowX === 0 || positionX === -1 ? 0 : -overflowX * ((positionX + 1) / 2),
    destinationY: overflowY === 0 || positionY === -1 ? 0 : -overflowY * ((positionY + 1) / 2),
    destinationWidth,
    destinationHeight,
    canvasWidth: targetWidth,
    canvasHeight: targetHeight,
  };
}

export function calculateStretchTransform(input: TransformInput): ImageTransform {
  assertDimensions(input);
  return {
    sourceX: 0,
    sourceY: 0,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    destinationX: 0,
    destinationY: 0,
    destinationWidth: input.targetWidth,
    destinationHeight: input.targetHeight,
    canvasWidth: input.targetWidth,
    canvasHeight: input.targetHeight,
  };
}

export function calculateBlurredBackgroundTransform(input: TransformInput): ImageTransform {
  return calculateFitTransform(input);
}

export function getTargetDimensions(
  preset: DevicePreset | null,
  customWidth: number,
  customHeight: number,
  orientation: Orientation
) {
  const portraitWidth = preset?.portraitWidth ?? customWidth;
  const portraitHeight = preset?.portraitHeight ?? customHeight;
  return orientation === "portrait"
    ? { width: portraitWidth, height: portraitHeight }
    : { width: portraitHeight, height: portraitWidth };
}

export function validateTargetDimensions(width: number, height: number): string | null {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return "Width and height must be whole numbers.";
  }
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return `Width and height must be at least ${MIN_DIMENSION}px.`;
  }
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    return `Width and height cannot exceed ${MAX_WIDTH}px by ${MAX_HEIGHT}px.`;
  }
  if (width * height > MAX_TOTAL_PIXELS) {
    return `Output cannot exceed ${MAX_TOTAL_PIXELS.toLocaleString()} pixels.`;
  }
  return null;
}

export function generateOutputFilename(
  sourceName: string,
  presetId: string,
  orientation: Orientation,
  extension: "png" | "jpeg" | "webp"
) {
  const baseName = sourceName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "image";
  const targetName = presetId.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `${baseName}-${targetName}-${orientation}.${extension === "jpeg" ? "jpg" : extension}`;
}

export function calculateContainLayout({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
}: TransformInput): ContainLayout {
  const transform = calculateFitTransform({ sourceWidth, sourceHeight, targetWidth, targetHeight });

  return {
    drawWidth: Math.round(transform.destinationWidth),
    drawHeight: Math.round(transform.destinationHeight),
    offsetX: Math.round(transform.destinationX),
    offsetY: Math.round(transform.destinationY),
  };
}
