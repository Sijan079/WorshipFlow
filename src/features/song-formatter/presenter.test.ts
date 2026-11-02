import assert from "node:assert/strict";
import { test } from "node:test";
import { documentFromText, getSections } from "./document.ts";
import { freeShowExport, normalizePartName, sectionsFromText, songFromSections, splitIntoSlides, toFreeShowText } from "./presenter.ts";

const section = (tag: string | null, ...lines: string[]) => ({ tag, lines });

test("short names become the full names a presenter app shows", () => {
  const cases: Array<[string, string]> = [
    ["V1", "Verse 1"], ["v2", "Verse 2"], ["Verse", "Verse"], ["verse 3", "Verse 3"], ["VERSE1", "Verse 1"],
    ["Ch", "Chorus"], ["C", "Chorus"], ["chorus", "Chorus"], ["Chorus 2", "Chorus 2"],
    ["Pre", "Pre-Chorus"], ["PC", "Pre-Chorus"], ["prechorus", "Pre-Chorus"], ["Pre Chorus", "Pre-Chorus"],
    ["Br", "Bridge"], ["bridge", "Bridge"], ["Bridge 2", "Bridge 2"],
    ["Intro", "Intro"], ["outro", "Outro"], ["Ending", "Outro"], ["Instr", "Instrumental"], ["interlude", "Interlude"], ["tag", "Tag"],
  ];
  for (const [given, expected] of cases) assert.equal(normalizePartName(given), expected, given);
  // A name that is not a known one is kept as the person wrote it, only tidied.
  assert.equal(normalizePartName("  Spontaneous   worship "), "Spontaneous worship");
});

test("lines are split into slides evenly, and never leave a lone line behind", () => {
  assert.deepEqual(splitIntoSlides(["a", "b"], 2), [["a", "b"]]);
  assert.deepEqual(splitIntoSlides(["a", "b", "c"], 2), [["a", "b", "c"]], "3 lines at a limit of 2 stay together instead of 2 and 1");
  assert.deepEqual(splitIntoSlides(["a", "b", "c", "d"], 2), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(splitIntoSlides(["a", "b", "c", "d", "e"], 2), [["a", "b", "c"], ["d", "e"]]);
  assert.deepEqual(splitIntoSlides(["a", "b", "c", "d", "e", "f"], 2), [["a", "b"], ["c", "d"], ["e", "f"]]);
  assert.deepEqual(splitIntoSlides(["a", "b", "c", "d", "e"], 4), [["a", "b", "c"], ["d", "e"]]);
  assert.deepEqual(splitIntoSlides(["a"], 2), [["a"]]);
  assert.deepEqual(splitIntoSlides([], 2), []);
});

test("splitting keeps every line, in order, and never makes an empty slide", () => {
  for (let limit = 1; limit <= 4; limit += 1) {
    for (let count = 1; count <= 30; count += 1) {
      const lines = Array.from({ length: count }, (_, n) => `line ${n}`);
      const slides = splitIntoSlides(lines, limit);
      assert.deepEqual(slides.flat(), lines, `${count} lines at ${limit}`);
      for (const slide of slides) {
        assert.ok(slide.length >= 1 && slide.length <= limit + 1, `${count} lines at ${limit}: a slide of ${slide.length}`);
        if (limit >= 2 && count > 1) assert.ok(slide.length >= 2, `${count} lines at ${limit}: a lone line`);
      }
    }
  }
});

test("a limit of zero keeps each slide as it was written", () => {
  assert.deepEqual(splitIntoSlides(["a", "b", "c", "d", "e", "f", "g"], 0), [["a", "b", "c", "d", "e", "f", "g"]]);
});

test("a song is title, then parts, and each part is slides", () => {
  const song = songFromSections([
    section("Title", "Amazing Grace"),
    section("V1", "Amazing grace how sweet the sound", "That saved a wretch like me", "", "I once was lost but now am found", "Was blind but now I see"),
    section("Chorus", "Praise the Lord", "Praise the Lord"),
  ]);
  assert.equal(song.title, "Amazing Grace");
  assert.deepEqual(song.parts.map((part) => part.name), ["Verse 1", "Chorus"]);
  assert.deepEqual(song.parts[0].slides, [["Amazing grace how sweet the sound", "That saved a wretch like me"], ["I once was lost but now am found", "Was blind but now I see"]]);
  assert.deepEqual(song.parts[1].slides, [["Praise the Lord", "Praise the Lord"]]);
});

test("a blank line inside a part is a slide break, and extra or trailing blank lines make no empty slides", () => {
  const song = songFromSections([section("Verse", "a", "b", "", "", "   ", "c", "d", "", "")]);
  assert.deepEqual(song.parts[0].slides, [["a", "b"], ["c", "d"]]);
});

test("a long part is split into slides at the chosen number of lines, and the choice can be turned off", () => {
  const lines = ["1", "2", "3", "4", "5", "6"];
  assert.deepEqual(songFromSections([section("Verse", ...lines)]).parts[0].slides, [["1", "2"], ["3", "4"], ["5", "6"]]);
  assert.deepEqual(songFromSections([section("Verse", ...lines)], { linesPerSlide: 4 }).parts[0].slides, [["1", "2", "3"], ["4", "5", "6"]]);
  assert.deepEqual(songFromSections([section("Verse", ...lines)], { linesPerSlide: 0 }).parts[0].slides, [lines]);
});

test("a part with no lyrics is kept as an empty slide, because it may be an instrumental the presenter needs to stop on", () => {
  const song = songFromSections([section("Verse", "a", "b"), section("Instr", "", ""), section("Chorus", "c", "d")]);
  assert.deepEqual(song.parts.map((part) => [part.name, part.slides.length]), [["Verse", 1], ["Instrumental", 0], ["Chorus", 1]]);
});

test("every repeat is written out in the order sung", () => {
  const song = songFromSections([section("Verse 1", "a", "b"), section("Chorus", "c", "d"), section("Verse 2", "e", "f"), section("Chorus", "c", "d")]);
  assert.deepEqual(song.parts.map((part) => part.name), ["Verse 1", "Chorus", "Verse 2", "Chorus"]);
});

test("lyrics before any tag are not lost: they become a Verse, and the person is told", () => {
  const song = songFromSections([section(null, "Hello", "World"), section("Chorus", "c", "d")]);
  assert.equal(song.parts[0].name, "Verse");
  assert.ok(song.warnings.some((warning) => /before the first tag/i.test(warning)));
});

test("lines have their end spaces trimmed, and the words are otherwise untouched", () => {
  const song = songFromSections([section("Verse", "  Hello there   ", "Café – ñ 終わり")]);
  assert.deepEqual(song.parts[0].slides, [["Hello there", "Café – ñ 終わり"]]);
});

const sample = [
  section("Title", "Amazing Grace"),
  section("V1", "Amazing grace how sweet the sound", "That saved a wretch like me", "", "I once was lost but now am found", "Was blind but now I see"),
  section("Instr"),
  section("Chorus", "Praise the Lord", "Praise the Lord"),
];

test("the FreeShow text starts with the title, then each part's header once, and a blank line between slides", () => {
  assert.equal(toFreeShowText(songFromSections(sample)), [
    "Title=Amazing Grace",
    "",
    "[Verse 1]",
    "Amazing grace how sweet the sound",
    "That saved a wretch like me",
    "",
    "I once was lost but now am found",
    "Was blind but now I see",
    "",
    "[Instrumental]",
    "",
    "[Chorus]",
    "Praise the Lord",
    "Praise the Lord",
    "",
  ].join("\n"));
});

test("the FreeShow text never has two blank lines in a row, and ends with one new line", () => {
  const text = toFreeShowText(songFromSections([section("Title", "T"), section("Verse", "a", "b", "", "", "c", "d"), section("Bridge"), section("Outro")]));
  assert.doesNotMatch(text, /\n\n\n/);
  assert.match(text, /[^\n]\n$/);
});

test("the first block is always the metadata block, so no lyric line can be mistaken for a note in it", () => {
  const text = toFreeShowText(songFromSections([section("Verse", "Jesus said: come to me", "I am the way")]));
  assert.ok(text.startsWith("Title="), "FreeShow reads Key: value lines in the first block as notes, so lyrics never go there");
  assert.equal(text.split("\n\n")[0].split("\n").length, 1);
});

test("a title is written so FreeShow keeps it whole: a colon would be read as a note", () => {
  const song = songFromSections([section("Title", "Hosanna: Be Lifted Higher"), section("Verse", "a", "b")]);
  assert.match(toFreeShowText(song), /^Title=Hosanna - Be Lifted Higher\n/);
  assert.ok(freeShowExport(song).warnings.some((warning) => /colon/i.test(warning)));
});

test("a lyric line FreeShow would swallow is changed a little, and the person is told which one", () => {
  const song = songFromSections([section("Verse", "Love = life", "[Chorus]", "Wait --- for it", "fine line")]);
  const text = toFreeShowText(song);
  assert.equal(text.split("\n").filter((line) => line.includes("=") && !line.startsWith("Title=")).length, 0);
  assert.equal(text.split("\n").filter((line) => /^\[.*\]$/.test(line)).length, 1, "only the real part header looks like a header");
  assert.doesNotMatch(text, /---/);
  assert.equal(freeShowExport(song).warnings.filter((warning) => /changed/i.test(warning)).length, 3);
  assert.match(text, /fine line/);
});

test("a song with no title still starts with a title line", () => {
  assert.match(toFreeShowText(songFromSections([section("Verse", "a", "b")])), /^Title=Untitled song\n/);
  assert.match(toFreeShowText(songFromSections([section("Verse", "a", "b")]), { title: "From the file name" }), /^Title=From the file name\n/);
});

test("exporting twice gives the same text and the same warnings, and leaves the song as it was", () => {
  const song = songFromSections([section("Title", "A: B"), section("Verse", "x = y", "z")]);
  const before = JSON.stringify(song);
  const first = freeShowExport(song);
  const second = freeShowExport(song);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(song), before);
  assert.equal(first.warnings.length, 2);
  assert.equal(toFreeShowText(song), first.text);
});

test("sections read from the song text match what the editor makes of the same text", () => {
  const text = "Stray first line\n[Title]\nAwit\n\n[Verse 2]\nPurihin Siya\n\n  \nIkaw & ako\n[Chorus]\n[Bridge]\n終わり\n";
  const fromText = sectionsFromText(text);
  const fromEditor = getSections(documentFromText(text)).map(({ tag, lines }) => ({ tag, lines }));
  assert.deepEqual(fromText, fromEditor);
});
