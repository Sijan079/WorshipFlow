import assert from "node:assert/strict";
import test from "node:test";
import { songDocxFileName, songDownloadDisposition, downloadFileName } from "./filename.ts";

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
