import assert from "node:assert/strict";
import { test } from "node:test";
import { COLOR_SET_IDS, COLOR_SETS, DEFAULT_COLOR_SET, DEFAULT_FONT_STYLE, FONT_STYLE_IDS, FONT_STYLES, contrastRatio, isColorSet, isFontStyle, lookVariables } from "./look.ts";

test("the contrast measure agrees with the known values", () => {
  assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 0.01);
  assert.ok(Math.abs(contrastRatio("#ffffff", "#ffffff") - 1) < 0.001);
  assert.equal(contrastRatio("#123456", "#abcdef"), contrastRatio("#abcdef", "#123456"), "it does not matter which colour comes first");
  assert.ok(contrastRatio("#777777", "#ffffff") < 4.5, "mid grey on white is too faint");
});

test("there are five colour sets and two font styles, with plain names", () => {
  assert.deepEqual([...COLOR_SET_IDS], ["dawn", "meadow", "harbor", "clay", "slate"]);
  assert.deepEqual([...FONT_STYLE_IDS], ["clean", "classic"]);
  for (const id of COLOR_SET_IDS) {
    assert.ok(COLOR_SETS[id].name.length > 0, id);
    assert.ok(COLOR_SETS[id].description.length > 0, id);
  }
  for (const id of FONT_STYLE_IDS) assert.ok(FONT_STYLES[id].name.length > 0, id);
});

test("a new church starts with Dawn and Clean, which keep the look the site already had", () => {
  assert.equal(DEFAULT_COLOR_SET, "dawn");
  assert.equal(DEFAULT_FONT_STYLE, "clean");
  assert.equal(COLOR_SETS.dawn.accent, "#4b3fa8");
  assert.equal(COLOR_SETS.dawn.dark, "#1f2547");
  assert.equal(COLOR_SETS.dawn.tint, "#f5f4fb");
});

test("in every colour set, every pair of text and background is easy to read (at least 4.5 to 1)", () => {
  for (const id of COLOR_SET_IDS) {
    const set = COLOR_SETS[id];
    const pairs: Array<[string, string, string]> = [
      ["white words on the accent colour", "#ffffff", set.accent],
      ["white words on the dark band", "#ffffff", set.dark],
      ["body text on white", set.text, "#ffffff"],
      ["body text on the light tint", set.text, set.tint],
      ["quiet text on white", set.muted, "#ffffff"],
      ["quiet text on the light tint", set.muted, set.tint],
      ["the accent colour as text on white", set.accent, "#ffffff"],
      ["the accent colour as text on the light tint", set.accent, set.tint],
      ["the dark colour on a white button", set.dark, "#ffffff"],
    ];
    for (const [what, foreground, background] of pairs) {
      const ratio = contrastRatio(foreground, background);
      assert.ok(ratio >= 4.5, `${id}: ${what} is ${ratio.toFixed(2)} to 1`);
    }
  }
});

test("each set has colours that look different from the others, so the choice means something", () => {
  const accents = new Set(COLOR_SET_IDS.map((id) => COLOR_SETS[id].accent));
  assert.equal(accents.size, COLOR_SET_IDS.length);
});

test("both font styles use only fonts already on the visitor's device, and Classic has serif headlines", () => {
  for (const id of FONT_STYLE_IDS) {
    for (const stack of [FONT_STYLES[id].heading, FONT_STYLES[id].body]) {
      assert.doesNotMatch(stack, /https?:|url\(/i, "no font is downloaded");
      assert.match(stack, /(sans-serif|serif)$/);
    }
  }
  assert.match(FONT_STYLES.classic.heading, /serif$/);
  assert.doesNotMatch(FONT_STYLES.classic.heading, /sans-serif$/);
  assert.match(FONT_STYLES.clean.heading, /sans-serif$/);
  assert.match(FONT_STYLES.classic.body, /sans-serif$/);
});

test("only the offered ids are accepted, and anything else falls back to the default look", () => {
  assert.equal(isColorSet("meadow"), true);
  assert.equal(isColorSet("rainbow"), false);
  assert.equal(isFontStyle("classic"), true);
  assert.equal(isFontStyle("comic"), false);
  const unknown = lookVariables("rainbow", "comic");
  const dflt = lookVariables(DEFAULT_COLOR_SET, DEFAULT_FONT_STYLE);
  assert.deepEqual(unknown, dflt);
});

test("the look is handed to the page as CSS variables, one per colour and font", () => {
  const vars = lookVariables("meadow", "classic");
  assert.equal(vars["--site-accent"], COLOR_SETS.meadow.accent);
  assert.equal(vars["--site-dark"], COLOR_SETS.meadow.dark);
  assert.equal(vars["--site-soft"], COLOR_SETS.meadow.tint);
  assert.equal(vars["--site-muted"], COLOR_SETS.meadow.muted);
  assert.equal(vars["--site-text"], COLOR_SETS.meadow.text);
  assert.equal(vars["--site-font-heading"], FONT_STYLES.classic.heading);
  assert.equal(vars["--site-font-body"], FONT_STYLES.classic.body);
  for (const [name, value] of Object.entries(vars)) {
    assert.match(name, /^--site-/);
    assert.doesNotMatch(value, /[;{}]/, "a value can never end the declaration early");
  }
});
