import type { ExtractorWarningCode } from "@/lib/extractor-types";

type AiCleanupParams = {
  extractedText: string;
  parser: "docx" | "pdf" | "txt" | "paste";
  songTitle?: string;
  warningCodes: ExtractorWarningCode[];
};

function buildExtractorPrompt(params: AiCleanupParams) {
  const hints = [
    `Source parser: ${params.parser}.`,
    params.songTitle ? `User-provided song title: ${params.songTitle}.` : undefined,
    params.warningCodes.length > 0 ? `Warning signals: ${params.warningCodes.join(", ")}.` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "You are cleaning extracted worship-song lyrics from a chord sheet.",
    "Return only the cleaned song text.",
    "Rules:",
    "- Preserve lyric wording exactly whenever it is present.",
    "- Do not invent missing lyrics.",
    "- If multiple song versions are present, keep only the first complete arrangement/version, not merely the first verse or chorus.",
    "- Keep every vocal section from that arrangement: all verses, choruses, bridges, endings, tags, and repeated lyric sections.",
    "- Never summarize, shorten, paraphrase, compress, or stop after an early verse/chorus.",
    "- Remove chord-only lines, intro sections, instrumental/interlude sections, directive noise, and variant headings like '(Transposed)' or '(Lyrics)'.",
    "- Discard Instrumental sections completely, including Instrumental (X2), Instrumenta (X2), instrumental repeats, and any non-lyric instrumental marker.",
    "- Normalize numbered headings like Verse 1, Verse 2, Chorus 3, Bridge 2, Tag, Outro, and End into bracket tags like [Verse], [Chorus], [Bridge], [Tag], [Outro], and [End].",
    "- Treat bare numbers in headings as section numbers, not repeat counts: Verse 2 means the second verse, Chorus 3 means the third chorus, and Bridge 2 means the second bridge.",
    "- Only explicit x-markers mean repeats. If a vocal heading says Chorus 2x, Chorus x2, Bridge 3x, or Verse (X2), emit that many consecutive tagged lyric sections with the same lyric block.",
    "- Repeat markers apply only to vocal lyric sections. Never duplicate instrumental, intro, interlude, or other non-lyric sections.",
    "- Normalize structure into plain text with tags like [Title], [Verse], [Chorus], [Bridge], [Tag], [Outro], and [End] when inferable.",
    "- Do not include markdown fences, explanations, notes, or extra commentary.",
    "- Keep repeated chorus blocks only when they are part of the actual song flow.",
    hints,
    "",
    "Extracted text:",
    params.extractedText,
  ].join("\n");
}

function getMeaningfulLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isDirectiveLine(line: string) {
  return /^(?:intro|instrumenta?l|interlude|solo|turnaround|ad\s*lib|adlib|music)\b/i.test(line);
}

function isHeadingLine(line: string) {
  return /^\[(?:title|verse|chorus|bridge|pre-chorus|prechorus|tag|outro|end)\]$/i.test(line)
    || /^(?:title|verse|chorus|bridge|pre-chorus|prechorus|tag|outro|end)\b/i.test(line);
}

function isLikelyLyricLine(line: string) {
  if (isDirectiveLine(line) || isHeadingLine(line)) {
    return false;
  }

  if (/^\(?x?\d+x?\)?$/i.test(line)) {
    return false;
  }

  return /[a-z]/i.test(line);
}

function countLikelyLyricLines(text: string) {
  return getMeaningfulLines(text).filter(isLikelyLyricLine).length;
}

function countVocalHeadings(text: string) {
  return getMeaningfulLines(text).filter((line) =>
    /^\[?(?:verse|chorus|bridge|pre-chorus|prechorus|tag|outro|end)\b/i.test(line)
  ).length;
}

function getLyricWords(text: string) {
  return getMeaningfulLines(text)
    .filter(isLikelyLyricLine)
    .join(" ")
    .toLowerCase()
    .match(/[a-z']{3,}/g) ?? [];
}

function validateOutputIsGrounded(cleanedText: string, sourceText: string) {
  const sourceWords = new Set(getLyricWords(sourceText));
  const outputWords = getLyricWords(cleanedText);

  if (sourceWords.size < 8 || outputWords.length < 8) {
    return;
  }

  const groundedCount = outputWords.filter((word) => sourceWords.has(word)).length;
  const groundedRatio = groundedCount / outputWords.length;

  if (groundedRatio < 0.72) {
    throw new Error("AI cleanup produced text that does not match the source lyrics. Please retry or edit the local draft manually.");
  }
}

function normalizeSectionName(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, "-");
  if (normalized === "prechorus") {
    return "Pre-Chorus";
  }

  return normalized
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

function parseRepeatHeading(line: string) {
  const match = line
    .trim()
    .match(/^(verse|chorus|bridge|pre[-\s]?chorus|tag|outro|end)\s*(?:\d+)?\s*(?:\(?\s*(?:x\s*([2-9])|([2-9])\s*x)\s*\)?)?$/i);

  if (!match) {
    return null;
  }

  return {
    tag: normalizeSectionName(match[1]),
    count: match[2] || match[3] ? Number(match[2] ?? match[3]) : 1,
  };
}

function getExplicitRepeatCounts(sourceText: string) {
  const counts = new Map<string, number>();

  for (const line of getMeaningfulLines(sourceText)) {
    if (isDirectiveLine(line)) {
      continue;
    }

    const heading = parseRepeatHeading(line);
    if (!heading || heading.count <= 1) {
      continue;
    }

    counts.set(heading.tag, Math.max(counts.get(heading.tag) ?? 1, heading.count));
  }

  return counts;
}

function hasVocalHeading(text: string, tag: string) {
  const normalizedTag = tag.toLowerCase();
  return getMeaningfulLines(text).some((line) => {
    const bracketed = line.trim().match(/^\[([^\]]+)\]$/);
    if (bracketed) {
      return normalizeSectionName(bracketed[1]).toLowerCase() === normalizedTag;
    }

    const parsed = parseRepeatHeading(line);
    return parsed?.tag.toLowerCase() === normalizedTag;
  });
}

function parseTaggedSections(text: string) {
  const sections: Array<{ tag: string; lines: string[] }> = [];
  let current: { tag: string; lines: string[] } | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const heading = rawLine.trim().match(/^\[([^\]]+)\]$/);
    if (heading) {
      if (current) {
        sections.push(current);
      }

      current = { tag: normalizeSectionName(heading[1]), lines: [] };
      continue;
    }

    if (current) {
      current.lines.push(rawLine);
    } else if (rawLine.trim()) {
      current = { tag: "Verse", lines: [rawLine] };
    }
  }

  if (current) {
    sections.push(current);
  }

  return sections;
}

function serializeTaggedSections(sections: Array<{ tag: string; lines: string[] }>) {
  return sections
    .map((section) => [`[${section.tag}]`, ...section.lines].join("\n").trimEnd())
    .join("\n\n")
    .trim();
}

function getSectionSignature(section: { tag: string; lines: string[] }) {
  return [
    section.tag.toLowerCase(),
    ...section.lines.map((line) => line.trim().toLowerCase()).filter(Boolean),
  ].join("\n");
}

function collapseAccidentalRepeatedRuns(cleanedText: string, sourceText: string) {
  const repeatCounts = getExplicitRepeatCounts(sourceText);
  const sections = parseTaggedSections(cleanedText);
  const adjacentCollapsed: Array<{ tag: string; lines: string[] }> = [];
  let index = 0;

  while (index < sections.length) {
    const run: Array<{ tag: string; lines: string[] }> = [];
    const first = sections[index];
    const signature = getSectionSignature(first);

    while (index < sections.length && getSectionSignature(sections[index]) === signature) {
      run.push(sections[index]);
      index += 1;
    }

    const allowedCount = repeatCounts.get(first.tag) ?? 1;
    adjacentCollapsed.push(...run.slice(0, allowedCount));
  }

  const collapsed = [...adjacentCollapsed];
  for (let start = 0; start < collapsed.length; start += 1) {
    for (let size = 1; size <= Math.floor((collapsed.length - start) / 2); size += 1) {
      const firstRun = collapsed.slice(start, start + size);
      const secondRun = collapsed.slice(start + size, start + size * 2);
      if (firstRun.length !== secondRun.length) {
        continue;
      }

      const repeatedTag = firstRun[0]?.tag;
      if (!repeatedTag || repeatCounts.has(repeatedTag)) {
        continue;
      }

      const sameTagRun = firstRun.every((section) => section.tag === repeatedTag)
        && secondRun.every((section) => section.tag === repeatedTag);
      if (!sameTagRun) {
        continue;
      }

      const matches = firstRun.every(
        (section, offset) => getSectionSignature(section) === getSectionSignature(secondRun[offset])
      );
      if (matches) {
        collapsed.splice(start + size, size);
        size = 0;
      }
    }
  }

  return serializeTaggedSections(collapsed);
}

function applyExplicitRepeatMarkers(cleanedText: string, sourceText: string) {
  const repeatCounts = getExplicitRepeatCounts(sourceText);
  if (repeatCounts.size === 0) {
    return cleanedText;
  }

  const seenRepeatedTags = new Set<string>();
  const expanded: Array<{ tag: string; lines: string[] }> = [];

  for (const section of parseTaggedSections(cleanedText)) {
    expanded.push(section);

    const repeatCount = repeatCounts.get(section.tag) ?? 1;
    if (repeatCount <= 1 || seenRepeatedTags.has(section.tag)) {
      continue;
    }

    seenRepeatedTags.add(section.tag);
    for (let index = 1; index < repeatCount; index += 1) {
      expanded.push({ tag: section.tag, lines: [...section.lines] });
    }
  }

  return serializeTaggedSections(expanded);
}

function detectIncompleteResponse(payload: OpenAiResponsesPayload) {
  if (payload.status === "incomplete") {
    return true;
  }

  return payload.incomplete_details?.reason === "max_output_tokens";
}

function sanitizeAiOutput(text: string, sourceText: string) {
  const cleaned = text
    .replace(/^```(?:text)?/i, "")
    .replace(/```$/i, "")
    .trim();

  if (!cleaned) {
    throw new Error("AI cleanup returned empty text.");
  }

  if (cleaned.length > 50000) {
    throw new Error("AI cleanup returned too much text.");
  }

  if (/^(Here is|I've|I have|Below is)/i.test(cleaned)) {
    throw new Error("AI cleanup returned wrapper text instead of lyrics only.");
  }

  const sourceLyricLineCount = countLikelyLyricLines(sourceText);
  const outputLyricLineCount = countLikelyLyricLines(cleaned);
  const sourceHeadingCount = countVocalHeadings(sourceText);
  const outputHeadingCount = countVocalHeadings(cleaned);

  if (sourceLyricLineCount >= 12 && outputLyricLineCount < Math.ceil(sourceLyricLineCount * 0.65)) {
    throw new Error("AI cleanup looked incomplete. Please retry or edit the local draft manually.");
  }

  if (sourceHeadingCount >= 4 && outputHeadingCount < Math.ceil(sourceHeadingCount * 0.5)) {
    throw new Error("AI cleanup dropped too many song sections. Please retry or edit the local draft manually.");
  }

  if (hasVocalHeading(sourceText, "End") && !hasVocalHeading(cleaned, "End")) {
    throw new Error("AI cleanup dropped the ending section. Please retry or edit the local draft manually.");
  }

  if (hasVocalHeading(sourceText, "Outro") && !hasVocalHeading(cleaned, "Outro")) {
    throw new Error("AI cleanup dropped the outro section. Please retry or edit the local draft manually.");
  }

  validateOutputIsGrounded(cleaned, sourceText);

  return cleaned;
}

function supportsReasoningEffort(model: string) {
  const normalized = model.toLowerCase();
  return normalized.startsWith("o") || normalized.startsWith("gpt-5");
}

type OpenAiResponsesPayload = {
  status?: string;
  incomplete_details?: {
    reason?: string;
  } | null;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function readResponseText(payload: OpenAiResponsesPayload) {
  if (payload.output_text?.trim()) {
    return payload.output_text;
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

export async function runAiLyricsCleanup(params: AiCleanupParams) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI cleanup is not configured. Set OPENAI_API_KEY to enable manual AI fallback.");
  }

  const model = process.env.OPENAI_EXTRACTOR_MODEL || "gpt-4.1-mini";
  const requestBody = {
    model,
    input: buildExtractorPrompt(params),
    max_output_tokens: 12000,
    ...(supportsReasoningEffort(model) ? { reasoning: { effort: "minimal" } } : {}),
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI cleanup request failed: ${errorText || response.statusText}`);
  }

  const payload = (await response.json()) as OpenAiResponsesPayload;

  if (detectIncompleteResponse(payload)) {
    throw new Error("AI cleanup was cut off before completion. Please retry or edit the local draft manually.");
  }

  const cleaned = sanitizeAiOutput(readResponseText(payload), params.extractedText);
  const collapsed = collapseAccidentalRepeatedRuns(cleaned, params.extractedText);
  return applyExplicitRepeatMarkers(collapsed, params.extractedText);
}
