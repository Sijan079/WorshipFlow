import type { COVER_FOCUS_POINTS } from "./block-validation.ts";

type Focus = (typeof COVER_FOCUS_POINTS)[number];

// How much the picture behind a Cover's words is darkened. Even the lightest still darkens it by about a third, so
// white words stay readable on a bright photo; there is no "none".
export const COVER_OVERLAY = { light: 0.35, medium: 0.5, strong: 0.65 } as const;

// The crop point as a CSS background position: which part of the picture stays in view when it is cropped to fit.
export function coverFocusPosition(focus: Focus) {
  const x = focus.includes("left") || focus === "left" ? 0 : focus.includes("right") || focus === "right" ? 100 : 50;
  const y = focus.startsWith("top") ? 0 : focus.startsWith("bottom") ? 100 : 50;
  return `${x}% ${y}%`;
}
