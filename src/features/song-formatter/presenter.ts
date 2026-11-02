// Getting a song ready for a presenter app (FreeShow first). Everything here is plain functions on plain data, so each
// rule can be tested on its own. The words of the song are never rewritten: lines are only trimmed, grouped into slides,
// and, where an app would otherwise swallow a line, changed by one character (and the person is told which line).

export type SectionLike = { tag: string | null; lines: string[] };
// The tagged sections of the song text, read the same way the editor reads it: a line that is only [Tag] starts a section.
export function sectionsFromText(text: string): SectionLike[] {
  const sections: SectionLike[] = [];
  let current: SectionLike = { tag: null, lines: [] };
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const tag = line.match(/^\s*\[([^\]\r\n]+)\]\s*$/);
    if (tag) {
      if (current.tag !== null || current.lines.some((entry) => entry.trim())) sections.push(current);
      current = { tag: tag[1].trim(), lines: [] };
    } else current.lines.push(line);
  }
  if (current.tag !== null || current.lines.length) sections.push(current);
  // The editor gives an empty section one empty line, so the two read it the same way.
  return sections.map((section) => ({ tag: section.tag, lines: section.lines.length > 0 ? section.lines : [""] }));
}

export type PresenterPart = { name: string; slides: string[][] };
export type PresenterSong = { title: string; parts: PresenterPart[]; warnings: string[] };

export const DEFAULT_LINES_PER_SLIDE = 2;
export const MAX_LINES_PER_SLIDE = 4;

const NUMBERED: Array<[RegExp, string]> = [
  [/^(?:v|verse)\s*(\d+)?$/i, "Verse"],
  [/^(?:c|ch|chorus)\s*(\d+)?$/i, "Chorus"],
  [/^(?:pc|pre|prechorus|pre-chorus|pre chorus)\s*(\d+)?$/i, "Pre-Chorus"],
  [/^(?:b|br|bridge)\s*(\d+)?$/i, "Bridge"],
  [/^(?:i|intro|introduction)\s*(\d+)?$/i, "Intro"],
  [/^(?:o|outro|end|ending)\s*(\d+)?$/i, "Outro"],
  [/^(?:inst|instr|instrumental)\s*(\d+)?$/i, "Instrumental"],
  [/^interlude\s*(\d+)?$/i, "Interlude"],
  [/^tag\s*(\d+)?$/i, "Tag"],
  [/^refrain\s*(\d+)?$/i, "Refrain"],
  [/^turnaround\s*(\d+)?$/i, "Turnaround"],
  [/^coda\s*(\d+)?$/i, "Coda"],
];

// "V1" becomes "Verse 1", "Ch" becomes "Chorus". A name that is not a known one is kept as written, only tidied.
export function normalizePartName(tag: string) {
  const tidy = tag.trim().replace(/\s+/g, " ");
  for (const [pattern, name] of NUMBERED) {
    const match = pattern.exec(tidy);
    if (match) return match[1] ? `${name} ${match[1]}` : name;
  }
  return tidy;
}

// Lines into slides of about `limit` lines, evenly. Three lines at a limit of two stay together, because a slide with one
// line left over looks like a mistake; no slide is ever more than one line over the limit. A limit of zero keeps the
// lines as one slide, which is how a slide already made by hand is left alone.
export function splitIntoSlides(lines: string[], limit: number): string[][] {
  if (lines.length === 0) return [];
  if (limit <= 0 || lines.length <= limit) return [lines];
  let count = Math.ceil(lines.length / limit);
  if (limit >= 2 && count > 1 && Math.ceil(lines.length / (count - 1)) <= limit + 1 && Math.floor(lines.length / count) < 2) count -= 1;
  const base = Math.floor(lines.length / count);
  const extra = lines.length % count;
  const slides: string[][] = [];
  let at = 0;
  for (let index = 0; index < count; index += 1) {
    const size = base + (index < extra ? 1 : 0);
    slides.push(lines.slice(at, at + size));
    at += size;
  }
  return slides;
}

type Options = { linesPerSlide?: number };

const isBlank = (line: string) => line.trim() === "";

// The song as parts and slides. [Title] gives the title. A tag starts a part; lines before any tag become a Verse, with a
// warning. A blank line inside a part is a slide break; a part with no lyrics is kept with no slides (an empty slide).
export function songFromSections(sections: SectionLike[], options: Options = {}): PresenterSong {
  const limit = Math.max(0, Math.min(options.linesPerSlide ?? DEFAULT_LINES_PER_SLIDE, MAX_LINES_PER_SLIDE));
  const warnings: string[] = [];
  const parts: PresenterPart[] = [];
  let title = "";

  for (const section of sections) {
    const tag = section.tag?.trim() ?? "";
    if (tag.toLowerCase() === "title") {
      const first = section.lines.map((line) => line.trim()).find((line) => line !== "");
      if (first && !title) title = first;
      continue;
    }

    // Chunks of lines between blank lines, trimmed.
    const chunks: string[][] = [];
    let current: string[] = [];
    for (const raw of section.lines) {
      if (isBlank(raw)) {
        if (current.length > 0) chunks.push(current);
        current = [];
      } else current.push(raw.trim());
    }
    if (current.length > 0) chunks.push(current);
    const slides = chunks.flatMap((chunk) => splitIntoSlides(chunk, limit));

    if (tag) {
      parts.push({ name: normalizePartName(tag), slides });
    } else if (slides.length > 0) {
      // Lines with no tag continue the part before them. At the very start there is none, so they become a Verse.
      const previous = parts.at(-1);
      if (previous) previous.slides.push(...slides);
      else {
        warnings.push("Some lines came before the first tag, so they were put in a Verse. Check the order.");
        parts.push({ name: "Verse", slides });
      }
    }
  }
  return { title, parts, warnings };
}

type FreeShowOptions = { title?: string };

// One lyric line, made safe for FreeShow's text import. FreeShow reads any line with "=" as a note about the song and
// takes it out of the lyrics, reads a "[...]" line as a part header, and "---" as the start of slide notes. Each is changed
// by one character, and `changed` says so, so the person can look at the line.
function safeLine(line: string, changed: string[]) {
  let safe = line;
  if (safe.includes("=")) safe = safe.replaceAll("=", "＝");
  if (/^\[.*\]$/.test(safe)) safe = `(${safe.slice(1, -1)})`;
  if (safe.includes("---")) safe = safe.replaceAll("---", "—");
  if (safe !== line) changed.push(line);
  return safe;
}

// The text FreeShow imports (File > Import, or Quick Lyrics). The first block is always the song's details, so a lyric line
// is never in the one block where FreeShow reads "Word: text" as a note. Each part is a [header] once, then its slides with
// a blank line between them. A part with no lyrics is only its header, which FreeShow makes into an empty slide.
export function freeShowExport(song: PresenterSong, options: FreeShowOptions = {}) {
  const warnings = [...song.warnings];
  const rawTitle = song.title || options.title?.trim() || "Untitled song";
  // A colon in a title would make FreeShow read the title line as a note and lose the title.
  const title = rawTitle.replace(/\s*:\s*/g, " - ");
  if (title !== rawTitle) warnings.push(`The title has a colon, which FreeShow cannot keep in a title, so it was written as "${title}".`);

  const changed: string[] = [];
  const blocks: string[] = [`Title=${title}`];
  for (const part of song.parts) {
    if (part.slides.length === 0) {
      blocks.push(`[${part.name}]`);
      continue;
    }
    part.slides.forEach((slide, index) => {
      const lines = slide.map((line) => safeLine(line, changed));
      blocks.push(index === 0 ? [`[${part.name}]`, ...lines].join("\n") : lines.join("\n"));
    });
  }
  for (const line of changed) warnings.push(`A line was changed a little so FreeShow keeps it as a lyric: "${line}".`);
  return { text: `${blocks.join("\n\n")}\n`, warnings };
}

export const toFreeShowText = (song: PresenterSong, options: FreeShowOptions = {}) => freeShowExport(song, options).text;
