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

export function validateSourceCrop(
  crop: SourceCrop,
  sourceWidth: number,
  sourceHeight: number
): string | null {
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isInteger)) {
    return "Crop coordinates and dimensions must be whole numbers.";
  }
  if (crop.x < 0 || crop.y < 0) {
    return "Crop coordinates must be non-negative.";
  }
  if (crop.width <= 0 || crop.height <= 0) {
    return "Crop width and height must be greater than zero.";
  }
  if (crop.x + crop.width > sourceWidth || crop.y + crop.height > sourceHeight) {
    return "Crop must stay inside the source image.";
  }
  return null;
}

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

export function enhanceScreenshotPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  amount = 0.55
) {
  if (pixels.length !== width * height * 4 || width <= 0 || height <= 0) {
    throw new Error("Pixel data does not match the image dimensions.");
  }
  if (!Number.isFinite(amount) || amount < 0 || amount > 2) {
    throw new Error("Screenshot enhancement amount must be between 0 and 2.");
  }

  const output = new Uint8ClampedArray(pixels);
  const blurWeights = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const luminanceAt = (x: number, y: number) => {
    const sampleX = Math.max(0, Math.min(width - 1, x));
    const sampleY = Math.max(0, Math.min(height - 1, y));
    const offset = (sampleY * width + sampleX) * 4;
    return pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      let blurredLuminance = 0;
      let gradientX = 0;
      let gradientY = 0;
      let weightIndex = 0;
      for (let kernelY = -1; kernelY <= 1; kernelY += 1) {
        for (let kernelX = -1; kernelX <= 1; kernelX += 1) {
          const luminance = luminanceAt(x + kernelX, y + kernelY);
          blurredLuminance += luminance * blurWeights[weightIndex];
          gradientX += luminance * sobelX[weightIndex];
          gradientY += luminance * sobelY[weightIndex];
          weightIndex += 1;
        }
      }
      blurredLuminance /= 16;
      const originalLuminance = luminanceAt(x, y);
      const edgeStrength = Math.hypot(gradientX, gradientY) / 4;
      const edgeWeight = Math.max(0, Math.min(1, (edgeStrength - 6) / 42));
      const luminanceDelta = amount * edgeWeight * (originalLuminance - blurredLuminance);
      output[offset] = Math.round(pixels[offset] + luminanceDelta);
      output[offset + 1] = Math.round(pixels[offset + 1] + luminanceDelta);
      output[offset + 2] = Math.round(pixels[offset + 2] + luminanceDelta);
      output[offset + 3] = pixels[offset + 3];
    }
  }

  return output;
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

export function canReuseSourceImage(
  source: { width: number; height: number },
  target: { width: number; height: number },
  sameFormat: boolean,
  hasEdits: boolean
) {
  return (
    !hasEdits &&
    sameFormat &&
    source.width === target.width &&
    source.height === target.height
  );
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
