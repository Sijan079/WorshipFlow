// Indigo is the main color and the default. Teal is a theme each person can pick.
// Only palette tokens change with the theme (see tokens.css and docs/changes/20261101.md).
export const ACCENT_THEMES = ["indigo", "teal"] as const;
export type AccentTheme = (typeof ACCENT_THEMES)[number];

export const DEFAULT_ACCENT_THEME: AccentTheme = "indigo";
export const ACCENT_THEME_COOKIE = "wf-accent";
export const ACCENT_THEME_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const ACCENT_THEME_OPTIONS: ReadonlyArray<{
  id: AccentTheme;
  label: string;
  description: string;
  swatch: { main: string; rail: string; secondary: string };
}> = [
  {
    id: "indigo",
    label: "Indigo",
    description: "Deep blue-violet buttons with a midnight side bar. The default.",
    swatch: { main: "#4338ca", rail: "#0e1330", secondary: "#0369a1" },
  },
  {
    id: "teal",
    label: "Teal",
    description: "Calm green-blue buttons with a deep green side bar.",
    swatch: { main: "#0f766e", rail: "#0a1f1a", secondary: "#334155" },
  },
];

export function parseAccentTheme(value: unknown): AccentTheme {
  return typeof value === "string" && (ACCENT_THEMES as readonly string[]).includes(value)
    ? (value as AccentTheme)
    : DEFAULT_ACCENT_THEME;
}

// Browser only: remember the choice on this device and recolor the app at once by updating the marker
// that tokens.css keys the palette on.
export function saveAccentTheme(theme: AccentTheme) {
  document.cookie = `${ACCENT_THEME_COOKIE}=${theme}; path=/; max-age=${ACCENT_THEME_MAX_AGE_SECONDS}; samesite=lax`;
  document.querySelector("[data-app-theme]")?.setAttribute("data-app-theme", theme);
}
