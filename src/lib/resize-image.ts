export const PRESENTATION_WIDTH = 1920;
export const PRESENTATION_HEIGHT = 1080;

type CalculateContainLayoutInput = {
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

export function calculateContainLayout({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
}: CalculateContainLayoutInput): ContainLayout {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error("Image dimensions must be greater than zero.");
  }

  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const drawWidth = Math.round(sourceWidth * scale);
  const drawHeight = Math.round(sourceHeight * scale);

  return {
    drawWidth,
    drawHeight,
    offsetX: Math.round((targetWidth - drawWidth) / 2),
    offsetY: Math.round((targetHeight - drawHeight) / 2),
  };
}
