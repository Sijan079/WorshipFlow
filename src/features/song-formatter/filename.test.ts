import assert from "node:assert/strict";
import test from "node:test";
import { songDocxFileName, songDownloadDisposition, songTextFileName, downloadFileName } from "./filename.ts";

test("DOCX names preserve spaces, Unicode and intentional suffixes", () => {
  for (const name of ["Way Maker", "Way-Maker-lyrics", "Awit ng Pag-ibig", "主の愛"]) {
    assert.equal(songDocxFileName(name), `${name}.docx`);
    assert.equal(downloadFileName(songDownloadDisposition(name)), `${name}.docx`);
  }
  assert.equal(songDocxFileName("Way Maker.docx"), "Way Maker.docx");
  assert.equal(songDocxFileName("  "), "Untitled song.docx");
  assert.equal(songDocxFileName("CON"), "_CON.docx");
  assert.ok(!songDownloadDisposition('a"\r\n/b').includes("\r\n"));
  assert.equal(downloadFileName('attachment; filename="Way Maker.docx"'), "Way Maker.docx");
  assert.equal(downloadFileName("attachment; filename*=UTF-8''%ZZ; filename=\"fallback.docx\""), "fallback.docx");
});

test("text file names follow the same rules as DOCX names", () => {
  assert.equal(songTextFileName("Way Maker"), "Way Maker.txt");
  assert.equal(songTextFileName("Way Maker.txt"), "Way Maker.txt");
  assert.equal(songTextFileName("主の愛"), "主の愛.txt");
  assert.equal(songTextFileName("  "), "Untitled song.txt");
  assert.equal(songTextFileName("CON"), "_CON.txt");
  assert.equal(songTextFileName('a/b:c'), "a_b_c.txt");
});
