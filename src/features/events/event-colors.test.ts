import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { EVENT_COLORS, eventColorTokens, isEventColor } from "./event-colors.ts";
import { buildCreatePayload, initialForm } from "./event-form.ts";
import { CreateEventSchema, UpdateEventSchema } from "./event-validation.ts";

const read = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");
const tokens = read("tokens.css");

test("an event's colour is one of a fixed set of names, with the usual blue as the default", () => {
  assert.deepEqual(EVENT_COLORS.map((color) => color.id), ["DEFAULT", "PURPLE", "GREEN", "ORANGE", "RED", "PINK", "TEAL", "GRAY"]);
  assert.deepEqual(EVENT_COLORS.map((color) => color.label), ["Blue", "Purple", "Green", "Orange", "Red", "Pink", "Teal", "Gray"]);
  assert.equal(isEventColor("GREEN"), true);
  for (const bad of ["green", "MAGENTA", "", "#ff0000"]) assert.equal(isEventColor(bad), false, bad);
});

// The default colour is the one called Blue; its tokens are --event-blue-*.
const tokenName = (id: string) => (id === "DEFAULT" ? "blue" : id.toLowerCase());

test("every colour, Blue included, has a background, a text colour and a dot in the design tokens", () => {
  for (const { id } of EVENT_COLORS) {
    const name = tokenName(id);
    for (const part of ["bg", "ink", "dot"]) assert.match(tokens, new RegExp(`--event-${name}-${part}:`), `--event-${name}-${part}`);
  }
});

test("a colour is turned into the tokens a chip uses, and an unknown one falls back to the default", () => {
  assert.deepEqual(eventColorTokens("GREEN"), { bg: "var(--event-green-bg)", ink: "var(--event-green-ink)", dot: "var(--event-green-dot)" });
  // Blue is a real blue tint like the others. It used to borrow the pale grey panel colour, which matched the
  // selected day's background, so a blue chip on the selected day looked like it had no colour at all.
  assert.deepEqual(eventColorTokens("DEFAULT"), { bg: "var(--event-blue-bg)", ink: "var(--event-blue-ink)", dot: "var(--event-blue-dot)" });
  assert.doesNotMatch(tokens, /--event-default-/, "no alias for the default in the root tokens");
  assert.doesNotMatch(read("src", "features", "events", "event-colors.ts"), /surface-panel-strong/, "Blue no longer borrows the panel grey");
  assert.deepEqual(eventColorTokens("NOPE"), eventColorTokens("DEFAULT"));
  assert.deepEqual(eventColorTokens(undefined), eventColorTokens("DEFAULT"));
});

// Contrast between a chip's text and its background, so the colours stay readable (WCAG AA is 4.5).
function luminance(hex: string) {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
const contrast = (a: string, b: string) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05); };

test("the text on every coloured chip is easy to read", () => {
  for (const { id } of EVENT_COLORS) {
    const name = tokenName(id);
    const bg = tokens.match(new RegExp(`--event-${name}-bg:\\s*(#[0-9A-Fa-f]{6})`))?.[1];
    const ink = tokens.match(new RegExp(`--event-${name}-ink:\\s*(#[0-9A-Fa-f]{6})`))?.[1];
    assert.ok(bg && ink, `${id} tokens are hex colours`);
    assert.ok(contrast(bg!, ink!) >= 4.5, `${id} text on its background is at least 4.5 to 1 (${contrast(bg!, ink!).toFixed(1)})`);
  }
});

test("a new event starts with the default colour, and the chosen colour is sent with it", () => {
  assert.equal(initialForm("2026-11-04").color, "DEFAULT");
  const payload = buildCreatePayload({ ...initialForm("2026-11-04"), title: "Youth night", color: "GREEN" }, "Asia/Manila");
  assert.equal(payload.color, "GREEN");
  assert.equal(CreateEventSchema.safeParse(payload).success, true);
});

test("the server accepts only a colour from the set, and a missing colour means the default", () => {
  const base = buildCreatePayload({ ...initialForm("2026-11-04"), title: "Youth night" }, "Asia/Manila");
  assert.equal(CreateEventSchema.safeParse({ ...base, color: "MAGENTA" }).success, false);
  assert.equal(CreateEventSchema.parse({ ...base, color: undefined }).color, "DEFAULT");
  assert.equal(UpdateEventSchema.safeParse({ color: "RED" }).success, true);
  assert.equal(UpdateEventSchema.safeParse({ color: "#ff0000" }).success, false);
  assert.equal(UpdateEventSchema.safeParse({ title: "Bible study" }).success, true, "colour is optional when editing");
});

test("the swatches sit in one even row of eight", () => {
  assert.match(read("src", "features", "events", "event-color-picker.tsx"), /grid grid-cols-8/);
});

test("the colour is stored, sent to the screen, and changeable", () => {
  assert.match(read("prisma", "schema.prisma"), /model ChurchEvent \{[\s\S]*?color\s+String\s+@default\("DEFAULT"\)[\s\S]*?\n\}/);
  assert.match(read("prisma", "migrations-current", "20261031000000_event_color", "migration.sql"), /ALTER TABLE "ChurchEvent" ADD COLUMN "color" TEXT NOT NULL DEFAULT 'DEFAULT'/);
  const list = read("src", "app", "api", "events", "route.ts");
  assert.match(list, /color: true/, "read from the database");
  assert.match(list, /color: occurrence\.event\.color/, "sent with each date");
  assert.match(list, /color: input\.color/, "stored when an event is created");
  assert.match(read("src", "app", "api", "events", "[id]", "route.ts"), /input\.color/, "changed when an event is edited");
  assert.match(read("src", "features", "events", "event-types.ts"), /color: string/);
});

test("colours are chosen with named swatches in the New event and Edit event forms, and shown on the calendar", () => {
  const picker = read("src", "features", "events", "event-color-picker.tsx");
  assert.match(picker, /role="radiogroup"/);
  assert.match(picker, /aria-label=\{color\.label\}/, "each swatch has a name, not just a colour");
  assert.match(picker, /aria-checked/);
  assert.match(read("src", "features", "events", "event-form-fields.tsx"), /<EventColorPicker/);
  const details = read("src", "features", "events", "event-details.tsx");
  assert.match(details, /<EventColorPicker/);
  assert.match(details, /color !== item\.color \? \{ color \} : \{\}/, "the edit form saves a changed colour, and only a changed one");
  const grid = read("src", "features", "events", "event-month-grid.tsx");
  assert.match(grid, /eventColorTokens\(item\.color\)/);
  assert.match(grid, /style=\{cancelled \? undefined : \{ background: chip\.bg, color: chip\.ink, boxShadow: /);
  assert.match(grid, /inset 0 0 0 1px color-mix\(in oklab, \$\{chip\.ink\} 22%, transparent\)/, "a thin outline keeps a chip visible on any background, such as the selected day");
  assert.match(grid, /item\.status === "CANCELLED"[^\n]*text-\[var\(--text-muted\)\] line-through/, "a cancelled date stays grey whatever its colour");
});
