import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { extractTextFromPasteInput, extractTextFromTemporaryFile } from "./transpose-parser.ts";

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdf(lines: string[]) {
  const commands = lines.map((line, index) => `(${escapePdfText(line)}) Tj${index < lines.length - 1 ? "\nT*" : ""}`).join("\n");
  const stream = `BT\n/F1 18 Tf\n22 TL\n72 720 Td\n${commands}\nET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

async function createChordRemovalDocx() {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "word/document.xml",
    [
      '<?xml version="1.0"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
      '<w:p><w:r><w:t>Baseline Song</w:t></w:r></w:p>',
      '<w:p><w:r><w:rPr><w:color w:val="0000FF"/></w:rPr><w:t>Verse 1</w:t></w:r></w:p>',
      '<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>C G Am F</w:t></w:r></w:p>',
      '<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>B/D\u266f - E</w:t></w:r></w:p>',
      '<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>Lyrics can also be red</w:t></w:r></w:p>',
      '<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>E</w:t></w:r></w:p>',
      '<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>C </w:t></w:r><w:r><w:rPr><w:color w:val="0000FF"/></w:rPr><w:t>[C]Amazing [G/B]grace</w:t></w:r></w:p>',
      "</w:body></w:document>",
    ].join(""),
  );

  return zip.generateAsync({ type: "uint8array" });
}

async function createLyricsDocx(lines: string[]) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "word/document.xml",
    [
      '<?xml version="1.0"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
      ...lines.map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`),
      "</w:body></w:document>",
    ].join(""),
  );

  return zip.generateAsync({ type: "uint8array" });
}

export async function runTransposeParserTests() {
  const source = await readFile(new URL("./transpose-parser.ts", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const nextConfig = await readFile(new URL("../../next.config.ts", import.meta.url), "utf8");

  assert.match(source, /createRequire\(import\.meta\.url\)/);
  assert.match(source, /require\(["']pdf-parse["']\)/);
  assert.match(packageJson.dependencies["@napi-rs/canvas"], /^\^?0\.1\.80$/);
  assert.match(nextConfig, /serverExternalPackages:\s*\["pdf-parse", "@napi-rs\/canvas"\]/);
  assert.match(nextConfig, /outputFileTracingIncludes:\s*\{[\s\S]*node_modules\/@napi-rs\/canvas\*\/\*\*\/\*/);
  assert.match(nextConfig, /node_modules\/pdf-parse\/dist\/pdf-parse\/cjs\/pdf\.worker\.mjs/);

  const directory = await mkdtemp(join(tmpdir(), "worship-flow-pdf-"));
  const path = join(directory, "lyrics.pdf");
  try {
    await writeFile(path, createPdf([
      "PDF Song",
      "Verse 1",
      "C G Am F",
      "First PDF lyric",
      "E",
      "[C]Second PDF [G/B]lyric",
    ]));
    const result = await extractTextFromTemporaryFile(path, "application/pdf");
    assert.equal(
      result.text,
      "[Title]\nPDF Song\n\n[Verse]\nFirst PDF lyric  \nSecond PDF lyric",
      "PDF formatter output removes chord-only lines and bracketed inline chords",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const docxDirectory = await mkdtemp(join(tmpdir(), "worship-flow-formatter-baseline-"));
  const docxPath = join(docxDirectory, "red-chords.docx");
  try {
    await writeFile(docxPath, await createChordRemovalDocx());
    const result = await extractTextFromTemporaryFile(
      docxPath,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    assert.equal(
      result.text,
      "[Title]\nBaseline Song\n\n[Verse]\nLyrics can also be red  \nAmazing grace",
      "DOCX formatter output removes colored chords without removing colored lyrics",
    );
  } finally {
    await rm(docxDirectory, { recursive: true, force: true });
  }

  const pasteResult = extractTextFromPasteInput([
    "Pasted Song",
    "Verse 1",
    "B/D\u266f - E F\u266f - G\u266fm",
    "First pasted lyric",
    "C\u266fm7 F#sus4",
    "[Am]Second pasted [E/G#]lyric",
  ].join("\n"));
  assert.equal(
    pasteResult.text,
    "[Title]\nPasted Song\n\n[Verse]\nFirst pasted lyric  \nSecond pasted lyric",
    "pasted formatter output removes Unicode chord-only lines and bracketed inline chords",
  );

  const repeatedChorusResult = extractTextFromPasteInput([
    "Washed",
    "Chorus 1",
    "I've been washed in the water, Washed in the blood",
    "I'm as good as new,Oh hallelujah",
    "I've been washed in the water, Washed in the blood",
    "All because of You, Oh hallelujah",
  ].join("\n"));
  assert.equal(
    repeatedChorusResult.text,
    [
      "[Title]",
      "Washed",
      "",
      "[Chorus]",
      "I've been washed in the water, Washed in the blood  ",
      "I'm as good as new,Oh hallelujah  ",
      "",
      "[Chorus]",
      "I've been washed in the water, Washed in the blood  ",
      "All because of You, Oh hallelujah",
    ].join("\n"),
    "two-line blocks preserve intentional repeated lyrics within one chorus",
  );

  const finalChorusDirectory = await mkdtemp(join(tmpdir(), "worship-flow-final-chorus-"));
  const finalChorusPath = join(finalChorusDirectory, "final-chorus.docx");
  try {
    await writeFile(finalChorusPath, await createLyricsDocx([
      "Final Chorus Song",
      "Verse 1",
      "Opening verse lyric one",
      "Opening verse lyric two",
      "Chorus",
      "I've been washed in the water, Washed in the blood",
      "All because of You, Oh hallelujah",
      "Instrumental",
      "Chorus",
      "I've been washed in the water, Washed in the blood",
      "All because of You, Oh hallelujah",
    ]));
    const result = await extractTextFromTemporaryFile(
      finalChorusPath,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    assert.equal(
      result.text.match(/^\[Chorus\]$/gm)?.length,
      2,
      "a repeated final Chorus after an Instrumental remains in DOCX output",
    );
    assert.equal(
      result.text.match(/^I've been washed in the water, Washed in the blood/gm)?.length,
      2,
      "the formatter preserves the lyrics in the repeated final Chorus",
    );
  } finally {
    await rm(finalChorusDirectory, { recursive: true, force: true });
  }

  const labeledArrangementsResult = extractTextFromPasteInput([
    "Arrangement Song",
    "(Lyrics)",
    "Verse 1",
    "Singer verse lyric one",
    "Singer verse lyric two",
    "Singer verse lyric three",
    "Singer verse lyric four",
    "Chorus",
    "Singer chorus lyric one",
    "Singer chorus lyric two",
    "Singer chorus lyric three",
    "Singer chorus lyric four",
    "[Chords]",
    "Arrangement Song",
    "Verse 1",
    "C G Am F",
    "Instrument verse lyric one",
    "Instrument verse lyric two",
    "Instrument verse lyric three",
    "Instrument verse lyric four",
    "Chorus",
    "F C G Am",
    "Instrument chorus lyric one",
    "Instrument chorus lyric two",
    "Instrument chorus lyric three",
    "Instrument chorus lyric four",
  ].join("\n"));
  assert.match(labeledArrangementsResult.text, /Instrument verse lyric one/);
  assert.doesNotMatch(labeledArrangementsResult.text, /Singer verse lyric one/);
  assert.doesNotMatch(labeledArrangementsResult.text, /^C G Am F$/m);
  assert.equal(labeledArrangementsResult.confidence, "low");
  assert.ok(labeledArrangementsResult.warningCodes.includes("multiple_arrangements_detected"));

  const titleAttachedLyricsResult = extractTextFromPasteInput([
    "Way Maker",
    "Verse 1",
    "C G Am F",
    "Instrument arrangement verse one",
    "Instrument arrangement verse two",
    "Instrument arrangement verse three",
    "Instrument arrangement verse four",
    "Chorus",
    "F C G Am",
    "Instrument arrangement chorus one",
    "Instrument arrangement chorus two",
    "Instrument arrangement chorus three",
    "Instrument arrangement chorus four",
    "Way Maker (Lyrics)",
    "Verse 1",
    "Singer arrangement verse one",
    "Singer arrangement verse two",
    "Singer arrangement verse three",
    "Singer arrangement verse four",
    "Chorus",
    "Singer arrangement chorus one",
    "Singer arrangement chorus two",
    "Singer arrangement chorus three",
    "Singer arrangement chorus four",
  ].join("\n"));
  assert.match(titleAttachedLyricsResult.text, /Instrument arrangement verse one/);
  assert.doesNotMatch(titleAttachedLyricsResult.text, /Singer arrangement verse one/);
  assert.doesNotMatch(titleAttachedLyricsResult.text, /Way Maker \(Lyrics\)/);
  assert.equal(titleAttachedLyricsResult.confidence, "low");
  assert.ok(titleAttachedLyricsResult.warningCodes.includes("multiple_arrangements_detected"));

  const chordFadeResult = extractTextFromPasteInput([
    "Fade Direction Song",
    "Verse 1",
    "A (Fade)",
    "(You're turning lives around)",
    "This lyric must remain",
  ].join("\n"));
  assert.doesNotMatch(chordFadeResult.text, /^A \(Fade\)/m);
  assert.match(
    chordFadeResult.text,
    /^\(You're turning lives around\)  $/m,
    "parenthesized lyrics remain when they are not attached to chord-only content",
  );

  const extendedChordResult = extractTextFromPasteInput([
    "Extended Chord Song",
    "Verse 1",
    "G (Hold)",
    "D (Let ring)",
    "A (Build)",
    "C (2 bars)",
    "F#m - stop",
    "G/B then C",
    "N.C.",
    "Tacet",
    "1 5 6m 4",
    "I V vi IV",
    "CΔ7",
    "A mighty fortress is our God",
    "I will hold You close",
  ].join("\n"));
  for (const removedLine of [
    "G (Hold)",
    "D (Let ring)",
    "A (Build)",
    "C (2 bars)",
    "F#m - stop",
    "G/B then C",
    "N.C.",
    "Tacet",
    "1 5 6m 4",
    "I V vi IV",
    "CΔ7",
  ]) {
    assert.doesNotMatch(extendedChordResult.text, new RegExp(`^${removedLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"));
  }
  assert.match(extendedChordResult.text, /^A mighty fortress is our God  $/m);
  assert.match(extendedChordResult.text, /^I will hold You close$/m);

  const ambiguousChordResult = extractTextFromPasteInput([
    "Ambiguous Chord Song",
    "Verse 1",
    "A (Cue worship leader)",
    "First definite lyric line",
    "Second definite lyric line",
  ].join("\n"));
  assert.match(ambiguousChordResult.text, /^A \(Cue worship leader\)  $/m);
  assert.ok(ambiguousChordResult.warningCodes.includes("possible_chord_line_detected"));

  const unlabeledArrangementsResult = extractTextFromPasteInput([
    "Unlabeled Song",
    "Verse 1",
    "First arrangement verse one",
    "First arrangement verse two",
    "First arrangement verse three",
    "First arrangement verse four",
    "Chorus",
    "First arrangement chorus one",
    "First arrangement chorus two",
    "First arrangement chorus three",
    "First arrangement chorus four",
    "Unlabeled Song",
    "Verse 1",
    "Second arrangement verse one",
    "Second arrangement verse two",
    "Second arrangement verse three",
    "Second arrangement verse four",
    "Chorus",
    "Second arrangement chorus one",
    "Second arrangement chorus two",
    "Second arrangement chorus three",
    "Second arrangement chorus four",
  ].join("\n"));
  assert.match(unlabeledArrangementsResult.text, /First arrangement verse one/);
  assert.doesNotMatch(unlabeledArrangementsResult.text, /Second arrangement verse one/);
  assert.equal(unlabeledArrangementsResult.confidence, "low");
  assert.ok(unlabeledArrangementsResult.warningCodes.includes("multiple_arrangements_detected"));

  const lyricsOnlyResult = extractTextFromPasteInput([
    "Lyrics Only Song",
    "Lyrics:",
    "Verse 1",
    "These lyrics mention chords in a normal sentence",
    "This title-like line stays in the selected arrangement",
    "Chorus",
    "Lyrics-only chorus line one",
    "Lyrics-only chorus line two",
  ].join("\n"));
  assert.match(lyricsOnlyResult.text, /These lyrics mention chords in a normal sentence/);
  assert.equal(
    lyricsOnlyResult.warningCodes.includes("multiple_arrangements_detected"),
    false,
    "a single strictly labeled Lyrics arrangement is not treated as multiple arrangements",
  );

  const titleLyricResult = extractTextFromPasteInput([
    "Title Echo Song",
    "Verse 1",
    "First verse lyric",
    "Second verse lyric",
    "Title Echo Song",
    "Last verse lyric",
  ].join("\n"));
  assert.match(titleLyricResult.text, /^Title Echo Song  $/m);
  assert.equal(
    titleLyricResult.warningCodes.includes("multiple_arrangements_detected"),
    false,
    "a title-like lyric without credible section content after it does not split the arrangement",
  );

  const trailingContentResult = extractTextFromPasteInput([
    "Boundary Song",
    "Verse 1",
    "First verse lyric",
    "Second verse lyric",
    "Chorus",
    "First chorus lyric",
    "Second chorus lyric",
    "",
    "Production Notes",
    "Use a blue wash during this song",
    "CCLI 1234567",
  ].join("\n"));
  assert.ok(trailingContentResult.warningCodes.includes("possible_trailing_content_detected"));
  assert.match(
    trailingContentResult.text,
    /Production Notes/,
    "suspicious trailing content remains editable instead of being deleted automatically",
  );

  const continuedPageResult = extractTextFromPasteInput([
    "Two Page Song",
    "Verse 1",
    "First-page lyric one",
    "First-page lyric two",
    "-- 1 of 2 --",
    "Verse 2",
    "Second-page lyric one",
    "Second-page lyric two",
    "Chorus",
    "Final chorus lyric one",
    "Final chorus lyric two",
    "-- 2 of 2 --",
  ].join("\n"));
  assert.equal(
    continuedPageResult.warningCodes.includes("possible_trailing_content_detected"),
    false,
    "page boundaries alone do not mark a continued song as trailing content",
  );

  const repeatedBridgeResult = extractTextFromPasteInput([
    "Bridge Song",
    "Verse 1",
    "Opening lyric one",
    "Opening lyric two",
    "Bridge: (X4)",
    "You took away my shame",
    "And You nailed it to the cross",
    "Got me running out the grave",
    "Hallelujah here I come",
    "Tag:",
    "Hallelujah here I come",
  ].join("\n"));
  assert.equal(
    repeatedBridgeResult.text.match(/^\[Bridge\]$/gm)?.length,
    8,
    "a four-line Bridge (X4) remains four repeats rendered as two two-line blocks each",
  );
  assert.equal(
    repeatedBridgeResult.text.match(/^You took away my shame/gm)?.length,
    4,
    "Bridge (X4) retains all four explicit repetitions",
  );

  const refrainOutroResult = extractTextFromPasteInput([
    "Section Alias Song",
    "Refrain:",
    "First refrain lyric",
    "Second refrain lyric",
    "[End]",
    "First ending lyric",
    "Second ending lyric",
  ].join("\n"));
  assert.equal(
    refrainOutroResult.text,
    [
      "[Title]",
      "Section Alias Song",
      "",
      "[Refrain]",
      "First refrain lyric  ",
      "Second refrain lyric  ",
      "",
      "[Outro]",
      "First ending lyric  ",
      "Second ending lyric",
    ].join("\n"),
    "Refrain is preserved and End is normalized to Outro",
  );
}
