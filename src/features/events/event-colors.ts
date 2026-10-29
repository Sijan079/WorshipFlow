// The colours an event can have in the calendar. A fixed set of named colours, not a free picker, so the
// calendar keeps one consistent look. DEFAULT is the usual blue every event had before colours existed.
export const EVENT_COLORS = [
  { id: "DEFAULT", label: "Blue" },
  { id: "PURPLE", label: "Purple" },
  { id: "GREEN", label: "Green" },
  { id: "ORANGE", label: "Orange" },
  { id: "RED", label: "Red" },
  { id: "PINK", label: "Pink" },
  { id: "TEAL", label: "Teal" },
  { id: "GRAY", label: "Gray" },
] as const;

export type EventColor = (typeof EVENT_COLORS)[number]["id"];

export const EVENT_COLOR_IDS = EVENT_COLORS.map((color) => color.id) as [EventColor, ...EventColor[]];

export function isEventColor(value: unknown): value is EventColor {
  return typeof value === "string" && (EVENT_COLOR_IDS as string[]).includes(value);
}

// The design tokens for a chip of this colour: a soft background, strong text, and the solid dot. The default
// is the colour called Blue, whose tokens are --event-blue-*. It used to borrow the pale grey panel colour,
// which matched the selected day's background, so a blue chip on the selected day seemed to have no colour.
// An unknown or missing colour is the default, so a stale value can never leave a chip unstyled.
export function eventColorTokens(color: string | undefined) {
  const name = !isEventColor(color) || color === "DEFAULT" ? "blue" : color.toLowerCase();
  return { bg: `var(--event-${name}-bg)`, ink: `var(--event-${name}-ink)`, dot: `var(--event-${name}-dot)` };
}
