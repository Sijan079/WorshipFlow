import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, rm, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import type { ExtractorConfidenceLevel, ExtractorWarningCode } from "@/lib/extractor-types";

const execFileAsync = promisify(execFile);

const PYTHON_CANDIDATES = [
  process.env.WORSHIP_FLOW_PYTHON_PATH,
  "C:\\Users\\Sijan\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
  "python",
].filter(Boolean) as string[];

function getPythonCommand() {
  return PYTHON_CANDIDATES[0];
}

const PYTHON_EXTRACT_SCRIPT = `
import json
import sys
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}

def extract_docx(path: Path) -> str:
    from docx import Document
    doc = Document(str(path))
    chunks = []

    for paragraph in doc.paragraphs:
        if paragraph.text is not None:
            chunks.append(paragraph.text)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    if paragraph.text is not None:
                        chunks.append(paragraph.text)

    for section in doc.sections:
        for paragraph in section.header.paragraphs:
            if paragraph.text is not None:
                chunks.append(paragraph.text)
        for paragraph in section.footer.paragraphs:
            if paragraph.text is not None:
                chunks.append(paragraph.text)

    direct_text = "\\n".join(chunks)

    with ZipFile(path) as archive:
        xml_chunks = []
        for name in archive.namelist():
            if not name.startswith("word/") or not name.endswith(".xml"):
                continue
            try:
                root = ET.fromstring(archive.read(name))
            except ET.ParseError:
                continue
            xml_chunks.extend(
                text.text
                for text in root.findall(".//w:t", NS)
                if text.text is not None
            )

    xml_text = "\\n".join(xml_chunks)
    return xml_text if len(xml_text.strip()) > len(direct_text.strip()) else direct_text

def extract_pdf(path: Path) -> str:
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    chunks = []
    for page in reader.pages:
        chunks.append(page.extract_text() or "")
    return "\\n".join(chunks)

path = Path(sys.argv[1])
kind = sys.argv[2]
if kind == "docx":
    text = extract_docx(path)
elif kind == "pdf":
    text = extract_pdf(path)
else:
    raise RuntimeError(f"Unsupported parser kind: {kind}")

print(json.dumps({"text": text}))
`;

function normalizeExtractedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeLineSpacing(line: string) {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function isChordHeavyLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  const withoutPunctuation = trimmed.replace(/[()[\]|,-]/g, " ");
  const tokens = withoutPunctuation.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return false;
  }

  const chordPattern = /^[A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add)?\d*(?:\/[A-G](?:#|b)?)?$/i;
  const chordLike = tokens.filter((token) => chordPattern.test(token)).length;
  return chordLike > 0 && chordLike >= Math.ceil(tokens.length * 0.6);
}

function isInstrumentSection(line: string) {
  return /^(intro|interlude|instrumenta?l)\b.*$/i.test(line.trim());
}

function isRepeatDirective(line: string) {
  return /^\.{2,}|\brepeat as needed\b/i.test(line.trim());
}

function isVariantHeading(line: string) {
  return /\((?:transposed|lyrics|chords?)\)/i.test(line.trim());
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
  const trimmed = line.trim();
  if (/^verse\b/i.test(trimmed)) {
    return "[Verse]";
  }
  if (/^chorus\b/i.test(trimmed)) {
    return "[Chorus]";
  }
  if (/^pre[-\s]?chorus\b/i.test(trimmed)) {
    return "[Pre-Chorus]";
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
  if (/^end\b/i.test(trimmed)) {
    return "[End]";
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
};

type ExtractionAssessment = {
  confidence: ExtractorConfidenceLevel;
  warningCodes: ExtractorWarningCode[];
};

function filterNormalizedLines(rawLines: string[]) {
  const filteredLines: string[] = [];
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

  for (const line of rawLines) {
    if (!line) {
      if (filteredLines.at(-1) !== "") {
        filteredLines.push("");
      }
      continue;
    }

    if (isInstrumentSection(line) || isChordHeavyLine(line) || isRepeatDirective(line) || isVariantHeading(line)) {
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

function segmentRawSongCandidates(rawLines: string[]) {
  const initialTitleIndex = rawLines.findIndex((line) => isLikelyTitleCandidate(line));
  const initialTitle = initialTitleIndex >= 0 ? rawLines[initialTitleIndex].trim().toLowerCase() : null;
  const segments: string[][] = [];
  let current: string[] = [];
  let contentCount = 0;

  for (const line of rawLines) {
    const normalized = line.trim().toLowerCase();
    const isBoundary =
      isVariantHeading(line) || (initialTitle !== null && normalized === initialTitle && contentCount >= 12);

    if (isBoundary) {
      if (current.some((entry) => entry.trim().length > 0)) {
        segments.push(current);
      }
      current = [];
      contentCount = 0;
      continue;
    }

    current.push(line);
    if (line.trim().length > 0) {
      contentCount += 1;
    }
  }

  if (current.some((entry) => entry.trim().length > 0)) {
    segments.push(current);
  }

  return segments.length > 0 ? segments : [rawLines];
}

function filterSongLines(text: string): FilteredSong {
  const rawLines = normalizeExtractedText(text).split("\n").map(normalizeLineSpacing);
  const candidates = segmentRawSongCandidates(rawLines)
    .map(filterNormalizedLines)
    .map(trimDuplicateRestart)
    .filter((lines) => lines.some((line) => line.trim().length > 0));

  const selectedCandidate = selectPrimarySongCandidate(candidates);
  const title = selectedCandidate.find((line) => line && !line.startsWith("[") && isLikelyTitleCandidate(line));
  return {
    title: title || undefined,
    lines:
      title && selectedCandidate[0]?.trim().toLowerCase() === title.trim().toLowerCase()
        ? selectedCandidate
        : title
          ? [title, ...selectedCandidate]
          : selectedCandidate,
  };
}

function selectPrimarySongCandidate(candidates: string[][]) {
  const scored = candidates
    .map((candidate, index) => ({
      index,
      candidate,
      score: scoreSongCandidate(candidate),
    }))
    .filter(({ candidate }) => candidate.filter((line) => line.trim().length > 0).length > 0);

  const completeCandidates = scored.filter(({ score }) => score >= 12);
  if (completeCandidates.length > 0) {
    return completeCandidates[0].candidate;
  }

  return scored.sort((a, b) => b.score - a.score || a.index - b.index)[0]?.candidate ?? candidates[0] ?? [];
}

function trimDuplicateRestart(lines: string[]) {
  const normalized = lines.map((line) => line.trim().toLowerCase());
  const contentIndexes = normalized
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.length > 0 && !line.startsWith("["))
    .map(({ index }) => index);

  const firstLyricIndex = contentIndexes.find((index) => !isLikelyStandaloneTitle(lines[index])) ?? contentIndexes[0];
  if (firstLyricIndex === undefined) {
    return lines;
  }

  const firstLyric = normalized[firstLyricIndex];
  for (const index of contentIndexes) {
    if (index <= firstLyricIndex + 2) {
      continue;
    }

    if (normalized[index] !== firstLyric) {
      continue;
    }

    const prefix = normalized
      .slice(firstLyricIndex, index)
      .filter((line) => line.length > 0);
    const suffix = normalized.slice(index).filter((line) => line.length > 0);
    const compareLength = Math.min(prefix.length, suffix.length, 24);
    if (compareLength < 6) {
      continue;
    }

    let matches = 0;
    for (let offset = 0; offset < compareLength; offset += 1) {
      if (prefix[offset] === suffix[offset]) {
        matches += 1;
      }
    }

    if (matches / compareLength >= 0.65) {
      return lines.slice(0, index);
    }
  }

  return lines;
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

function normalizeLyricsText(text: string) {
  const { title, lines: filteredLines } = filterSongLines(text);
  const seenLines = new Set<string>();
  const outputLines: string[] = [];

  if (title) {
    outputLines.push("[Title]", title, "");
    seenLines.add(title.toLowerCase());
  }

  let previousWasSection = false;

  for (const line of filteredLines) {
    if (!line || (title && line.toLowerCase() === title.toLowerCase())) {
      continue;
    }

    if (line.startsWith("[")) {
      if (outputLines.at(-1) !== "") {
        outputLines.push("");
      }
      outputLines.push(line);
      previousWasSection = true;
      continue;
    }

    if (previousWasSection) {
      seenLines.clear();
      previousWasSection = false;
    }

    const normalizedKey = line.toLowerCase();
    if (seenLines.has(normalizedKey)) {
      continue;
    }

    outputLines.push(`${line}  `);
    seenLines.add(normalizedKey);
  }

  const compactLines: string[] = [];
  for (const line of outputLines) {
    if (!line && compactLines.at(-1) === "") {
      continue;
    }
    compactLines.push(line);
  }

  const dedupedSongLines = removeRepeatedSongTail(compactLines, title);
  const regroupedLines = trimRepeatedBlockSuffix(regroupSectionBodies(dedupedSongLines));

  const sectionCount = regroupedLines.filter((line) => line.startsWith("[") && line !== "[Title]").length;

  const finalText = regroupedLines.join("\n").trim();
  return {
    text: finalText,
    sectionCount,
    normalizationApplied: true,
    ...assessExtractionConfidence(text, finalText),
  };
}

function assessExtractionConfidence(rawText: string, finalText: string): ExtractionAssessment {
  const warningCodes: ExtractorWarningCode[] = [];
  const normalizedRaw = normalizeExtractedText(rawText);
  const normalizedFinal = normalizeExtractedText(finalText);
  const finalLower = normalizedFinal.toLowerCase();

  if (/\((?:transposed|lyrics|chords?)\)/i.test(normalizedRaw)) {
    warningCodes.push("variant_heading_detected");
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
    uniqueWarnings.includes("truncated_output_detected") ||
    uniqueWarnings.includes("sparse_output_detected")
  ) {
    confidence = "low";
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

function removeRepeatedSongTail(lines: string[], title?: string) {
  if (!title) {
    return lines;
  }

  const normalizedTitle = title.toLowerCase();
  const titleIndexes = lines
    .map((line, index) => ({ line: line.trim().toLowerCase(), index }))
    .filter((entry) => entry.line === normalizedTitle)
    .map((entry) => entry.index);

  if (titleIndexes.length < 2) {
    return lines;
  }

  const firstTitleIndex = titleIndexes[0];
  for (const candidateIndex of titleIndexes.slice(1)) {
    const prefix = lines
      .slice(firstTitleIndex, candidateIndex)
      .filter((line) => line.trim().length > 0)
      .map((line) => line.trim().toLowerCase());
    const suffix = lines
      .slice(candidateIndex)
      .filter((line) => line.trim().length > 0)
      .map((line) => line.trim().toLowerCase());

    if (prefix.length >= 8 && suffix.length >= 4) {
      const compareLength = Math.min(prefix.length, suffix.length);
      let matches = 0;
      for (let index = 0; index < compareLength; index += 1) {
        if (prefix[index] === suffix[index]) {
          matches += 1;
        }
      }

      if (matches / compareLength >= 0.75) {
        return lines.slice(0, candidateIndex).filter((line, index, array) => {
          return !(line === "" && array[index - 1] === "");
        });
      }
    }
  }

  return lines;
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

function trimRepeatedBlockSuffix(lines: string[]) {
  const titleBlock: string[] = [];
  let index = 0;

  if (lines[0] === "[Title]") {
    while (index < lines.length) {
      const line = lines[index];
      titleBlock.push(line);
      index += 1;
      if (index >= lines.length || (lines[index]?.startsWith("[") && lines[index] !== "[Title]")) {
        break;
      }
    }
  }

  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      continue;
    }

    if (line.startsWith("[") && currentBlock.length > 0) {
      blocks.push(currentBlock);
      currentBlock = [line];
      continue;
    }

    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const trimmedBlocks = [...blocks];
  for (let suffixStart = 1; suffixStart < trimmedBlocks.length; suffixStart += 1) {
    const suffixLength = trimmedBlocks.length - suffixStart;
    if (suffixLength < 2) {
      continue;
    }

    for (let compareStart = 0; compareStart + suffixLength <= suffixStart; compareStart += 1) {
      let matches = true;
      for (let offset = 0; offset < suffixLength; offset += 1) {
        if (trimmedBlocks[compareStart + offset].join("\n") !== trimmedBlocks[suffixStart + offset].join("\n")) {
          matches = false;
          break;
        }
      }

      if (matches) {
        trimmedBlocks.splice(suffixStart);
        suffixStart = trimmedBlocks.length;
        break;
      }
    }
  }

  if (trimmedBlocks.length >= 4) {
    for (
      let repeatedPrefixSize = 2;
      repeatedPrefixSize <= Math.min(6, Math.floor(trimmedBlocks.length / 2) + 1);
      repeatedPrefixSize += 1
    ) {
      const prefix = trimmedBlocks.slice(0, repeatedPrefixSize).map((block) => block.join("\n"));
      const suffix = trimmedBlocks.slice(-repeatedPrefixSize).map((block) => block.join("\n"));
      if (prefix.length === suffix.length && prefix.every((block, index) => block === suffix[index])) {
        trimmedBlocks.splice(trimmedBlocks.length - repeatedPrefixSize, repeatedPrefixSize);
        break;
      }
    }
  }

  if (trimmedBlocks.length >= 5) {
    for (let repeatedPrefixSize = 2; repeatedPrefixSize <= Math.min(6, trimmedBlocks.length - 1); repeatedPrefixSize += 1) {
      const prefix = trimmedBlocks.slice(0, repeatedPrefixSize).map((block) => block.join("\n"));
      const suffix = trimmedBlocks.slice(-repeatedPrefixSize).map((block) => block.join("\n"));
      const matches = prefix.every((block, index) => block === suffix[index]);
      if (matches) {
        trimmedBlocks.splice(trimmedBlocks.length - repeatedPrefixSize, repeatedPrefixSize);
        break;
      }
    }
  }

  const rebuilt: string[] = [];
  if (titleBlock.length > 0) {
    rebuilt.push(...titleBlock);
  }

  for (const block of trimmedBlocks) {
    if (rebuilt.length > 0 && rebuilt.at(-1) !== "") {
      rebuilt.push("");
    }
    rebuilt.push(...block);
  }

  return rebuilt.filter((line, idx, array) => !(line === "" && array[idx - 1] === ""));
}

async function runPythonExtraction(path: string, kind: "docx" | "pdf") {
  const scriptDir = await mkdtemp(join(tmpdir(), "worship-flow-parse-"));
  const scriptPath = join(scriptDir, `${randomUUID()}.py`);

  try {
    await writeFile(scriptPath, PYTHON_EXTRACT_SCRIPT, "utf8");
    const { stdout, stderr } = await execFileAsync(getPythonCommand(), [scriptPath, path, kind], {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10,
    });

    if (stderr?.trim()) {
      throw new Error(stderr.trim());
    }

    const parsed = JSON.parse(stdout) as { text?: string };
    const text = normalizeExtractedText(parsed.text ?? "");
    if (!text) {
      throw new Error(`No text could be extracted from the ${kind.toUpperCase()} file.`);
    }

    return text;
  } finally {
    await rm(scriptDir, { recursive: true, force: true });
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
      ...normalizeLyricsText(await runPythonExtraction(path, "docx")),
    };
  }

  if (normalizedMimeType.includes("pdf")) {
    return {
      parser: "pdf" as const,
      ...normalizeLyricsText(await runPythonExtraction(path, "pdf")),
    };
  }

  if (normalizedMimeType.includes("text/plain")) {
    return {
      parser: "txt" as const,
      ...normalizeLyricsText(await readFile(path, "utf8")),
    };
  }

  throw new Error("Only DOCX, PDF, and TXT uploads are supported for lyrics extraction.");
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
