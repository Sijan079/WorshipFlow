import { readFile } from "fs/promises";
import { createRequire } from "module";
import JSZip from "jszip";
import type { ExtractorConfidenceLevel, ExtractorWarningCode } from "@/lib/extractor-types";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse");

function normalizeExtractedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeLineSpacing(line: string) {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeChordSymbols(value: string) {
  return value.replace(/♯/g, "#").replace(/♭/g, "b");
}

function isChordToken(value: string) {
  const token = normalizeChordSymbols(value)
    .replace(/^[([{]+/, "")
    .replace(/[\])},;:]+$/, "");
  return /^[A-G](?:#|b)?(?:(?:maj|min|m|dim|aug|sus|add|omit|no)\d*|\d+(?:#|b)?|[+°ø])*(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/i.test(token);
}

function isRepeatToken(value: string) {
  return /^(?:x\s*[2-9]|[2-9]\s*x)$/i.test(value.replace(/[()]/g, "").trim());
}

function isChordOnlyLine(line: string) {
  const tokens = normalizeChordSymbols(line)
    .replace(/[\[\]]/g, " ")
    .replace(/[-–—|,;]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return false;

  const chordCount = tokens.filter(isChordToken).length;
  return chordCount > 0 && tokens.every((token) => isChordToken(token) || isRepeatToken(token));
}

function removeBracketedInlineChords(line: string) {
  return line
    .replace(/\[([^\]]+)\]/g, (match, candidate: string) => (isChordToken(candidate.trim()) ? "" : match))
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isPdfPageMarker(line: string) {
  return /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line.trim());
}

function isInstrumentSection(line: string) {
  return /^(intro|interlude|instrumenta?l)\b.*$/i.test(line.trim());
}

function isRepeatDirective(line: string) {
  return /^\.{2,}|\brepeat as needed\b/i.test(line.trim());
}

type ArrangementKind = "chords" | "lyrics" | "unknown";

function getArrangementMarker(line: string): ArrangementKind | null {
  const match = line.trim().match(/^(?:\((chords?|lyrics|transposed)\)|\[(chords?|lyrics|transposed)\]|(chords?|lyrics|transposed)\s*:)$/i);
  const marker = (match?.[1] ?? match?.[2] ?? match?.[3])?.toLowerCase();
  if (!marker) return null;
  if (marker.startsWith("chord")) return "chords";
  if (marker === "lyrics") return "lyrics";
  return "unknown";
}

function isVariantHeading(line: string) {
  return getArrangementMarker(line) !== null;
}

function isLikelyStandaloneTitle(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("[") || isVariantHeading(trimmed)) {
    return false;
  }

  if (toSectionLabel(trimmed)) {
    return false;
  }

  if (trimmed.length > 80) {
    return false;
  }

  return /^[A-Za-z0-9'&,!?.\- ]+$/.test(trimmed);
}

function isLikelyTitleCandidate(line: string) {
  const trimmed = line.trim();
  if (!isLikelyStandaloneTitle(trimmed)) {
    return false;
  }

  if (/[,.]/.test(trimmed)) {
    return false;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) {
    return false;
  }

  const lowercaseJoiners = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
  return words.every((word, index) => {
    const normalized = word.toLowerCase().replace(/^[("']+|[)"'.,!?;:]+$/g, "");
    if (index > 0 && lowercaseJoiners.has(normalized)) {
      return true;
    }
    return /^[A-Z0-9'(]/.test(word);
  });
}

function toSectionLabel(line: string) {
  const trimmed = line.trim().replace(/^\[([^\]]+)\]$/, "$1");
  if (/^verse\b/i.test(trimmed)) {
    return "[Verse]";
  }
  if (/^chorus\b/i.test(trimmed)) {
    return "[Chorus]";
  }
  if (/^pre[-\s]?chorus\b/i.test(trimmed)) {
    return "[Pre-Chorus]";
  }
  if (/^refrain\b/i.test(trimmed)) {
    return "[Refrain]";
  }
  if (/^bridge\b/i.test(trimmed)) {
    return "[Bridge]";
  }
  if (/^tag\b/i.test(trimmed)) {
    return "[Tag]";
  }
  if (/^outro\b/i.test(trimmed)) {
    return "[Outro]";
  }
  if (/^(?:end|ending)\b/i.test(trimmed)) {
    return "[Outro]";
  }

  return null;
}

function getVocalRepeatCount(line: string) {
  const trimmed = line.trim();
  const match = trimmed.match(/\(?\s*(?:x\s*([2-9])|([2-9])\s*x)\s*\)?$/i);
  return match && toSectionLabel(trimmed) ? Number(match[1] ?? match[2]) : 1;
}

type FilteredSong = {
  title?: string;
  lines: string[];
  multipleArrangementsDetected: boolean;
};

type ExtractionAssessment = {
  confidence: ExtractorConfidenceLevel;
  warningCodes: ExtractorWarningCode[];
};

function filterNormalizedLines(rawLines: string[]) {
  const filteredLines: string[] = [];
  const firstContentIndex = rawLines.findIndex((line) => line.trim().length > 0);
  const protectedTitleIndex =
    firstContentIndex >= 0 && isLikelyTitleCandidate(rawLines[firstContentIndex]) ? firstContentIndex : -1;
  let repeatedSection:
    | {
        label: string;
        count: number;
        contentStartIndex: number;
      }
    | null = null;

  function flushRepeatedSection() {
    if (!repeatedSection || repeatedSection.count <= 1) {
      repeatedSection = null;
      return;
    }

    const block = filteredLines.slice(repeatedSection.contentStartIndex).filter((line) => line.trim().length > 0);
    if (block.length === 0) {
      repeatedSection = null;
      return;
    }

    for (let index = 1; index < repeatedSection.count; index += 1) {
      if (filteredLines.at(-1) !== "") {
        filteredLines.push("");
      }
      filteredLines.push(repeatedSection.label, ...block);
    }

    repeatedSection = null;
  }

  for (const [lineIndex, rawLine] of rawLines.entries()) {
    const line = removeBracketedInlineChords(rawLine);
    if (!line) {
      if (filteredLines.at(-1) !== "") {
        filteredLines.push("");
      }
      continue;
    }

    if (
      isInstrumentSection(line) ||
      (lineIndex !== protectedTitleIndex && isChordOnlyLine(line)) ||
      isRepeatDirective(line) ||
      isVariantHeading(line) ||
      isPdfPageMarker(line)
    ) {
      continue;
    }

    const sectionLabel = toSectionLabel(line);
    if (sectionLabel) {
      flushRepeatedSection();
      if (filteredLines.at(-1) !== "") {
        filteredLines.push("");
      }
      filteredLines.push(sectionLabel);
      repeatedSection = {
        label: sectionLabel,
        count: getVocalRepeatCount(line),
        contentStartIndex: filteredLines.length,
      };
      continue;
    }

    filteredLines.push(line);
  }

  flushRepeatedSection();
  return filteredLines;
}

type SongCandidate = {
  kind: ArrangementKind;
  lines: string[];
};

function hasCredibleSectionContent(lines: string[]) {
  const sectionCount = lines.filter((line) => toSectionLabel(line) !== null).length;
  const lyricLineCount = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed.length > 0 &&
      toSectionLabel(trimmed) === null &&
      !isChordOnlyLine(trimmed) &&
      !isInstrumentSection(trimmed) &&
      !isRepeatDirective(trimmed) &&
      !isVariantHeading(trimmed)
    );
  }).length;
  return sectionCount > 0 && lyricLineCount >= 2;
}

function segmentRawSongCandidates(rawLines: string[]): SongCandidate[] {
  const initialTitleIndex = rawLines.findIndex((line) => isLikelyTitleCandidate(line));
  const initialTitle = initialTitleIndex >= 0 ? rawLines[initialTitleIndex].trim().toLowerCase() : null;
  const segments: SongCandidate[] = [];
  let current: string[] = [];
  let currentKind: ArrangementKind = "unknown";

  for (const [index, line] of rawLines.entries()) {
    const marker = getArrangementMarker(line);
    if (marker) {
      if (hasCredibleSectionContent(current)) {
        segments.push({ kind: currentKind, lines: current });
        current = [];
      } else {
        current = current.filter((entry) => isLikelyTitleCandidate(entry));
      }
      currentKind = marker;
      continue;
    }

    const normalized = line.trim().toLowerCase();
    const isRepeatedTitleBoundary =
      initialTitle !== null &&
      normalized === initialTitle &&
      index !== initialTitleIndex &&
      hasCredibleSectionContent(current) &&
      hasCredibleSectionContent(rawLines.slice(index + 1));

    if (isRepeatedTitleBoundary) {
      segments.push({ kind: currentKind, lines: current });
      current = [line];
      currentKind = "unknown";
      continue;
    }

    current.push(line);
  }

  if (current.some((entry) => entry.trim().length > 0)) {
    segments.push({ kind: currentKind, lines: current });
  }

  return segments.length > 0 ? segments : [{ kind: "unknown", lines: rawLines }];
}

function filterSongLines(text: string): FilteredSong {
  const rawLines = normalizeExtractedText(text).split("\n").map(normalizeLineSpacing);
  const candidates = segmentRawSongCandidates(rawLines)
    .map((candidate) => ({ ...candidate, lines: filterNormalizedLines(candidate.lines) }))
    .filter((candidate) => candidate.lines.some((line) => line.trim().length > 0));

  const selectedCandidate = selectPrimarySongCandidate(candidates);
  const documentTitle = rawLines.find((line) => isLikelyTitleCandidate(line));
  const title = documentTitle ?? selectedCandidate.lines.find((line) => line && !line.startsWith("[") && isLikelyTitleCandidate(line));
  return {
    title: title || undefined,
    lines:
      title && selectedCandidate.lines[0]?.trim().toLowerCase() === title.trim().toLowerCase()
        ? selectedCandidate.lines
        : title
          ? [title, ...selectedCandidate.lines]
          : selectedCandidate.lines,
    multipleArrangementsDetected: candidates.length > 1,
  };
}

function selectPrimarySongCandidate(candidates: SongCandidate[]) {
  const scored = candidates
    .map((candidate, index) => ({
      index,
      candidate,
      score: scoreSongCandidate(candidate.lines),
    }))
    .filter(({ candidate }) => candidate.lines.some((line) => line.trim().length > 0));

  for (const kind of ["chords", "lyrics", "unknown"] satisfies ArrangementKind[]) {
    const completeCandidate = scored.find(({ candidate, score }) => candidate.kind === kind && score >= 12);
    if (completeCandidate) return completeCandidate.candidate;
  }

  return scored.sort((a, b) => b.score - a.score || a.index - b.index)[0]?.candidate ?? candidates[0] ?? { kind: "unknown", lines: [] };
}

function scoreSongCandidate(lines: string[]) {
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  const sections = nonEmpty.filter((line) => line.startsWith("["));
  const lyricLines = nonEmpty.filter(
    (line) =>
      !line.startsWith("[") &&
      !isLikelyStandaloneTitle(line) &&
      !isInstrumentSection(line) &&
      !isRepeatDirective(line) &&
      !isVariantHeading(line)
  );

  let score = lyricLines.length;
  score += sections.length * 2;
  if (sections.includes("[Chorus]")) {
    score += 4;
  }
  if (sections.includes("[Verse]")) {
    score += 4;
  }
  if (sections.includes("[Bridge]")) {
    score += 2;
  }

  return score;
}

function hasPossibleTrailingContent(rawText: string) {
  const lines = normalizeExtractedText(rawText).split("\n").map(normalizeLineSpacing);
  const firstSectionIndex = lines.findIndex((line) => toSectionLabel(line) !== null);
  if (firstSectionIndex < 0) return false;

  return lines.slice(firstSectionIndex + 1).some((line) => {
    const trimmed = line.trim();
    return (
      /^(?:production\s+)?notes?\b|^credits?\b|^copyright\b|^written\s+by\b|^arranged\s+by\b|^contact\b|^license\b|^ccli\b|^all rights reserved\b/i.test(trimmed) ||
      /(?:https?:\/\/|www\.|\S+@\S+\.\S+|©)/i.test(trimmed)
    );
  });
}

function normalizeLyricsText(text: string) {
  const { title, lines: filteredLines, multipleArrangementsDetected } = filterSongLines(text);
  const outputLines: string[] = [];

  if (title) {
    outputLines.push("[Title]", title, "");
  }

  let skippedSourceTitle = false;
  for (const line of filteredLines) {
    if (!line) {
      continue;
    }

    if (!skippedSourceTitle && title && line.toLowerCase() === title.toLowerCase()) {
      skippedSourceTitle = true;
      continue;
    }

    if (line.startsWith("[")) {
      if (outputLines.at(-1) !== "") {
        outputLines.push("");
      }
      outputLines.push(line);
      continue;
    }

    outputLines.push(`${line}  `);
  }

  const compactLines: string[] = [];
  for (const line of outputLines) {
    if (!line && compactLines.at(-1) === "") {
      continue;
    }
    compactLines.push(line);
  }

  const regroupedLines = regroupSectionBodies(compactLines);

  const sectionCount = regroupedLines.filter((line) => line.startsWith("[") && line !== "[Title]").length;

  const finalText = regroupedLines.join("\n").trim();
  return {
    text: finalText,
    sectionCount,
    normalizationApplied: true,
    ...assessExtractionConfidence(text, finalText, multipleArrangementsDetected),
  };
}

function assessExtractionConfidence(
  rawText: string,
  finalText: string,
  multipleArrangementsDetected: boolean,
): ExtractionAssessment {
  const warningCodes: ExtractorWarningCode[] = [];
  const normalizedRaw = normalizeExtractedText(rawText);
  const normalizedFinal = normalizeExtractedText(finalText);
  const finalLower = normalizedFinal.toLowerCase();

  if (normalizedRaw.split("\n").some(isVariantHeading)) {
    warningCodes.push("variant_heading_detected");
  }

  if (multipleArrangementsDetected) {
    warningCodes.push("multiple_arrangements_detected");
  }

  if (hasPossibleTrailingContent(normalizedRaw)) {
    warningCodes.push("possible_trailing_content_detected");
  }

  if (/(instrumental|intro|interlude|outro|repeat as needed)/i.test(normalizedRaw)) {
    warningCodes.push("directive_noise_detected");
  }

  const nonEmptyLines = normalizedFinal.split("\n").filter((line) => line.trim().length > 0);
  const unlabeledLyricLines = nonEmptyLines.filter(
    (line) => !line.startsWith("[") && !isLikelyTitleCandidate(line)
  ).length;
  const sectionLabels = nonEmptyLines.filter((line) => line.startsWith("["));

  if (unlabeledLyricLines < 6) {
    warningCodes.push("sparse_output_detected");
  }

  if (sectionLabels.length === 0 || unlabeledLyricLines > sectionLabels.length * 4) {
    warningCodes.push("unlabeled_lines_detected");
  }

  const lines = nonEmptyLines.map((line) => line.trim().toLowerCase());
  const seen = new Set<string>();
  let repeatedCount = 0;
  for (const line of lines) {
    if (line.startsWith("[")) {
      continue;
    }
    if (seen.has(line)) {
      repeatedCount += 1;
    } else {
      seen.add(line);
    }
  }
  if (repeatedCount >= Math.max(4, Math.floor(unlabeledLyricLines * 0.3))) {
    warningCodes.push("repeated_sections_detected");
  }

  const titleLine = nonEmptyLines.find((line) => isLikelyTitleCandidate(line));
  if (titleLine) {
    const normalizedTitle = titleLine.trim().toLowerCase();
    const repeatedTitleCount = normalizedRaw
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line === normalizedTitle).length;
    if (repeatedTitleCount >= 2) {
      warningCodes.push("repeated_restart_detected");
    }
  }

  const finalLines = normalizedFinal.split("\n");
  const tail = finalLines.slice(-2).map((line) => line.trim());
  if (tail.some((line) => line.startsWith("[")) || /(?:\b(?:and|or|the|to|of)\b)$/i.test(tail.at(-1) ?? "")) {
    warningCodes.push("truncated_output_detected");
  }

  const uniqueWarnings = [...new Set(warningCodes)];
  let confidence: ExtractorConfidenceLevel = "high";
  if (
    uniqueWarnings.includes("variant_heading_detected") ||
    uniqueWarnings.includes("multiple_arrangements_detected") ||
    uniqueWarnings.includes("truncated_output_detected") ||
    uniqueWarnings.includes("sparse_output_detected")
  ) {
    confidence = "low";
  } else if (uniqueWarnings.includes("possible_trailing_content_detected")) {
    confidence = "medium";
  } else if (uniqueWarnings.length >= 2) {
    confidence = "medium";
  }

  if (finalLower.length < 40) {
    confidence = "low";
  }

  return {
    confidence,
    warningCodes: uniqueWarnings,
  };
}

function regroupSectionBodies(lines: string[]) {
  const result: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const currentLine = lines[index];
    if (!currentLine) {
      if (result.at(-1) !== "") {
        result.push("");
      }
      index += 1;
      continue;
    }

    if (currentLine === "[Title]") {
      result.push(currentLine);
      index += 1;
      while (index < lines.length && lines[index] && !lines[index].startsWith("[")) {
        result.push(lines[index]);
        index += 1;
      }
      continue;
    }

    if (!currentLine.startsWith("[")) {
      result.push(currentLine);
      index += 1;
      continue;
    }

    const label = currentLine;
    index += 1;

    while (index < lines.length && lines[index] === "") {
      index += 1;
    }

    const body: string[] = [];
    while (index < lines.length && lines[index] && !lines[index].startsWith("[")) {
      body.push(lines[index]);
      index += 1;
    }

    if (body.length === 0) {
      continue;
    }

    for (let bodyIndex = 0; bodyIndex < body.length; bodyIndex += 2) {
      if (result.at(-1) !== "") {
        result.push("");
      }
      result.push(label);
      const chunk = body.slice(bodyIndex, bodyIndex + 2);
      result.push(...chunk);
    }
  }

  return result.filter((line, idx, array) => !(line === "" && array[idx - 1] === ""));
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function getWordAttribute(xml: string, element: string, attribute: string) {
  return xml.match(new RegExp(`<w:${element}[^>]*w:${attribute}="([^"]+)"`, "i"))?.[1];
}

function isRedWordColor(value?: string) {
  if (!value || !/^[0-9a-f]{6}$/i.test(value)) return false;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return red >= 160 && red >= green * 1.5 && red >= blue * 1.5;
}

function extractDocxRunText(runXml: string) {
  return [...runXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/>/gi)]
    .map((match) => {
      if (match[0].startsWith("<w:tab")) return "\t";
      if (match[0].startsWith("<w:br")) return "\n";
      return decodeXmlText(match[1] ?? "");
    })
    .join("");
}

function extractDocxParagraphs(xml: string) {
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const runs = [...paragraph.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/gi)].map((match) => ({
      text: extractDocxRunText(match[0]),
      color: getWordAttribute(match[0], "color", "val"),
    }));
    const paragraphText = runs.map((run) => run.text).join("");
    const hasNonChordContent = runs.some((run) => run.text.trim() && !isChordOnlyLine(run.text));
    const text = runs
      .map((run) => {
        if (hasNonChordContent && isRedWordColor(run.color) && isChordOnlyLine(run.text)) return "";
        return run.text;
      })
      .join("");

    if (paragraphText.trim() && text.trim()) {
      lines.push(text);
    }
  }

  return lines.join("\n");
}

async function extractDocxText(path: string) {
  const zip = await JSZip.loadAsync(await readFile(path));
  const chunks: string[] = [];

  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith("word/") || !name.endsWith(".xml")) continue;
    const file = zip.file(name);
    if (!file) continue;
    const text = extractDocxParagraphs(await file.async("string"));
    if (text.trim()) {
      chunks.push(text);
    }
  }

  const text = normalizeExtractedText(chunks.join("\n"));
  if (!text) {
    throw new Error("No text could be extracted from the DOCX file.");
  }

  return text;
}

async function extractPdfText(path: string) {
  const parser = new PDFParse({ data: new Uint8Array(await readFile(path)) });

  try {
    const text = normalizeExtractedText((await parser.getText()).text);
    if (!text) {
      throw new Error("No text could be extracted from the PDF. Scanned image-only PDFs are not supported.");
    }
    return text;
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromTemporaryFile(path: string, mimeType: string) {
  const normalizedMimeType = mimeType.toLowerCase();

  if (
    normalizedMimeType.includes("wordprocessingml.document") ||
    normalizedMimeType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  ) {
    return {
      parser: "docx" as const,
      ...normalizeLyricsText(await extractDocxText(path)),
    };
  }

  if (normalizedMimeType.includes("pdf")) {
    return {
      parser: "pdf" as const,
      ...normalizeLyricsText(await extractPdfText(path)),
    };
  }

  throw new Error("Only DOCX and PDF uploads are supported for lyrics extraction.");
}

export function extractTextFromPasteInput(text: string) {
  const normalized = normalizeExtractedText(text);
  if (!normalized) {
    throw new Error("Pasted text is empty.");
  }

  return {
    parser: "paste" as const,
    ...normalizeLyricsText(normalized),
  };
}
