import assert from "node:assert/strict";
import {
  AlwaysActiveServiceTemplatePresetSchema,
  AlwaysActiveUpdateServiceTemplatePresetSchema,
  ActivateChecklistPresetSchema,
  CreateChecklistPresetSchema,
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_MINISTRY_PRESETS,
  DEFAULT_SERVICE_TEMPLATE_PRESETS,
  DEFAULT_SERVANT_GROUP_PRESETS,
  inferTemplateBlockType,
  moveTemplateBlock,
  normalizePresetCode,
  sortSettingsByLabel,
  UpdateChecklistPresetSchema,
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
  assert.ok(DEFAULT_SERVICE_TEMPLATE_PRESETS.every((preset) => preset.active && !preset.isDefault));
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
  assert.equal(CreateChecklistPresetSchema.parse({ name: "  Sunday prep  " }).name, "Sunday prep");
  assert.equal(ActivateChecklistPresetSchema.parse({ checklistId: "checklist-1" }).checklistId, "checklist-1");
  assert.deepEqual(
    UpdateChecklistPresetSchema.parse({
      name: "Sunday prep",
      items: [{ id: "item-1", label: "  Test microphones  ", active: true }],
    }).items,
    [{ id: "item-1", label: "Test microphones", active: true }],
  );
  assert.equal(
    UpdateChecklistPresetSchema.safeParse({
      name: "Sunday prep",
      items: [
        { id: "item-1", label: "One", active: true },
        { id: "item-1", label: "Two", active: true },
      ],
    }).success,
    false,
  );

  assert.deepEqual(
    validateTemplateBlocks([{ label: "Message", order: 0 }]),
    [{ label: "Message", code: "MESSAGE", blockType: "SERMON", order: 0 }],
  );
  assert.equal(inferTemplateBlockType("Praise Set"), "PRAISE_AND_WORSHIP");
  assert.equal(inferTemplateBlockType("Custom Moment"), "DETAILS");
  assert.deepEqual(moveTemplateBlock(["Call", "Sermon", "Offering"], 0, 2), ["Sermon", "Offering", "Call"]);
  assert.equal(
    AlwaysActiveServiceTemplatePresetSchema.parse({
      label: "Evening Worship",
      code: "EVENING_WORSHIP",
      active: false,
      templateType: "REGULAR",
      optionalBlocks: [],
      blocks: [{ label: "Sermon" }],
    }).active,
    true,
  );
  assert.equal(AlwaysActiveUpdateServiceTemplatePresetSchema.parse({ active: false }).active, true);
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
