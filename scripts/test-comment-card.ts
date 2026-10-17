import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  COMMENT_CARD_BASE_HEIGHT,
  COMMENT_CARD_BASE_WIDTH,
  COMMENT_CARD_FONT_FAMILY,
  COMMENT_CARD_TEXT_SAFE_INSET,
  calculateCommentCardFit,
  calculateCommentCardFrame,
  calculateCommentContentY,
  resolveCommentCardPreset,
  resolveCommentCardDimensions,
  resolveCommentCardFit,
  resolveCommentFontSize,
  sanitizeCommentCardFilename,
  paginateCommentLines,
  addCommentCardPartSuffix,
  calculateSenderFontSize,
  calculateCommentLineCapacities,
} from "../src/lib/comment-card.ts";

type Options = {
  name: string;
  comment: string;
  preset: string;
  output?: string;
  width?: number;
  height?: number;
  fit: string;
  fontSize: number;
  showSender: boolean;
};

function usage() {
  return [
    "Usage:",
    "  npm run test:comment-card -- --name \"Maria Santos\" --comment \"Comment text\"",
    "",
    "Options:",
    "  --preset presentation|phone|portrait|square|wide",
    "  --width 2400 --height 1350 (overrides the preset)",
    "  --fit contain|fill|stretch",
    "  --font-size 52",
    "  --hide-sender",
    "  --output .tmp/comment-card-inspection/custom-name.png",
    "  --details Alias for --comment",
  ].join("\n");
}

function parseOptions(args: string[]): Options {
  const options: Options = { name: "", comment: "", preset: "presentation", fit: "contain", fontSize: 52, showSender: true };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--name") options.name = args[++index] ?? "";
    else if (argument === "--comment" || argument === "--details") options.comment = args[++index] ?? "";
    else if (argument === "--preset") options.preset = args[++index] ?? "";
    else if (argument === "--fit") options.fit = args[++index] ?? "";
    else if (argument === "--font-size") options.fontSize = Number(args[++index]);
    else if (argument === "--hide-sender") options.showSender = false;
    else if (argument === "--width" || argument === "--height") {
      const value = args[++index] ?? "";
      if (!/^\d+$/.test(value)) throw new Error(`${argument} requires a positive whole number.`);
      options[argument === "--width" ? "width" : "height"] = Number(value);
    }
    else if (argument === "--output") options.output = args[++index] ?? "";
    else if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (options.showSender && !options.name.trim()) throw new Error("--name is required unless --hide-sender is used.");
  if (!options.comment.trim()) throw new Error("--comment is required.");
  if (options.comment.length > 10_000) throw new Error("--comment must be 10,000 characters or fewer.");
  return options;
}

function wrapText(context: SKRSContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      if (lines.length) lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      if (context.measureText(word).width > maxWidth) {
        if (line) { lines.push(line); line = ""; }
        let segment = "";
        for (const character of Array.from(word)) {
          const candidate = segment + character;
          if (segment && context.measureText(candidate).width > maxWidth) {
            lines.push(segment);
            segment = character;
          } else segment = candidate;
        }
        line = segment;
        continue;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (!line || context.measureText(candidate).width <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function fitTextToWidth(context: SKRSContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text;
  const characters = Array.from(text);
  while (characters.length && context.measureText(`${characters.join("")}…`).width > maxWidth) characters.pop();
  return `${characters.join("")}…`;
}

function renderPage(name: string, comment: string, width: number, height: number, fitValue: string, fontSizeValue: number, showSender: boolean) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const fit = resolveCommentCardFit(fitValue);
  const transform = calculateCommentCardFit(width, height, fit);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  const frame = calculateCommentCardFrame(width, height);
  context.shadowColor = "rgba(15, 23, 42, 0.42)";
  context.shadowBlur = Math.round(Math.min(width, height) * 0.065);
  context.shadowOffsetY = Math.round(Math.min(width, height) * 0.024);
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(frame.x, frame.y, frame.width, frame.height, Math.round(Math.min(width, height) * 0.035));
  context.fill();
  context.shadowColor = "transparent";
  context.save();
  context.translate(transform.offsetX, fit === "contain" ? frame.y : transform.offsetY);
  context.scale(transform.scaleX, transform.scaleY);
  const templateWidth = COMMENT_CARD_BASE_WIDTH;
  const templateHeight = COMMENT_CARD_BASE_HEIGHT;
  const shortestSide = Math.min(templateWidth, templateHeight);
  const outerPadding = Math.round(shortestSide * 0.08);
  const bubbleX = outerPadding;
  const bubbleWidth = templateWidth - outerPadding * 2;
  const bubblePaddingX = Math.round(shortestSide * 0.052);
  const bubblePaddingY = Math.round(shortestSide * 0.045);
  const senderSize = calculateSenderFontSize(fontSizeValue);
  const safeWidth = bubbleWidth - bubblePaddingX * 2;
  const maxTextWidth = safeWidth - COMMENT_CARD_TEXT_SAFE_INSET * 2;
  const commentSize = resolveCommentFontSize(fontSizeValue);
  context.font = `400 ${commentSize}px ${COMMENT_CARD_FONT_FAMILY}`;
  const lines = wrapText(context, comment, maxTextWidth);
  const lineHeight = Math.round(commentSize * 1.38);

  const groupY = calculateCommentContentY(templateHeight);
  const safeX = bubbleX + bubblePaddingX;
  const safeY = groupY + bubblePaddingY;
  const safeBottom = templateHeight - outerPadding - bubblePaddingY;
  context.beginPath();
  context.rect(safeX, safeY, safeWidth, Math.max(0, safeBottom - safeY));
  context.clip();
  const textX = safeX + COMMENT_CARD_TEXT_SAFE_INSET;
  let textY = safeY + COMMENT_CARD_TEXT_SAFE_INSET;
  context.textAlign = "left";
  context.textBaseline = "top";
  if (showSender) {
    context.fillStyle = "#101828";
    context.font = `800 ${senderSize}px ${COMMENT_CARD_FONT_FAMILY}`;
    context.fillText(fitTextToWidth(context, name, maxTextWidth), textX, textY);
    textY += Math.round(senderSize * 1.25 + shortestSide * 0.02);
  }
  context.font = `400 ${commentSize}px ${COMMENT_CARD_FONT_FAMILY}`;
  context.fillStyle = "#1d2939";
  for (const line of lines) {
    context.fillText(line, textX, textY);
    textY += lineHeight;
  }
  context.restore();
  return canvas;
}

function renderCards(name: string, comment: string, width: number, height: number, fitValue: string, fontSizeValue: number, showSender: boolean) {
  const context = createCanvas(1, 1).getContext("2d");
  const shortestSide = Math.min(COMMENT_CARD_BASE_WIDTH, COMMENT_CARD_BASE_HEIGHT);
  const outerPadding = Math.round(shortestSide * 0.08);
  const paddingX = Math.round(shortestSide * 0.052);
  const fontSize = resolveCommentFontSize(fontSizeValue);
  const textWidth = COMMENT_CARD_BASE_WIDTH - outerPadding * 2 - paddingX * 2 - COMMENT_CARD_TEXT_SAFE_INSET * 2;
  context.font = `400 ${fontSize}px ${COMMENT_CARD_FONT_FAMILY}`;
  const lines = wrapText(context, comment, textWidth);
  const capacity = calculateCommentLineCapacities(fontSize, showSender);
  return paginateCommentLines(lines, capacity.firstPage, capacity.continuation).map((pageLines, index) =>
    renderPage(name, pageLines.join("\n"), width, height, fitValue, fontSize, showSender && index === 0),
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--ui")) {
    const playgroundUrl = pathToFileURL(resolve("scripts/comment-card-playground.html")).href;
    const launcher = process.platform === "win32"
      ? { command: "rundll32", args: ["url.dll,FileProtocolHandler", playgroundUrl] }
      : process.platform === "darwin"
        ? { command: "open", args: [playgroundUrl] }
        : { command: "xdg-open", args: [playgroundUrl] };
    spawn(launcher.command, launcher.args, { detached: true, stdio: "ignore" }).unref();
    console.log(`Comment Card UI opened: ${playgroundUrl}`);
    return;
  }
  const options = parseOptions(args);
  resolveCommentCardPreset(options.preset);
  const dimensions = resolveCommentCardDimensions(options.preset, options.width, options.height);
  const fit = resolveCommentCardFit(options.fit);
  const fontSize = resolveCommentFontSize(options.fontSize);
  const defaultName = `${sanitizeCommentCardFilename(options.name)}-${dimensions.width}x${dimensions.height}-${fit}.png`;
  const outputPath = resolve(options.output || `.tmp/comment-card-inspection/${defaultName}`);
  const canvases = renderCards(options.name.trim(), options.comment.trim(), dimensions.width, dimensions.height, fit, fontSize, options.showSender);
  await mkdir(dirname(outputPath), { recursive: true });
  const outputPaths = canvases.map((_, index) => canvases.length === 1 ? outputPath : addCommentCardPartSuffix(outputPath, index + 1));
  await Promise.all(canvases.map((canvas, index) => writeFile(outputPaths[index], canvas.toBuffer("image/png"))));
  console.log(`Comment card${canvases.length === 1 ? "" : "s"} created:\n${outputPaths.join("\n")}`);
  console.log(`Dimensions: ${dimensions.width}x${dimensions.height}`);
  console.log(`Fit: ${fit}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error(usage());
  process.exitCode = 1;
});
