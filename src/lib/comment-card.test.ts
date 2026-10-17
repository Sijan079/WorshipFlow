import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMMENT_CARD_PRESETS,
  estimateCommentFontScale,
  getCommentInitials,
  sanitizeCommentCardFilename,
  resolveCommentCardPreset,
  resolveCommentCardDimensions,
  resolveCommentCardFit,
  calculateCommentCardFit,
  calculateCommentCardFrame,
  resolveCommentFontSize,
  parseCommentFontSizeInput,
  parseCommentLineSpacingInput,
  calculateCommentLineHeight,
  calculateCommentContentY,
  paginateCommentLines,
  addCommentCardPartSuffix,
  calculateSenderFontSize,
  calculateCommentLineCapacities,
  normalizeCommentCardFilename,
  COMMENT_CARD_TEXT_SAFE_INSET,
  COMMENT_CARD_BUBBLE_WIDTH,
  COMMENT_CARD_BUBBLE_PADDING_X,
  COMMENT_CARD_PREVIEW_CONTENT_WIDTH,
  COMMENT_CARD_TEXT_WIDTH,
  COMMENT_CARD_PREVIEW_FRAME_WIDTH,
  COMMENT_CARD_PREVIEW_PADDING_X,
  commentCardPreviewFontSize,
} from "./comment-card.ts";

export function runCommentCardTests() {
  assert.equal(getCommentInitials("Maria Santos"), "MS");
  assert.equal(getCommentInitials("  Maria  "), "M");
  assert.equal(getCommentInitials(""), "?");
  assert.equal(sanitizeCommentCardFilename("Maria's Comment!"), "maria-s-comment");
  assert.equal(sanitizeCommentCardFilename(""), "comment-card");
  assert.ok(estimateCommentFontScale(100) > estimateCommentFontScale(700));
  assert.ok(COMMENT_CARD_PRESETS.some((preset) => preset.width === 4800 && preset.height === 2400));
  assert.deepEqual(resolveCommentCardPreset("phone"), COMMENT_CARD_PRESETS[1]);
  assert.throws(() => resolveCommentCardPreset("poster"), /Unknown preset/);
  assert.deepEqual(resolveCommentCardDimensions("presentation", 2400, 1350), { width: 2400, height: 1350 });
  assert.deepEqual(resolveCommentCardDimensions("phone"), { width: 1080, height: 2400 });
  assert.throws(() => resolveCommentCardDimensions("presentation", 2400), /together/);
  assert.throws(() => resolveCommentCardDimensions("presentation", 0, 1080), /positive whole numbers/);
  assert.throws(() => resolveCommentCardDimensions("presentation", 13000, 1080), /12,000/);
  assert.equal(resolveCommentCardFit("fill"), "fill");
  assert.throws(() => resolveCommentCardFit("crop"), /contain, fill, or stretch/);
  assert.deepEqual(calculateCommentCardFit(1920, 1080, "stretch"), {
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
  });
  assert.equal(calculateCommentCardFit(1080, 2400, "contain").scaleX, 0.5625);
  assert.ok(calculateCommentCardFit(1080, 2400, "fill").offsetX < 0);
  assert.deepEqual(calculateCommentCardFrame(1080, 2400), {
    x: 43,
    y: 43,
    width: 994,
    height: 2314,
  });
  assert.equal(resolveCommentFontSize(64), 64);
  assert.throws(() => resolveCommentFontSize(12), /between 18 and 300/);
  assert.equal(parseCommentFontSizeInput(""), null);
  assert.equal(parseCommentFontSizeInput("3"), null);
  assert.equal(parseCommentFontSizeInput("32"), 32);
  assert.equal(parseCommentFontSizeInput("300"), 300);
  assert.equal(parseCommentFontSizeInput("301"), null);
  assert.equal(parseCommentFontSizeInput("32px"), null);
  assert.equal(parseCommentLineSpacingInput(""), null);
  assert.equal(parseCommentLineSpacingInput("0"), 0);
  assert.equal(parseCommentLineSpacingInput("20"), 20);
  assert.equal(parseCommentLineSpacingInput("200"), 200);
  assert.equal(parseCommentLineSpacingInput("201"), null);
  assert.equal(calculateCommentLineHeight(52, 20), 72);
  assert.equal(calculateCommentContentY(1080), 86);
  assert.deepEqual(paginateCommentLines(["1", "2", "3", "4", "5"], 2, 3), [["1", "2"], ["3", "4", "5"]]);
  assert.deepEqual(paginateCommentLines(["1", "2", "3", "4", "5", "6"], 2, 2), [["1", "2"], ["3", "4"], ["5", "6"]]);
  assert.deepEqual(
    paginateCommentLines(
      ["First paragraph.", "", "Second sentence continues", "onto this line.", "Third sentence."],
      4,
      4,
    ),
    [["First paragraph."], ["Second sentence continues", "onto this line.", "Third sentence."]],
  );
  assert.deepEqual(
    paginateCommentLines(
      ["I am known, loved, and created by You for a", "purpose.", "A new sentence begins", "and keeps going."],
      3,
      3,
    ),
    [["I am known, loved, and created by You for a", "purpose."], ["A new sentence begins", "and keeps going."]],
  );
  assert.equal(addCommentCardPartSuffix("card.png", 2), "card-part-2.png");
  assert.equal(calculateSenderFontSize(52), 52);
  assert.equal(calculateSenderFontSize(100), 90);
  assert.deepEqual(calculateCommentLineCapacities(52, true), { firstPage: 9, continuation: 10 });
  assert.deepEqual(calculateCommentLineCapacities(52, false), { firstPage: 10, continuation: 10 });
  assert.ok(calculateCommentLineCapacities(52, false, 60).continuation < calculateCommentLineCapacities(52, false, 20).continuation);
  assert.equal(calculateCommentLineCapacities(300, true, 200).firstPage, 1);
  assert.equal(normalizeCommentCardFilename("Sunday Comment.PNG"), "Sunday Comment.PNG");
  assert.equal(normalizeCommentCardFilename("Sunday Comment"), "Sunday Comment.png");
  assert.equal(COMMENT_CARD_TEXT_SAFE_INSET, 24);
  assert.equal(COMMENT_CARD_BUBBLE_WIDTH, 1748);
  assert.equal(COMMENT_CARD_BUBBLE_PADDING_X, 56);
  assert.equal(COMMENT_CARD_PREVIEW_CONTENT_WIDTH, 1636);
  assert.equal(COMMENT_CARD_TEXT_WIDTH, 1588);
  assert.equal(COMMENT_CARD_PREVIEW_FRAME_WIDTH, 1834);
  assert.equal(COMMENT_CARD_PREVIEW_PADDING_X, 99);
  assert.equal(commentCardPreviewFontSize(52), `${(52 / 1636) * 100}cqw`);

  const playground = readFileSync(join(process.cwd(), "scripts", "comment-card-playground.html"), "utf8");
  assert.match(playground, /localStorage\.setItem/);
  assert.match(playground, /name="comment"/);
  assert.match(playground, /name="fit"/);
  assert.match(playground, /name="fontSize"/);
  assert.match(playground, /name="showSender"/);
  assert.match(playground, /name="showBoundaries"/);
  assert.match(playground, /Text safe area/);
  assert.match(playground, /id="preview-list"/);
  assert.match(playground, /requestedName/);
  assert.match(playground, /context\.clip\(\)/);
  assert.match(playground, /fitTextToWidth/);
  assert.match(playground, /showDirectoryPicker/);

  const siteTool = readFileSync(join(process.cwd(), "src", "components", "comment-card-tool.tsx"), "utf8");
  const globalStyles = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
  assert.match(siteTool, /aria-label="Sender name on card"/);
  assert.match(siteTool, /aria-label="Comment text on card"/);
  assert.match(siteTool, /previewPages\.map/);
  assert.match(siteTool, /Export pages/);
  assert.match(siteTool, /textSafeAreaStyle/);
  assert.match(siteTool, /overflow-hidden/);
  assert.match(siteTool, /aria-label="Download filename"/);
  assert.match(siteTool, /appearance-none bg-transparent border-0 border-b/);
  assert.match(siteTool, /className="h-4 w-4"/);
  assert.match(siteTool, /editingFilename \? "Finish renaming" : "Rename comment card"/);
  assert.match(siteTool, /filename \|\| "comment-card"/);
  assert.match(siteTool, /role="group" aria-label="Fit mode"/);
  assert.match(siteTool, /aria-pressed=\{fit === item\}/);
  assert.doesNotMatch(siteTool, /comment-card-ribbon-group/);
  assert.doesNotMatch(siteTool, /<fieldset/);
  assert.match(siteTool, /id="comment-card-options"[^>]*className="flex flex-wrap items-end gap-3/);
  assert.match(siteTool, /max-\[599px\]:data-\[open=false\]:hidden/);
  assert.match(siteTool, /appearance-none border-0 rounded-none bg-transparent/);
  assert.doesNotMatch(globalStyles, /\.comment-card-(?:toolbar|editor-field|filename-input)/);
  assert.match(siteTool, /min-\[1200px\]:min-h-\[520px\]/);
  assert.match(siteTool, /aria-controls="comment-card-options" aria-expanded=\{optionsOpen\}/);
  assert.doesNotMatch(globalStyles, /\.comment-card-ribbon-group/);
  assert.match(siteTool, /<Check className="h-4 w-4" aria-hidden="true" \/> : <Pencil className="h-4 w-4" aria-hidden="true" \/>/);
  assert.doesNotMatch(siteTool, /onBlur=\{finishFilenameRename\}/);
  assert.doesNotMatch(siteTool, />Edit card</);
  assert.doesNotMatch(siteTool, /<span className="technical-label">Filename<\/span>/);
  assert.doesNotMatch(siteTool, /<aside/);
}
