import assert from "node:assert/strict";
import {
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_MINISTRY_PRESETS,
  DEFAULT_SERVICE_TEMPLATE_PRESETS,
  DEFAULT_SERVANT_GROUP_PRESETS,
  inferTemplateBlockType,
  normalizePresetCode,
  sortSettingsByLabel,
  validateTemplateBlocks,
} from "./settings-presets.ts";

export function runSettingsPresetTests() {
  assert.equal(normalizePresetCode("Ladies Ministry"), "LADIES_MINISTRY");
  assert.equal(normalizePresetCode("  Tech / Booth  "), "TECH_BOOTH");

  assert.deepEqual(
    DEFAULT_MINISTRY_PRESETS.map((preset) => preset.code),
    ["LEADERS", "YOUTH", "MENS", "LADIES", "MIXED"],
  );
  assert.deepEqual(
    DEFAULT_SERVANT_GROUP_PRESETS.map((preset) => preset.code),
    ["PASTORS", "CHURCH_LEADERS", "MENS", "LADIES", "YOUTH", "TECH", "MUSIC"],
  );
  assert.deepEqual(
    DEFAULT_SERVICE_TEMPLATE_PRESETS.map((preset) => preset.code),
    ["REGULAR", "FIRST_SUNDAY"],
  );
  assert.deepEqual(
    DEFAULT_SERVICE_TEMPLATE_PRESETS[0].blocks.map((block) => block.label),
    [
      "Call to Worship",
      "Praise & Worship",
      "Papuri At Pasasalamat",
      "Awit ng Pakikinig",
      "Scripture Reading",
      "Sermon",
      "Awit ng Pagtugon",
      "Offering",
      "Announcements",
    ],
  );
  assert.ok(DEFAULT_CHECKLIST_ITEMS.some((item) => item.label === "Confirm sermon verse"));

  assert.deepEqual(
    validateTemplateBlocks([{ label: "Message", order: 0 }]),
    [{ label: "Message", code: "MESSAGE", blockType: "SERMON", order: 0 }],
  );
  assert.equal(inferTemplateBlockType("Praise Set"), "PRAISE_AND_WORSHIP");
  assert.equal(inferTemplateBlockType("Custom Moment"), "DETAILS");
  assert.deepEqual(
    sortSettingsByLabel([
      { label: "Youth" },
      { label: "Ladies" },
      { label: "Men's" },
    ]).map((item) => item.label),
    ["Ladies", "Men's", "Youth"],
  );
  assert.throws(
    () => validateTemplateBlocks([]),
    /At least one service block/,
  );
}
