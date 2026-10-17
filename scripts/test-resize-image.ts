import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { createCanvas, loadImage, type Canvas } from "@napi-rs/canvas";
import { runOpenAIImageUpscaleTests } from "../src/lib/openai-image-upscale.test.ts";
import { enhanceImageWithOpenAI } from "../src/lib/openai-image-upscale.ts";
import { runRealEsrganUpscaleTests } from "../src/lib/realesrgan-upscale.test.ts";
import { upscaleWithRealEsrgan } from "../src/lib/realesrgan-upscale.ts";
import { runResizeImageTests } from "../src/lib/resize-image.test.ts";
import {
  calculateContainLayout,
  calculateFillTransform,
  detectContentBounds,
  enhanceScreenshotPixels,
  validateSourceCrop,
  type SourceCrop,
} from "../src/lib/resize-image.ts";

type Options = {
  input?: string;
  outputDirectory: string;
  width?: number;
  height?: number;
  crop?: SourceCrop;
  trim: boolean;
  fit: "contain" | "fill" | "stretch";
  sharpness: number;
  ai: boolean;
  aiRegion?: SourceCrop;
  aiProvider: "realesrgan" | "openai";
};

function parsePositiveInteger(value: string | undefined, option: string) {
  if (!value || !/^\d+$/.test(value) || Number(value) <= 0) {
    throw new Error(`${option} requires a positive whole number.`);
  }
  return Number(value);
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    outputDirectory: ".tmp/resize-image-inspection",
    trim: false,
    fit: "contain",
    sharpness: 0.7,
    ai: false,
    aiProvider: "realesrgan",
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--output") options.outputDirectory = args[++index] ?? "";
    else if (argument === "--width") options.width = parsePositiveInteger(args[++index], "--width");
    else if (argument === "--height") options.height = parsePositiveInteger(args[++index], "--height");
    else if (argument === "--crop") {
      const value = args[++index] ?? "";
      const parts = value.split(",").map(Number);
      if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
        throw new Error("--crop requires x,y,width,height in source pixels.");
      }
      options.crop = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
    else if (argument === "--trim") options.trim = true;
    else if (argument === "--fit") {
      const value = args[++index];
      if (value !== "contain" && value !== "fill" && value !== "stretch") {
        throw new Error("--fit must be contain, fill, or stretch.");
      }
      options.fit = value;
    }
    else if (argument === "--sharpness") {
      const value = Number(args[++index]);
      if (!Number.isFinite(value) || value < 0 || value > 2) {
        throw new Error("--sharpness must be a number from 0 to 2.");
      }
      options.sharpness = value;
    }
    else if (argument === "--ai") options.ai = true;
    else if (argument === "--ai-provider") {
      const value = args[++index];
      if (value !== "realesrgan" && value !== "openai") {
        throw new Error("--ai-provider must be realesrgan or openai.");
      }
      options.aiProvider = value;
    }
    else if (argument === "--ai-region") {
      const value = args[++index] ?? "";
      const parts = value.split(",").map(Number);
      if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
        throw new Error("--ai-region requires x,y,width,height in final-output pixels.");
      }
      options.aiRegion = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
    else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else if (!options.input) options.input = argument;
    else throw new Error(`Unexpected argument: ${argument}`);
  }
  if (!options.outputDirectory) throw new Error("--output requires a directory.");
  if (options.aiRegion && (!options.ai || options.aiProvider !== "openai")) {
    throw new Error("--ai-region is only available with --ai --ai-provider openai.");
  }
  return options;
}

function renderImage(
  image: Awaited<ReturnType<typeof loadImage>>,
  width: number,
  height: number,
  fit: Options["fit"]
) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (fit === "stretch") {
    context.drawImage(image, 0, 0, width, height);
  } else if (fit === "fill") {
    const transform = calculateFillTransform({
      sourceWidth: image.width,
      sourceHeight: image.height,
      targetWidth: width,
      targetHeight: height,
    });
    context.drawImage(
      image,
      transform.destinationX,
      transform.destinationY,
      transform.destinationWidth,
      transform.destinationHeight
    );
  } else {
    const layout = calculateContainLayout({
      sourceWidth: image.width,
      sourceHeight: image.height,
      targetWidth: width,
      targetHeight: height,
    });
    context.drawImage(image, layout.offsetX, layout.offsetY, layout.drawWidth, layout.drawHeight);
  }
  return canvas;
}

function detectAutomaticCrop(sourceCanvas: Canvas) {
  const scanScale = Math.min(1, 1024 / Math.max(sourceCanvas.width, sourceCanvas.height));
  const scanWidth = Math.max(1, Math.round(sourceCanvas.width * scanScale));
  const scanHeight = Math.max(1, Math.round(sourceCanvas.height * scanScale));
  const scanCanvas = createCanvas(scanWidth, scanHeight);
  const context = scanCanvas.getContext("2d");
  context.drawImage(sourceCanvas, 0, 0, scanWidth, scanHeight);
  const detected = detectContentBounds(
    context.getImageData(0, 0, scanWidth, scanHeight).data,
    scanWidth,
    scanHeight
  );
  if (!detected) throw new Error("Automatic trim could not find visible content.");
  const x = Math.floor(detected.x / scanScale);
  const y = Math.floor(detected.y / scanScale);
  const right = Math.min(sourceCanvas.width, Math.ceil((detected.x + detected.width) / scanScale));
  const bottom = Math.min(sourceCanvas.height, Math.ceil((detected.y + detected.height) / scanScale));
  return { x, y, width: right - x, height: bottom - y };
}

function cropCanvas(source: Canvas, crop: SourceCrop) {
  const canvas = createCanvas(crop.width, crop.height);
  canvas.getContext("2d").drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );
  return canvas;
}

async function main() {
  runResizeImageTests();
  await runOpenAIImageUpscaleTests();
  runRealEsrganUpscaleTests();
  console.log("Resize calculations and screenshot-enhancement tests passed.");

  const options = parseOptions(process.argv.slice(2));
  if (!options.input) {
    console.log("To render a comparison:");
    console.log("  npm run test:resize-image -- <image.png> [--width 1080] [--height 2400] [--fit contain|fill|stretch] [--sharpness 0.7] [--crop x,y,width,height | --trim] [--ai] [--ai-provider realesrgan|openai]");
    console.log("  Crop coordinates apply after the image is resized.");
    return;
  }

  const inputPath = resolve(options.input);
  const image = await loadImage(inputPath);
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  if (options.crop && options.trim) throw new Error("Use either --crop or --trim, not both.");
  const targetWidth = options.width ?? Math.max(sourceWidth, 1920);
  const targetHeight = options.height ?? Math.round(targetWidth * sourceHeight / sourceWidth);
  const outputDirectory = resolve(options.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });

  const resized = renderImage(image, targetWidth, targetHeight, options.fit);
  const crop = options.crop ?? (options.trim ? detectAutomaticCrop(resized) : {
    x: 0,
    y: 0,
    width: targetWidth,
    height: targetHeight,
  });
  const cropError = validateSourceCrop(crop, targetWidth, targetHeight);
  if (cropError) throw new Error(`Invalid post-resize crop: ${cropError}`);
  const standard = cropCanvas(resized, crop);
  const textClarity = cropCanvas(resized, crop);
  const textContext = textClarity.getContext("2d");
  const imageData = textContext.getImageData(0, 0, crop.width, crop.height);
  imageData.data.set(enhanceScreenshotPixels(imageData.data, crop.width, crop.height, options.sharpness));
  textContext.putImageData(imageData, 0, 0);

  const comparison = createCanvas(crop.width * 2, crop.height);
  const comparisonContext = comparison.getContext("2d");
  comparisonContext.drawImage(standard, 0, 0);
  comparisonContext.drawImage(textClarity, crop.width, 0);

  const stem = basename(inputPath, extname(inputPath)).replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
  const sizeLabel = `${crop.width}x${crop.height}`;
  const standardPath = resolve(outputDirectory, `${stem}-standard-${sizeLabel}.png`);
  const clarityPath = resolve(outputDirectory, `${stem}-text-clarity-${sizeLabel}.png`);
  const comparisonPath = resolve(outputDirectory, `${stem}-comparison-${sizeLabel}.png`);
  await Promise.all([
    writeFile(standardPath, standard.toBuffer("image/png")),
    writeFile(clarityPath, textClarity.toBuffer("image/png")),
    writeFile(comparisonPath, comparison.toBuffer("image/png")),
  ]);

  console.log(`Source: ${sourceWidth}x${sourceHeight}`);
  console.log(`Resized target: ${targetWidth}x${targetHeight}`);
  console.log(`Fit mode: ${options.fit}`);
  console.log(`Edge-aware sharpness: ${options.sharpness}`);
  console.log(`Post-resize crop: ${crop.x},${crop.y},${crop.width},${crop.height}`);
  console.log(`Final output: ${crop.width}x${crop.height}`);
  console.log(`Standard: ${standardPath}`);
  console.log(`Text clarity: ${clarityPath}`);
  console.log(`Comparison (standard left, text clarity right): ${comparisonPath}`);

  if (options.ai) {
    let aiCanvas: Canvas;
    let aiDescription: string;
    if (options.aiProvider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OpenAI enhancement requires OPENAI_API_KEY in .env or the process environment.");
      const model = process.env.OPENAI_IMAGE_UPSCALE_MODEL || "gpt-image-1";
      console.log(`Requesting optional OpenAI comparison with ${model}...`);
      const aiRegion = options.aiRegion ?? { x: 0, y: 0, width: crop.width, height: crop.height };
      const aiRegionError = validateSourceCrop(aiRegion, crop.width, crop.height);
      if (aiRegionError) throw new Error(`Invalid AI region: ${aiRegionError}`);
      const aiInput = cropCanvas(standard, aiRegion);
      const aiResult = await enhanceImageWithOpenAI({ apiKey, image: aiInput.toBuffer("image/png"), width: aiRegion.width, height: aiRegion.height, model });
      const aiImage = await loadImage(aiResult.bytes);
      aiCanvas = createCanvas(crop.width, crop.height);
      const aiContext = aiCanvas.getContext("2d");
      aiContext.drawImage(standard, 0, 0);
      aiContext.drawImage(aiImage, aiRegion.x, aiRegion.y, aiRegion.width, aiRegion.height);
      aiDescription = `OpenAI region ${aiRegion.x},${aiRegion.y},${aiRegion.width},${aiRegion.height}`;
    } else {
      console.log("Running local Real-ESRGAN 4x enhancement...");
      const realEsrganPath = resolve(outputDirectory, `${stem}-realesrgan-4x.png`);
      await upscaleWithRealEsrgan({ inputPath, outputPath: realEsrganPath });
      const aiImage = await loadImage(await readFile(realEsrganPath));
      await unlink(realEsrganPath);
      const aiResized = renderImage(aiImage, targetWidth, targetHeight, options.fit);
      aiCanvas = cropCanvas(aiResized, crop);
      aiDescription = "Local Real-ESRGAN 4x; exact fit/crop applied afterward";
    }
    const aiPath = resolve(outputDirectory, `${stem}-ai-${sizeLabel}.png`);
    const aiComparison = createCanvas(crop.width * 3, crop.height);
    const aiComparisonContext = aiComparison.getContext("2d");
    aiComparisonContext.drawImage(standard, 0, 0);
    aiComparisonContext.drawImage(textClarity, crop.width, 0);
    aiComparisonContext.drawImage(aiCanvas, crop.width * 2, 0);
    const aiComparisonPath = resolve(outputDirectory, `${stem}-comparison-with-ai-${sizeLabel}.png`);
    await Promise.all([
      writeFile(aiPath, aiCanvas.toBuffer("image/png")),
      writeFile(aiComparisonPath, aiComparison.toBuffer("image/png")),
    ]);
    console.log(`AI: ${aiPath}`);
    console.log(`AI method: ${aiDescription}`);
    console.log(`Three-way comparison (standard, deterministic, AI): ${aiComparisonPath}`);
  }
}

await main();
