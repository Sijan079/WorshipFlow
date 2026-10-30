// The look of a church's public site: one of five colour sets and one of two font styles. There are no free colour
// pickers, so every combination is one that has been checked: each colour set's text and backgrounds meet the
// contrast rule (at least 4.5 to 1) in look.test.ts.

export const COLOR_SET_IDS = ["dawn", "meadow", "harbor", "clay", "slate"] as const;
export const FONT_STYLE_IDS = ["clean", "classic"] as const;
export type ColorSetId = (typeof COLOR_SET_IDS)[number];
export type FontStyleId = (typeof FONT_STYLE_IDS)[number];

export const DEFAULT_COLOR_SET: ColorSetId = "dawn";
export const DEFAULT_FONT_STYLE: FontStyleId = "clean";

type ColorSet = {
  name: string;
  description: string;
  // Buttons, links and the "church colour" band.
  accent: string;
  accentText: string;
  // The dark band, and the footer.
  dark: string;
  // The light tinted band and the boxes inside it.
  tint: string;
  text: string;
  // Quieter text: dates, captions.
  muted: string;
};

export const COLOR_SETS: Record<ColorSetId, ColorSet> = {
  dawn: { name: "Dawn", description: "Deep indigo, night blue and soft lavender", accent: "#4b3fa8", accentText: "#ffffff", dark: "#1f2547", tint: "#f5f4fb", text: "#1f2430", muted: "#5b6475" },
  meadow: { name: "Meadow", description: "Forest green, very dark green and pale sage", accent: "#2f6b3f", accentText: "#ffffff", dark: "#14301f", tint: "#f1f6f0", text: "#1e2a22", muted: "#4d5f53" },
  harbor: { name: "Harbor", description: "Ocean blue, navy and pale sky", accent: "#1f5f9e", accentText: "#ffffff", dark: "#12284a", tint: "#edf4fa", text: "#1b2733", muted: "#4a5d70" },
  clay: { name: "Clay", description: "Warm terracotta, dark brown and sand", accent: "#a4472a", accentText: "#ffffff", dark: "#3b261c", tint: "#f8f1ea", text: "#2c211b", muted: "#6a5648" },
  slate: { name: "Slate", description: "Deep teal, charcoal and light grey", accent: "#0f6b6b", accentText: "#ffffff", dark: "#263238", tint: "#f0f4f5", text: "#1f2a2e", muted: "#4b5a60" },
};

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", Times, serif';

// Both styles use only fonts already on the visitor's device: nothing is downloaded, nothing is tracked, and
// nothing breaks if a font service is down.
export const FONT_STYLES: Record<FontStyleId, { name: string; description: string; heading: string; body: string }> = {
  clean: { name: "Clean", description: "All sans-serif", heading: SANS, body: SANS },
  classic: { name: "Classic", description: "Serif headlines with a sans-serif body", heading: SERIF, body: SANS },
};

export const isColorSet = (value: unknown): value is ColorSetId => typeof value === "string" && (COLOR_SET_IDS as readonly string[]).includes(value);
export const isFontStyle = (value: unknown): value is FontStyleId => typeof value === "string" && (FONT_STYLE_IDS as readonly string[]).includes(value);

function channel(value: number) {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

// How easy text is to read on a background: 1 is no difference, 21 is black on white, 4.5 is the lowest we accept.
export function contrastRatio(foreground: string, background: string) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// The look as CSS variables for the public page. Anything that is not one of the offered ids falls back to the default.
export function lookVariables(colorSet: string, fontStyle: string): Record<string, string> {
  const colors = COLOR_SETS[isColorSet(colorSet) ? colorSet : DEFAULT_COLOR_SET];
  const fonts = FONT_STYLES[isFontStyle(fontStyle) ? fontStyle : DEFAULT_FONT_STYLE];
  return {
    "--site-accent": colors.accent,
    "--site-accent-text": colors.accentText,
    "--site-dark": colors.dark,
    "--site-soft": colors.tint,
    "--site-text": colors.text,
    "--site-muted": colors.muted,
    "--site-font-heading": fonts.heading,
    "--site-font-body": fonts.body,
  };
}
